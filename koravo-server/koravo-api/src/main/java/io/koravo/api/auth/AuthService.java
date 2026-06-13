package io.koravo.api.auth;

import io.koravo.api.organization.KoOrganizationMember;
import io.koravo.api.organization.OrganizationMemberRepository;
import io.koravo.common.exception.BusinessException;
import io.koravo.common.exception.ErrorCode;
import io.koravo.ops.audit.AuditLogService;
import io.koravo.security.RolePermissionMatrix;
import io.koravo.security.UserContextHolder;
import io.koravo.tenant.TenantContextHolder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;

@Service
public class AuthService {
    private static final String ACTIVE = "ACTIVE";

    private final OrganizationMemberRepository memberRepository;
    private final LoginSessionRepository sessionRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogService auditLogService;
    private final SecureRandom secureRandom = new SecureRandom();
    private final long sessionTtlHours;
    private final String bootstrapPassword;

    public AuthService(
            OrganizationMemberRepository memberRepository,
            LoginSessionRepository sessionRepository,
            PasswordEncoder passwordEncoder,
            AuditLogService auditLogService,
            @Value("${koravo.security.session-ttl-hours:8}") long sessionTtlHours,
            @Value("${koravo.security.bootstrap-password:Koravo@2026}") String bootstrapPassword
    ) {
        this.memberRepository = memberRepository;
        this.sessionRepository = sessionRepository;
        this.passwordEncoder = passwordEncoder;
        this.auditLogService = auditLogService;
        this.sessionTtlHours = sessionTtlHours;
        this.bootstrapPassword = bootstrapPassword;
    }

    @Transactional
    public LoginResponse login(LoginRequest request) {
        String tenantId = normalizedTenantId(request.tenantId());
        KoOrganizationMember member = memberRepository
                .findByTenantIdAndUserIdAndDeletedFalse(tenantId, request.userId().trim())
                .filter(item -> ACTIVE.equals(item.getStatus()))
                .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED, "成员账号或密码不正确"));
        ensurePasswordHash(member);
        if (!passwordEncoder.matches(request.password(), member.getPasswordHash())) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "成员账号或密码不正确");
        }

        Instant now = Instant.now();
        String token = newToken();
        KoLoginSession session = new KoLoginSession();
        session.setTenantId(tenantId);
        session.setCreatedBy(member.getUserId());
        session.setUpdatedBy(member.getUserId());
        session.setTokenHash(AuthTokenHasher.hash(token));
        session.setUserId(member.getUserId());
        session.setRole(member.getRole());
        session.setExpiresAt(now.plus(sessionTtlHours, ChronoUnit.HOURS));
        session.setLastSeenAt(now);
        sessionRepository.save(session);

        member.setLastLoginAt(now);
        member.setUpdatedBy(member.getUserId());
        memberRepository.save(member);
        recordAs(member, "AUTH_LOGIN", session.getId(), "登录系统");

        return new LoginResponse(
                token,
                tenantId,
                member.getUserId(),
                member.getName(),
                member.getDepartment(),
                member.getRole(),
                session.getExpiresAt(),
                RolePermissionMatrix.capabilitiesForRole(member.getRole())
        );
    }

    @Transactional
    public void logout(String token) {
        if (token == null || token.isBlank()) {
            return;
        }
        sessionRepository.findByTokenHashAndDeletedFalse(AuthTokenHasher.hash(token))
                .filter(session -> session.getRevokedAt() == null)
                .ifPresent(session -> {
                    session.setRevokedAt(Instant.now());
                    session.setUpdatedBy(UserContextHolder.getUserId());
                    sessionRepository.save(session);
                    auditLogService.record("AUTH_LOGOUT", "LOGIN_SESSION", session.getId(), "退出登录");
                });
    }

    private String normalizedTenantId(String tenantId) {
        String value = tenantId == null || tenantId.isBlank() ? TenantContextHolder.getTenantId() : tenantId.trim();
        return value.isBlank() ? TenantContextHolder.DEFAULT_TENANT : value;
    }

    private String newToken() {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private void ensurePasswordHash(KoOrganizationMember member) {
        if (member.getPasswordHash() != null && !member.getPasswordHash().isBlank()) {
            return;
        }
        member.setPasswordHash(passwordEncoder.encode(bootstrapPassword));
        member.setUpdatedBy("system");
        memberRepository.save(member);
    }

    private void recordAs(KoOrganizationMember member, String action, String resourceId, Object detail) {
        UserContextHolder.setUser(member.getUserId(), member.getRole());
        try {
            auditLogService.record(action, "LOGIN_SESSION", resourceId, detail);
        } finally {
            UserContextHolder.clear();
        }
    }
}

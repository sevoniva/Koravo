package io.koravo.api.organization;

import io.koravo.common.exception.BusinessException;
import io.koravo.common.exception.ErrorCode;
import io.koravo.ops.audit.AuditLogService;
import io.koravo.security.UserContextHolder;
import io.koravo.tenant.TenantContextHolder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class OrganizationDirectoryService {
    private static final String ACTIVE = "ACTIVE";
    private static final String DISABLED = "DISABLED";
    private static final Set<String> ROLES = Set.of(
            UserContextHolder.ROLE_ADMIN,
            UserContextHolder.ROLE_APPLICANT,
            UserContextHolder.ROLE_MANAGER,
            UserContextHolder.ROLE_FINANCE,
            UserContextHolder.ROLE_OPERATOR
    );

    private final OrganizationMemberRepository organizationMemberRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogService auditLogService;
    private final String bootstrapPassword;

    public OrganizationDirectoryService(
            OrganizationMemberRepository organizationMemberRepository,
            PasswordEncoder passwordEncoder,
            AuditLogService auditLogService,
            @Value("${koravo.security.bootstrap-password:Koravo@2026}") String bootstrapPassword
    ) {
        this.organizationMemberRepository = organizationMemberRepository;
        this.passwordEncoder = passwordEncoder;
        this.auditLogService = auditLogService;
        this.bootstrapPassword = bootstrapPassword;
    }

    @Transactional
    public List<OrganizationMemberResponse> members() {
        String tenantId = TenantContextHolder.getTenantId();
        ensureTenantDirectory(tenantId);
        return organizationMemberRepository
                .findByTenantIdAndDeletedFalseOrderByDepartmentAscNameAsc(tenantId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private void ensureTenantDirectory(String tenantId) {
        if (organizationMemberRepository.countByTenantIdAndDeletedFalse(tenantId) > 0) {
            ensureSeededPasswords(tenantId);
            return;
        }
        organizationMemberRepository.saveAll(List.of(
                member("admin", tenantId, "流程平台负责人", "流程平台组", UserContextHolder.ROLE_ADMIN),
                member("applicant", tenantId, "业务申请专员", "业务一部", UserContextHolder.ROLE_APPLICANT),
                member("manager", tenantId, "审批主管", "审批中心", UserContextHolder.ROLE_MANAGER),
                member("finance", tenantId, "复核专员", "审批中心", UserContextHolder.ROLE_FINANCE),
                member("operator", tenantId, "运行审计专员", "运维审计组", UserContextHolder.ROLE_OPERATOR)
        ));
    }

    @Transactional
    public OrganizationMemberResponse create(OrganizationMemberUpsertRequest request) {
        String tenantId = TenantContextHolder.getTenantId();
        String userId = normalizedText(request.userId());
        if (organizationMemberRepository.existsByTenantIdAndUserIdAndDeletedFalse(tenantId, userId)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "成员账号已存在");
        }
        if (request.password() == null || request.password().isBlank()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "新增成员必须设置初始密码");
        }
        assertPasswordPolicy(request.password());
        KoOrganizationMember member = new KoOrganizationMember();
        member.setTenantId(tenantId);
        member.setCreatedBy(UserContextHolder.getUserId());
        member.setUpdatedBy(UserContextHolder.getUserId());
        apply(member, request);
        member.setUserId(userId);
        member.setPasswordHash(passwordEncoder.encode(request.password()));
        KoOrganizationMember saved = organizationMemberRepository.save(member);
        auditLogService.record("ORG_MEMBER_CREATE", "ORGANIZATION_MEMBER", saved.getId(), auditDetail(saved));
        return toResponse(saved);
    }

    @Transactional
    public OrganizationMemberResponse update(String memberId, OrganizationMemberUpsertRequest request) {
        KoOrganizationMember member = findCurrentTenantMember(memberId);
        String nextUserId = normalizedText(request.userId());
        if (!member.getUserId().equals(nextUserId)
                && organizationMemberRepository.existsByTenantIdAndUserIdAndDeletedFalse(member.getTenantId(), nextUserId)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "成员账号已存在");
        }
        apply(member, request);
        member.setUserId(nextUserId);
        if (request.password() != null && !request.password().isBlank()) {
            assertPasswordPolicy(request.password());
            member.setPasswordHash(passwordEncoder.encode(request.password()));
        }
        member.setUpdatedBy(UserContextHolder.getUserId());
        KoOrganizationMember saved = organizationMemberRepository.save(member);
        auditLogService.record("ORG_MEMBER_UPDATE", "ORGANIZATION_MEMBER", saved.getId(), auditDetail(saved));
        return toResponse(saved);
    }

    @Transactional
    public OrganizationMemberResponse enable(String memberId) {
        KoOrganizationMember member = findCurrentTenantMember(memberId);
        member.setStatus(ACTIVE);
        member.setUpdatedBy(UserContextHolder.getUserId());
        KoOrganizationMember saved = organizationMemberRepository.save(member);
        auditLogService.record("ORG_MEMBER_ENABLE", "ORGANIZATION_MEMBER", saved.getId(), auditDetail(saved));
        return toResponse(saved);
    }

    @Transactional
    public OrganizationMemberResponse disable(String memberId) {
        KoOrganizationMember member = findCurrentTenantMember(memberId);
        if (member.getUserId().equals(UserContextHolder.getUserId())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "不能禁用当前登录成员");
        }
        member.setStatus(DISABLED);
        member.setUpdatedBy(UserContextHolder.getUserId());
        KoOrganizationMember saved = organizationMemberRepository.save(member);
        auditLogService.record("ORG_MEMBER_DISABLE", "ORGANIZATION_MEMBER", saved.getId(), auditDetail(saved));
        return toResponse(saved);
    }

    @Transactional
    public OrganizationMemberResponse resetPassword(String memberId, String password) {
        KoOrganizationMember member = findCurrentTenantMember(memberId);
        assertPasswordPolicy(password);
        member.setPasswordHash(passwordEncoder.encode(password));
        member.setUpdatedBy(UserContextHolder.getUserId());
        KoOrganizationMember saved = organizationMemberRepository.save(member);
        auditLogService.record("ORG_MEMBER_PASSWORD_RESET", "ORGANIZATION_MEMBER", saved.getId(), auditDetail(saved));
        return toResponse(saved);
    }

    private KoOrganizationMember member(String userId, String tenantId, String name, String department, String role) {
        KoOrganizationMember member = new KoOrganizationMember();
        member.setTenantId(tenantId);
        member.setCreatedBy("system");
        member.setUpdatedBy("system");
        member.setUserId(userId);
        member.setName(name);
        member.setDepartment(department);
        member.setRole(role);
        member.setStatus(ACTIVE);
        member.setPasswordHash(passwordEncoder.encode(bootstrapPassword));
        return member;
    }

    private void ensureSeededPasswords(String tenantId) {
        List<KoOrganizationMember> updated = organizationMemberRepository
                .findByTenantIdAndDeletedFalseOrderByDepartmentAscNameAsc(tenantId)
                .stream()
                .filter(member -> member.getPasswordHash() == null || member.getPasswordHash().isBlank())
                .peek(member -> {
                    member.setPasswordHash(passwordEncoder.encode(bootstrapPassword));
                    member.setUpdatedBy("system");
                })
                .toList();
        if (!updated.isEmpty()) {
            organizationMemberRepository.saveAll(updated);
        }
    }

    private void apply(KoOrganizationMember member, OrganizationMemberUpsertRequest request) {
        member.setName(normalizedText(request.name()));
        member.setDepartment(normalizedText(request.department()));
        member.setRole(normalizedRole(request.role()));
        member.setStatus(normalizedStatus(request.status()));
    }

    private KoOrganizationMember findCurrentTenantMember(String memberId) {
        return organizationMemberRepository.findById(memberId)
                .filter(member -> TenantContextHolder.getTenantId().equals(member.getTenantId()))
                .filter(member -> !member.isDeleted())
                .orElseThrow(() -> new BusinessException(ErrorCode.BAD_REQUEST, "成员不存在"));
    }

    private String normalizedText(String value) {
        return value == null ? "" : value.trim();
    }

    private String normalizedRole(String role) {
        String value = normalizedText(role);
        if (!ROLES.contains(value)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "岗位职责不正确");
        }
        return value;
    }

    private String normalizedStatus(String status) {
        String value = normalizedText(status);
        if (value.isBlank() || ACTIVE.equals(value)) {
            return ACTIVE;
        }
        if (DISABLED.equals(value)) {
            return DISABLED;
        }
        throw new BusinessException(ErrorCode.BAD_REQUEST, "成员状态不正确");
    }

    private void assertPasswordPolicy(String password) {
        String value = password == null ? "" : password;
        boolean hasLetter = value.chars().anyMatch(Character::isLetter);
        boolean hasDigit = value.chars().anyMatch(Character::isDigit);
        if (value.length() < 8 || !hasLetter || !hasDigit) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "密码至少 8 位，且包含字母和数字");
        }
    }

    private Map<String, Object> auditDetail(KoOrganizationMember member) {
        return Map.of(
                "userId", member.getUserId(),
                "name", member.getName(),
                "department", member.getDepartment(),
                "role", member.getRole(),
                "status", member.getStatus()
        );
    }

    private OrganizationMemberResponse toResponse(KoOrganizationMember member) {
        return new OrganizationMemberResponse(
                member.getId(),
                member.getTenantId(),
                member.getUserId(),
                member.getName(),
                member.getDepartment(),
                member.getRole(),
                member.getStatus(),
                member.getPasswordHash() != null && !member.getPasswordHash().isBlank(),
                member.getLastLoginAt()
        );
    }
}

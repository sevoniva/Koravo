package io.koravo.form.service;

import io.koravo.common.exception.BusinessException;
import io.koravo.common.exception.ErrorCode;
import io.koravo.form.domain.KoFormBinding;
import io.koravo.form.repo.FormBindingRepository;
import io.koravo.form.web.FormBindingRequest;
import io.koravo.form.web.FormBindingResponse;
import io.koravo.ops.audit.AuditLogService;
import io.koravo.security.UserContextHolder;
import io.koravo.tenant.TenantContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class FormBindingService {
    private final FormBindingRepository repository;
    private final AuditLogService auditLogService;

    public FormBindingService(FormBindingRepository repository, AuditLogService auditLogService) {
        this.repository = repository;
        this.auditLogService = auditLogService;
    }

    @Transactional
    public FormBindingResponse bind(FormBindingRequest request) {
        ensureUniqueBinding(null, request);
        KoFormBinding binding = new KoFormBinding();
        binding.setTenantId(TenantContextHolder.getTenantId());
        binding.setCreatedBy(UserContextHolder.getUserId());
        binding.setUpdatedBy(UserContextHolder.getUserId());
        binding.setProcessModelId(request.processModelId());
        binding.setProcessDefinitionId(request.processDefinitionId());
        binding.setTaskDefinitionKey(request.taskDefinitionKey());
        binding.setFormSchemaId(request.formSchemaId());
        binding.setFormSchemaVersion(request.formSchemaVersion());
        KoFormBinding saved = repository.save(binding);
        auditLogService.record("FORM_BIND", "FORM_BINDING", saved.getId(), auditDetail(saved));
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<FormBindingResponse> list(String processModelId, String processDefinitionId) {
        List<KoFormBinding> bindings;
        if (StringUtils.hasText(processDefinitionId)) {
            bindings = repository.findByTenantIdAndProcessDefinitionIdAndDeletedFalseOrderByUpdatedAtDesc(TenantContextHolder.getTenantId(), processDefinitionId);
        } else if (StringUtils.hasText(processModelId)) {
            bindings = repository.findByTenantIdAndProcessModelIdAndDeletedFalseOrderByUpdatedAtDesc(TenantContextHolder.getTenantId(), processModelId);
        } else {
            bindings = repository.findByTenantIdAndDeletedFalseOrderByUpdatedAtDesc(TenantContextHolder.getTenantId());
        }
        return bindings.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public Optional<FormBindingResponse> findByProcessModelTaskKey(String processModelId, String taskDefinitionKey) {
        if (!StringUtils.hasText(processModelId) || !StringUtils.hasText(taskDefinitionKey)) {
            return Optional.empty();
        }
        return repository.findFirstByTenantIdAndProcessModelIdAndTaskDefinitionKeyAndDeletedFalseOrderByUpdatedAtDesc(
                TenantContextHolder.getTenantId(),
                processModelId,
                taskDefinitionKey
        ).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public Optional<FormBindingResponse> findByProcessDefinitionTaskKey(String processDefinitionId, String taskDefinitionKey) {
        if (!StringUtils.hasText(processDefinitionId) || !StringUtils.hasText(taskDefinitionKey)) {
            return Optional.empty();
        }
        return repository.findFirstByTenantIdAndProcessDefinitionIdAndTaskDefinitionKeyAndDeletedFalseOrderByUpdatedAtDesc(
                TenantContextHolder.getTenantId(),
                processDefinitionId,
                taskDefinitionKey
        ).map(this::toResponse);
    }

    @Transactional
    public FormBindingResponse update(String id, FormBindingRequest request) {
        KoFormBinding binding = findActive(id);
        ensureUniqueBinding(id, request);
        binding.setUpdatedBy(UserContextHolder.getUserId());
        binding.setProcessModelId(request.processModelId());
        binding.setProcessDefinitionId(request.processDefinitionId());
        binding.setTaskDefinitionKey(request.taskDefinitionKey());
        binding.setFormSchemaId(request.formSchemaId());
        binding.setFormSchemaVersion(request.formSchemaVersion());
        KoFormBinding saved = repository.save(binding);
        auditLogService.record("FORM_BIND_UPDATE", "FORM_BINDING", saved.getId(), auditDetail(saved));
        return toResponse(saved);
    }

    @Transactional
    public void delete(String id) {
        KoFormBinding binding = findActive(id);
        binding.setUpdatedBy(UserContextHolder.getUserId());
        binding.setDeleted(true);
        auditLogService.record("FORM_BIND_DELETE", "FORM_BINDING", binding.getId(), auditDetail(binding));
    }

    private KoFormBinding findActive(String id) {
        KoFormBinding binding = repository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.FORM_BINDING_NOT_FOUND, "Form binding not found"));
        if (binding.isDeleted() || !TenantContextHolder.getTenantId().equals(binding.getTenantId())) {
            throw new BusinessException(ErrorCode.FORM_BINDING_NOT_FOUND, "Form binding not found");
        }
        return binding;
    }

    private void ensureUniqueBinding(String currentBindingId, FormBindingRequest request) {
        String tenantId = TenantContextHolder.getTenantId();
        assertNoDuplicate(
                currentBindingId,
                StringUtils.hasText(request.processModelId())
                        ? repository.findFirstByTenantIdAndProcessModelIdAndTaskDefinitionKeyAndDeletedFalseOrderByUpdatedAtDesc(
                                tenantId,
                                request.processModelId(),
                                request.taskDefinitionKey()
                        )
                        : Optional.empty()
        );
        assertNoDuplicate(
                currentBindingId,
                StringUtils.hasText(request.processDefinitionId())
                        ? repository.findFirstByTenantIdAndProcessDefinitionIdAndTaskDefinitionKeyAndDeletedFalseOrderByUpdatedAtDesc(
                                tenantId,
                                request.processDefinitionId(),
                                request.taskDefinitionKey()
                        )
                        : Optional.empty()
        );
    }

    private void assertNoDuplicate(String currentBindingId, Optional<KoFormBinding> existing) {
        if (existing == null || existing.isEmpty()) {
            return;
        }
        if (StringUtils.hasText(currentBindingId) && currentBindingId.equals(existing.get().getId())) {
            return;
        }
        throw new BusinessException(ErrorCode.BAD_REQUEST, "该流程节点已绑定表单");
    }

    private FormBindingResponse toResponse(KoFormBinding binding) {
        return new FormBindingResponse(
                binding.getId(),
                binding.getProcessModelId(),
                binding.getProcessDefinitionId(),
                binding.getTaskDefinitionKey(),
                binding.getFormSchemaId(),
                binding.getFormSchemaVersion()
        );
    }

    private Map<String, Object> auditDetail(KoFormBinding binding) {
        Map<String, Object> detail = new LinkedHashMap<>();
        if (StringUtils.hasText(binding.getProcessModelId())) {
            detail.put("processModelId", binding.getProcessModelId());
        }
        if (StringUtils.hasText(binding.getProcessDefinitionId())) {
            detail.put("processDefinitionId", binding.getProcessDefinitionId());
        }
        detail.put("taskDefinitionKey", binding.getTaskDefinitionKey());
        detail.put("formSchemaId", binding.getFormSchemaId());
        detail.put("formSchemaVersion", binding.getFormSchemaVersion());
        return detail;
    }
}

package io.koravo.form.service;

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
        auditLogService.record("FORM_BIND", "FORM_BINDING", saved.getId(), Map.of(
                "taskDefinitionKey", saved.getTaskDefinitionKey(),
                "formSchemaId", saved.getFormSchemaId()
        ));
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<FormBindingResponse> list(String processModelId) {
        List<KoFormBinding> bindings = StringUtils.hasText(processModelId)
                ? repository.findByTenantIdAndProcessModelIdAndDeletedFalseOrderByUpdatedAtDesc(TenantContextHolder.getTenantId(), processModelId)
                : repository.findByTenantIdAndDeletedFalseOrderByUpdatedAtDesc(TenantContextHolder.getTenantId());
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
}

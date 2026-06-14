package io.koravo.form.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.koravo.common.exception.BusinessException;
import io.koravo.common.exception.ErrorCode;
import io.koravo.form.domain.KoFormSchema;
import io.koravo.form.domain.KoFormSnapshot;
import io.koravo.form.repo.FormSchemaRepository;
import io.koravo.form.repo.FormSnapshotRepository;
import io.koravo.form.web.FormSchemaResponse;
import io.koravo.form.web.FormSnapshotResponse;
import io.koravo.security.UserContextHolder;
import io.koravo.tenant.TenantContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class FormSnapshotService {
    private final FormSnapshotRepository repository;
    private final FormSchemaRepository formSchemaRepository;
    private final ObjectMapper objectMapper;

    public FormSnapshotService(
            FormSnapshotRepository repository,
            FormSchemaRepository formSchemaRepository,
            ObjectMapper objectMapper
    ) {
        this.repository = repository;
        this.formSchemaRepository = formSchemaRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public void saveSnapshot(String processInstanceId, String taskId, String formSchemaId, Map<String, Object> formData) {
        saveSnapshot(processInstanceId, taskId, formSchemaId, null, formData);
    }

    @Transactional
    public void saveSnapshot(String processInstanceId, String taskId, String formSchemaId, FormSchemaResponse formSchema, Map<String, Object> formData) {
        KoFormSnapshot snapshot = new KoFormSnapshot();
        snapshot.setTenantId(TenantContextHolder.getTenantId());
        snapshot.setCreatedBy(UserContextHolder.getUserId());
        snapshot.setUpdatedBy(UserContextHolder.getUserId());
        snapshot.setProcessInstanceId(processInstanceId);
        snapshot.setTaskId(taskId);
        snapshot.setFormSchemaId(formSchemaId);
        if (formSchema != null) {
            snapshot.setFormSchemaVersion(formSchema.version());
            snapshot.setSchemaJson(formSchema.schemaJson());
            snapshot.setUiSchemaJson(formSchema.uiSchemaJson());
        }
        snapshot.setDataJson(toJson(formData == null ? Map.of() : formData));
        repository.save(snapshot);
    }

    @Transactional(readOnly = true)
    public List<FormSnapshotResponse> listByProcessInstance(String processInstanceId) {
        List<KoFormSnapshot> snapshots = repository.findByTenantIdAndProcessInstanceIdOrderByCreatedAtAsc(
                        TenantContextHolder.getTenantId(),
                        processInstanceId
                );
        Map<String, KoFormSchema> schemaById = formSchemaMap(snapshots);
        return snapshots
                .stream()
                .map(snapshot -> toResponse(snapshot, schemaById.get(snapshot.getFormSchemaId())))
                .toList();
    }

    private Map<String, KoFormSchema> formSchemaMap(List<KoFormSnapshot> snapshots) {
        List<String> formSchemaIds = snapshots.stream()
                .map(KoFormSnapshot::getFormSchemaId)
                .filter(StringUtils::hasText)
                .distinct()
                .toList();
        if (formSchemaIds.isEmpty()) {
            return Map.of();
        }
        return formSchemaRepository
                .findByTenantIdAndIdInAndDeletedFalse(TenantContextHolder.getTenantId(), formSchemaIds)
                .stream()
                .collect(Collectors.toMap(KoFormSchema::getId, Function.identity()));
    }

    private FormSnapshotResponse toResponse(KoFormSnapshot snapshot, KoFormSchema formSchema) {
        return new FormSnapshotResponse(
                snapshot.getId(),
                snapshot.getProcessInstanceId(),
                snapshot.getTaskId(),
                snapshot.getFormSchemaId(),
                formSchema == null ? null : formSchema.getFormKey(),
                formSchema == null ? null : formSchema.getFormName(),
                snapshot.getFormSchemaVersion(),
                snapshot.getSchemaJson(),
                snapshot.getUiSchemaJson(),
                snapshot.getDataJson(),
                snapshot.getCreatedAt()
        );
    }

    private String toJson(Map<String, Object> data) {
        try {
            return objectMapper.writeValueAsString(data);
        } catch (JsonProcessingException e) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "Invalid form data");
        }
    }
}

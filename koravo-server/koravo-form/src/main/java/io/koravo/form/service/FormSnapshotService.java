package io.koravo.form.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.koravo.common.exception.BusinessException;
import io.koravo.common.exception.ErrorCode;
import io.koravo.form.domain.KoFormSnapshot;
import io.koravo.form.repo.FormSnapshotRepository;
import io.koravo.security.UserContextHolder;
import io.koravo.tenant.TenantContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

@Service
public class FormSnapshotService {
    private final FormSnapshotRepository repository;
    private final ObjectMapper objectMapper;

    public FormSnapshotService(FormSnapshotRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public void saveSnapshot(String processInstanceId, String taskId, String formSchemaId, Map<String, Object> formData) {
        KoFormSnapshot snapshot = new KoFormSnapshot();
        snapshot.setTenantId(TenantContextHolder.getTenantId());
        snapshot.setCreatedBy(UserContextHolder.getUserId());
        snapshot.setUpdatedBy(UserContextHolder.getUserId());
        snapshot.setProcessInstanceId(processInstanceId);
        snapshot.setTaskId(taskId);
        snapshot.setFormSchemaId(formSchemaId);
        snapshot.setDataJson(toJson(formData == null ? Map.of() : formData));
        repository.save(snapshot);
    }

    private String toJson(Map<String, Object> data) {
        try {
            return objectMapper.writeValueAsString(data);
        } catch (JsonProcessingException e) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "Invalid form data");
        }
    }
}

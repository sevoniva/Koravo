package io.koravo.form.service;

import io.koravo.common.exception.BusinessException;
import io.koravo.common.exception.ErrorCode;
import io.koravo.form.domain.FormStatus;
import io.koravo.form.domain.KoFormSchema;
import io.koravo.form.repo.FormSchemaRepository;
import io.koravo.form.web.FormSchemaRequest;
import io.koravo.form.web.FormSchemaResponse;
import io.koravo.security.UserContextHolder;
import io.koravo.tenant.TenantContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class FormSchemaService {
    private final FormSchemaRepository repository;

    public FormSchemaService(FormSchemaRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public FormSchemaResponse create(FormSchemaRequest request) {
        KoFormSchema schema = new KoFormSchema();
        schema.setTenantId(TenantContextHolder.getTenantId());
        schema.setCreatedBy(UserContextHolder.getUserId());
        schema.setUpdatedBy(UserContextHolder.getUserId());
        schema.setFormKey(request.formKey());
        schema.setFormName(request.formName());
        schema.setVersion(1);
        schema.setSchemaJson(request.schemaJson());
        schema.setUiSchemaJson(request.uiSchemaJson());
        schema.setStatus(FormStatus.ACTIVE);
        return toResponse(repository.save(schema));
    }

    @Transactional(readOnly = true)
    public List<FormSchemaResponse> list() {
        return repository.findByTenantIdAndDeletedFalseOrderByUpdatedAtDesc(TenantContextHolder.getTenantId())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public FormSchemaResponse get(String id) {
        KoFormSchema schema = repository.findByIdAndTenantIdAndDeletedFalse(id, TenantContextHolder.getTenantId())
                .orElseThrow(() -> new BusinessException(ErrorCode.FORM_SCHEMA_NOT_FOUND, "Form schema not found"));
        return toResponse(schema);
    }

    @Transactional
    public FormSchemaResponse update(String id, FormSchemaRequest request) {
        KoFormSchema schema = repository.findByIdAndTenantIdAndDeletedFalse(id, TenantContextHolder.getTenantId())
                .orElseThrow(() -> new BusinessException(ErrorCode.FORM_SCHEMA_NOT_FOUND, "Form schema not found"));
        schema.setFormKey(request.formKey());
        schema.setFormName(request.formName());
        schema.setSchemaJson(request.schemaJson());
        schema.setUiSchemaJson(request.uiSchemaJson());
        schema.setVersion(schema.getVersion() + 1);
        schema.setStatus(FormStatus.ACTIVE);
        schema.setUpdatedBy(UserContextHolder.getUserId());
        return toResponse(repository.save(schema));
    }

    private FormSchemaResponse toResponse(KoFormSchema schema) {
        return new FormSchemaResponse(
                schema.getId(),
                schema.getFormKey(),
                schema.getFormName(),
                schema.getVersion(),
                schema.getSchemaJson(),
                schema.getUiSchemaJson(),
                schema.getStatus().name()
        );
    }
}

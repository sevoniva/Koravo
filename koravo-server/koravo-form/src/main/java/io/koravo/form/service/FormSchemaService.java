package io.koravo.form.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.koravo.common.exception.BusinessException;
import io.koravo.common.exception.ErrorCode;
import io.koravo.common.model.AssetOrigin;
import io.koravo.form.domain.FormStatus;
import io.koravo.form.domain.KoFormSchema;
import io.koravo.form.domain.KoFormSchemaVersion;
import io.koravo.form.repo.FormSchemaRepository;
import io.koravo.form.repo.FormSchemaVersionRepository;
import io.koravo.form.web.FormSchemaRequest;
import io.koravo.form.web.FormSchemaResponse;
import io.koravo.form.web.FormSchemaVersionResponse;
import io.koravo.ops.audit.AuditLogService;
import io.koravo.security.UserContextHolder;
import io.koravo.tenant.TenantContextHolder;
import org.springframework.util.StringUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Service
public class FormSchemaService {
    private static final List<AssetOrigin> PRODUCTION_ASSET_ORIGINS = List.of(
            AssetOrigin.SYSTEM_TEMPLATE,
            AssetOrigin.USER_FLOW
    );

    private final FormSchemaRepository repository;
    private final FormSchemaVersionRepository versionRepository;
    private final AuditLogService auditLogService;
    private final ObjectMapper objectMapper;

    public FormSchemaService(
            FormSchemaRepository repository,
            FormSchemaVersionRepository versionRepository,
            AuditLogService auditLogService,
            ObjectMapper objectMapper
    ) {
        this.repository = repository;
        this.versionRepository = versionRepository;
        this.auditLogService = auditLogService;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public FormSchemaResponse create(FormSchemaRequest request) {
        validateSchemaPayload(request);
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
        schema.setAssetOrigin(AssetOrigin.USER_FLOW);
        KoFormSchema saved = repository.save(schema);
        saveVersion(saved);
        auditLogService.record("FORM_SCHEMA_CREATE", "FORM_SCHEMA", saved.getId(), Map.of("formKey", saved.getFormKey()));
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<FormSchemaResponse> list() {
        return list(false);
    }

    @Transactional(readOnly = true)
    public List<FormSchemaResponse> list(boolean includeNonProduction) {
        return (includeNonProduction
                ? repository.findByTenantIdAndDeletedFalseOrderByUpdatedAtDesc(TenantContextHolder.getTenantId())
                : repository.findByTenantIdAndAssetOriginInAndDeletedFalseOrderByUpdatedAtDesc(
                        TenantContextHolder.getTenantId(),
                        PRODUCTION_ASSET_ORIGINS
                ))
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

    @Transactional(readOnly = true)
    public FormSchemaResponse get(String id, int version) {
        KoFormSchema schema = findCurrentSchema(id);
        if (schema.getVersion() == version) {
            return toResponse(schema);
        }
        KoFormSchemaVersion history = versionRepository
                .findByTenantIdAndFormSchemaIdAndVersionAndDeletedFalse(schema.getTenantId(), schema.getId(), version)
                .orElseThrow(() -> new BusinessException(ErrorCode.FORM_SCHEMA_NOT_FOUND, "Form schema version not found"));
        return toResponse(schema, history);
    }

    @Transactional(readOnly = true)
    public List<FormSchemaVersionResponse> listVersions(String id) {
        KoFormSchema schema = findCurrentSchema(id);
        return versionRepository
                .findByTenantIdAndFormSchemaIdAndDeletedFalseOrderByVersionDesc(schema.getTenantId(), schema.getId())
                .stream()
                .map(this::toVersionResponse)
                .toList();
    }

    @Transactional
    public FormSchemaResponse update(String id, FormSchemaRequest request) {
        validateSchemaPayload(request);
        KoFormSchema schema = findCurrentSchema(id);
        schema.setFormKey(request.formKey());
        schema.setFormName(request.formName());
        schema.setSchemaJson(request.schemaJson());
        schema.setUiSchemaJson(request.uiSchemaJson());
        schema.setVersion(schema.getVersion() + 1);
        schema.setUpdatedBy(UserContextHolder.getUserId());
        KoFormSchema saved = repository.save(schema);
        saveVersion(saved);
        auditLogService.record("FORM_SCHEMA_UPDATE", "FORM_SCHEMA", saved.getId(), Map.of(
                "formKey", saved.getFormKey(),
                "version", saved.getVersion()
        ));
        return toResponse(saved);
    }

    @Transactional
    public FormSchemaResponse restoreVersion(String id, int version) {
        KoFormSchema schema = findCurrentSchema(id);
        KoFormSchemaVersion source = versionRepository
                .findByTenantIdAndFormSchemaIdAndVersionAndDeletedFalse(schema.getTenantId(), schema.getId(), version)
                .orElseThrow(() -> new BusinessException(ErrorCode.FORM_SCHEMA_NOT_FOUND, "Form schema version not found"));
        schema.setFormKey(source.getFormKey());
        schema.setFormName(source.getFormName());
        schema.setSchemaJson(source.getSchemaJson());
        schema.setUiSchemaJson(source.getUiSchemaJson());
        schema.setVersion(schema.getVersion() + 1);
        schema.setUpdatedBy(UserContextHolder.getUserId());
        KoFormSchema saved = repository.save(schema);
        saveVersion(saved);
        auditLogService.record("FORM_SCHEMA_RESTORE_VERSION", "FORM_SCHEMA", saved.getId(), Map.of(
                "formKey", saved.getFormKey(),
                "fromVersion", version,
                "version", saved.getVersion()
        ));
        return toResponse(saved);
    }

    @Transactional
    public FormSchemaResponse activate(String id) {
        return updateStatus(id, FormStatus.ACTIVE, "FORM_SCHEMA_ACTIVATE");
    }

    @Transactional
    public FormSchemaResponse disable(String id) {
        return updateStatus(id, FormStatus.DISABLED, "FORM_SCHEMA_DISABLE");
    }

    private FormSchemaResponse updateStatus(String id, FormStatus status, String action) {
        KoFormSchema schema = findCurrentSchema(id);
        schema.setStatus(status);
        schema.setUpdatedBy(UserContextHolder.getUserId());
        KoFormSchema saved = repository.save(schema);
        auditLogService.record(action, "FORM_SCHEMA", saved.getId(), Map.of(
                "formKey", saved.getFormKey(),
                "status", saved.getStatus().name()
        ));
        return toResponse(saved);
    }

    private KoFormSchema findCurrentSchema(String id) {
        return repository.findByIdAndTenantIdAndDeletedFalse(id, TenantContextHolder.getTenantId())
                .orElseThrow(() -> new BusinessException(ErrorCode.FORM_SCHEMA_NOT_FOUND, "Form schema not found"));
    }

    private void saveVersion(KoFormSchema schema) {
        if (versionRepository.existsByTenantIdAndFormSchemaIdAndVersionAndDeletedFalse(
                schema.getTenantId(),
                schema.getId(),
                schema.getVersion()
        )) {
            return;
        }
        KoFormSchemaVersion version = new KoFormSchemaVersion();
        version.setTenantId(schema.getTenantId());
        version.setCreatedBy(UserContextHolder.getUserId());
        version.setUpdatedBy(UserContextHolder.getUserId());
        version.setFormSchemaId(schema.getId());
        version.setVersion(schema.getVersion());
        version.setFormKey(schema.getFormKey());
        version.setFormName(schema.getFormName());
        version.setSchemaJson(schema.getSchemaJson());
        version.setUiSchemaJson(schema.getUiSchemaJson());
        versionRepository.save(version);
    }

    private void validateSchemaPayload(FormSchemaRequest request) {
        JsonNode schema = readObjectNode(request.schemaJson(), "表单结构配置");
        if (!schema.has("properties") || !schema.get("properties").isObject()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "表单结构配置必须包含字段清单");
        }
        if (StringUtils.hasText(request.uiSchemaJson())) {
            readObjectNode(request.uiSchemaJson(), "表单展示配置");
        }
    }

    private JsonNode readObjectNode(String json, String label) {
        try {
            JsonNode node = objectMapper.readTree(json);
            if (node == null || !node.isObject()) {
                throw new BusinessException(ErrorCode.BAD_REQUEST, label + "必须是 JSON 对象");
            }
            return node;
        } catch (JsonProcessingException e) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, label + "不是有效 JSON");
        }
    }

    private FormSchemaResponse toResponse(KoFormSchema schema) {
        return new FormSchemaResponse(
                schema.getId(),
                schema.getFormKey(),
                schema.getFormName(),
                schema.getVersion(),
                schema.getSchemaJson(),
                schema.getUiSchemaJson(),
                schema.getStatus().name(),
                schema.getAssetOrigin().name()
        );
    }

    private FormSchemaResponse toResponse(KoFormSchema schema, KoFormSchemaVersion version) {
        return new FormSchemaResponse(
                schema.getId(),
                version.getFormKey(),
                version.getFormName(),
                version.getVersion(),
                version.getSchemaJson(),
                version.getUiSchemaJson(),
                schema.getStatus().name(),
                schema.getAssetOrigin().name()
        );
    }

    private FormSchemaVersionResponse toVersionResponse(KoFormSchemaVersion version) {
        return new FormSchemaVersionResponse(
                version.getId(),
                version.getFormSchemaId(),
                version.getVersion(),
                version.getFormKey(),
                version.getFormName(),
                version.getSchemaJson(),
                version.getUiSchemaJson(),
                version.getCreatedBy(),
                version.getCreatedAt()
        );
    }
}

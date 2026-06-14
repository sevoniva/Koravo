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
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;

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
        validateReleasePayload(request.schemaJson(), request.uiSchemaJson());
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
        if (schema.getStatus() == FormStatus.ACTIVE) {
            validateReleasePayload(request.schemaJson(), request.uiSchemaJson());
        }
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
        if (schema.getStatus() == FormStatus.ACTIVE) {
            validateReleasePayload(source.getSchemaJson(), source.getUiSchemaJson());
        }
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
        if (status == FormStatus.ACTIVE) {
            validateReleasePayload(schema.getSchemaJson(), schema.getUiSchemaJson());
        }
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

    private void validateReleasePayload(String schemaJson, String uiSchemaJson) {
        JsonNode schema = readObjectNode(schemaJson, "表单结构配置");
        JsonNode properties = schema.get("properties");
        if (properties == null || !properties.isObject() || properties.size() == 0) {
            throw releaseError("请先配置字段");
        }

        JsonNode uiSchema = StringUtils.hasText(uiSchemaJson)
                ? readObjectNode(uiSchemaJson, "表单展示配置")
                : objectMapper.createObjectNode();
        JsonNode required = schema.get("required");
        if (required != null && required.isArray()) {
            for (JsonNode item : required) {
                String fieldKey = item.asText("");
                JsonNode uiField = uiSchema.get(fieldKey);
                if (uiField != null && "hidden".equals(uiField.path("permission").asText())) {
                    throw releaseError("隐藏必填字段：" + fieldTitle(properties.get(fieldKey), fieldKey));
                }
            }
        }

        properties.properties().forEach(entry -> validateReleaseField(entry.getKey(), entry.getValue()));
    }

    private void validateReleaseField(String fieldKey, JsonNode property) {
        String title = fieldTitle(property, fieldKey);
        Integer minLength = integerValue(property.get("minLength"));
        Integer maxLength = integerValue(property.get("maxLength"));
        Double minimum = numberValue(property.get("minimum"));
        Double maximum = numberValue(property.get("maximum"));

        if (minLength != null && maxLength != null && minLength > maxLength) {
            throw releaseError(title + "的最少字符不能大于最多字符");
        }
        if (minimum != null && maximum != null && minimum > maximum) {
            throw releaseError(title + "的最小值不能大于最大值");
        }
        String pattern = textValue(property.get("pattern"));
        if (StringUtils.hasText(pattern)) {
            try {
                Pattern.compile(pattern.trim());
            } catch (PatternSyntaxException ex) {
                throw releaseError(title + "的格式正则无效");
            }
        }
    }

    private BusinessException releaseError(String message) {
        return new BusinessException(ErrorCode.BAD_REQUEST, "发布检查未通过：" + message);
    }

    private String fieldTitle(JsonNode property, String fieldKey) {
        String title = textValue(property == null ? null : property.get("title"));
        return StringUtils.hasText(title) ? title.trim() : fieldKey;
    }

    private String textValue(JsonNode node) {
        return node != null && node.isTextual() ? node.asText() : null;
    }

    private Integer integerValue(JsonNode node) {
        return node != null && node.isIntegralNumber() ? node.asInt() : null;
    }

    private Double numberValue(JsonNode node) {
        return node != null && node.isNumber() ? node.asDouble() : null;
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

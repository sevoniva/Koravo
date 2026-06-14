package io.koravo.form.domain;

import io.koravo.common.model.AssetOrigin;
import io.koravo.common.model.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

@Entity
@Table(name = "ko_form_schema")
public class KoFormSchema extends BaseEntity {
    @Column(name = "form_key", nullable = false, length = 128)
    private String formKey;

    @Column(name = "form_name", nullable = false, length = 256)
    private String formName;

    @Column(name = "version", nullable = false)
    private int version;

    @Column(name = "schema_json", nullable = false, columnDefinition = "text")
    private String schemaJson;

    @Column(name = "ui_schema_json", columnDefinition = "text")
    private String uiSchemaJson;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 64)
    private FormStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "asset_origin", nullable = false, length = 64)
    private AssetOrigin assetOrigin = AssetOrigin.USER_FLOW;

    public String getFormKey() {
        return formKey;
    }

    public void setFormKey(String formKey) {
        this.formKey = formKey;
    }

    public String getFormName() {
        return formName;
    }

    public void setFormName(String formName) {
        this.formName = formName;
    }

    public int getVersion() {
        return version;
    }

    public void setVersion(int version) {
        this.version = version;
    }

    public String getSchemaJson() {
        return schemaJson;
    }

    public void setSchemaJson(String schemaJson) {
        this.schemaJson = schemaJson;
    }

    public String getUiSchemaJson() {
        return uiSchemaJson;
    }

    public void setUiSchemaJson(String uiSchemaJson) {
        this.uiSchemaJson = uiSchemaJson;
    }

    public FormStatus getStatus() {
        return status;
    }

    public void setStatus(FormStatus status) {
        this.status = status;
    }

    public AssetOrigin getAssetOrigin() {
        return assetOrigin == null ? AssetOrigin.USER_FLOW : assetOrigin;
    }

    public void setAssetOrigin(AssetOrigin assetOrigin) {
        this.assetOrigin = assetOrigin == null ? AssetOrigin.USER_FLOW : assetOrigin;
    }
}

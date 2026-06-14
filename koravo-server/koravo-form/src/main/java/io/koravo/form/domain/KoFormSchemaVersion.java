package io.koravo.form.domain;

import io.koravo.common.model.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "ko_form_schema_version")
public class KoFormSchemaVersion extends BaseEntity {
    @Column(name = "form_schema_id", nullable = false, length = 64)
    private String formSchemaId;

    @Column(name = "version", nullable = false)
    private int version;

    @Column(name = "form_key", nullable = false, length = 128)
    private String formKey;

    @Column(name = "form_name", nullable = false, length = 256)
    private String formName;

    @Column(name = "schema_json", nullable = false, columnDefinition = "text")
    private String schemaJson;

    @Column(name = "ui_schema_json", columnDefinition = "text")
    private String uiSchemaJson;

    public String getFormSchemaId() {
        return formSchemaId;
    }

    public void setFormSchemaId(String formSchemaId) {
        this.formSchemaId = formSchemaId;
    }

    public int getVersion() {
        return version;
    }

    public void setVersion(int version) {
        this.version = version;
    }

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
}

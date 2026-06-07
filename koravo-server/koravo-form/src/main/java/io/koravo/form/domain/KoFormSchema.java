package io.koravo.form.domain;

import io.koravo.common.model.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Lob;
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

    @Lob
    @Column(name = "schema_json", nullable = false)
    private String schemaJson;

    @Lob
    @Column(name = "ui_schema_json")
    private String uiSchemaJson;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 64)
    private FormStatus status;

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
}

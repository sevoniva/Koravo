package io.koravo.form.domain;

import io.koravo.common.model.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;

@Entity
@Table(name = "ko_form_snapshot")
public class KoFormSnapshot extends BaseEntity {
    @Column(name = "process_instance_id", nullable = false, length = 128)
    private String processInstanceId;

    @Column(name = "task_id", length = 128)
    private String taskId;

    @Column(name = "form_schema_id", nullable = false, length = 64)
    private String formSchemaId;

    @Column(name = "form_schema_version")
    private Integer formSchemaVersion;

    @Lob
    @Column(name = "schema_json")
    private String schemaJson;

    @Lob
    @Column(name = "ui_schema_json")
    private String uiSchemaJson;

    @Lob
    @Column(name = "data_json", nullable = false)
    private String dataJson;

    public String getProcessInstanceId() {
        return processInstanceId;
    }

    public void setProcessInstanceId(String processInstanceId) {
        this.processInstanceId = processInstanceId;
    }

    public String getTaskId() {
        return taskId;
    }

    public void setTaskId(String taskId) {
        this.taskId = taskId;
    }

    public String getFormSchemaId() {
        return formSchemaId;
    }

    public void setFormSchemaId(String formSchemaId) {
        this.formSchemaId = formSchemaId;
    }

    public Integer getFormSchemaVersion() {
        return formSchemaVersion;
    }

    public void setFormSchemaVersion(Integer formSchemaVersion) {
        this.formSchemaVersion = formSchemaVersion;
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

    public String getDataJson() {
        return dataJson;
    }

    public void setDataJson(String dataJson) {
        this.dataJson = dataJson;
    }
}

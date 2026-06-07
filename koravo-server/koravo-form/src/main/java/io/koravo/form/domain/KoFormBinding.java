package io.koravo.form.domain;

import io.koravo.common.model.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "ko_form_binding")
public class KoFormBinding extends BaseEntity {
    @Column(name = "process_model_id", length = 64)
    private String processModelId;

    @Column(name = "process_definition_id", length = 128)
    private String processDefinitionId;

    @Column(name = "task_definition_key", nullable = false, length = 128)
    private String taskDefinitionKey;

    @Column(name = "form_schema_id", nullable = false, length = 64)
    private String formSchemaId;

    @Column(name = "form_schema_version", nullable = false)
    private int formSchemaVersion;

    public String getProcessModelId() {
        return processModelId;
    }

    public void setProcessModelId(String processModelId) {
        this.processModelId = processModelId;
    }

    public String getProcessDefinitionId() {
        return processDefinitionId;
    }

    public void setProcessDefinitionId(String processDefinitionId) {
        this.processDefinitionId = processDefinitionId;
    }

    public String getTaskDefinitionKey() {
        return taskDefinitionKey;
    }

    public void setTaskDefinitionKey(String taskDefinitionKey) {
        this.taskDefinitionKey = taskDefinitionKey;
    }

    public String getFormSchemaId() {
        return formSchemaId;
    }

    public void setFormSchemaId(String formSchemaId) {
        this.formSchemaId = formSchemaId;
    }

    public int getFormSchemaVersion() {
        return formSchemaVersion;
    }

    public void setFormSchemaVersion(int formSchemaVersion) {
        this.formSchemaVersion = formSchemaVersion;
    }
}

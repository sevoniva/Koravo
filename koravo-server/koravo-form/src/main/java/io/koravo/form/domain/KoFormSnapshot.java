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

    public String getDataJson() {
        return dataJson;
    }

    public void setDataJson(String dataJson) {
        this.dataJson = dataJson;
    }
}

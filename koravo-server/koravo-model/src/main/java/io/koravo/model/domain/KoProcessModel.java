package io.koravo.model.domain;

import io.koravo.common.model.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;

@Entity
@Table(name = "ko_process_model")
public class KoProcessModel extends BaseEntity {
    @Column(name = "model_key", nullable = false, length = 128)
    private String modelKey;

    @Column(name = "model_name", nullable = false, length = 256)
    private String modelName;

    @Column(name = "model_type", nullable = false, length = 64)
    private String modelType;

    @Column(name = "version", nullable = false)
    private int version;

    @Column(name = "flowable_deployment_id", length = 128)
    private String flowableDeploymentId;

    @Column(name = "flowable_definition_id", length = 128)
    private String flowableDefinitionId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 64)
    private ProcessModelStatus status;

    @Column(name = "description", length = 1024)
    private String description;

    @Lob
    @Column(name = "bpmn_xml")
    private String bpmnXml;

    public String getModelKey() {
        return modelKey;
    }

    public void setModelKey(String modelKey) {
        this.modelKey = modelKey;
    }

    public String getModelName() {
        return modelName;
    }

    public void setModelName(String modelName) {
        this.modelName = modelName;
    }

    public String getModelType() {
        return modelType;
    }

    public void setModelType(String modelType) {
        this.modelType = modelType;
    }

    public int getVersion() {
        return version;
    }

    public void setVersion(int version) {
        this.version = version;
    }

    public String getFlowableDeploymentId() {
        return flowableDeploymentId;
    }

    public void setFlowableDeploymentId(String flowableDeploymentId) {
        this.flowableDeploymentId = flowableDeploymentId;
    }

    public String getFlowableDefinitionId() {
        return flowableDefinitionId;
    }

    public void setFlowableDefinitionId(String flowableDefinitionId) {
        this.flowableDefinitionId = flowableDefinitionId;
    }

    public ProcessModelStatus getStatus() {
        return status;
    }

    public void setStatus(ProcessModelStatus status) {
        this.status = status;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getBpmnXml() {
        return bpmnXml;
    }

    public void setBpmnXml(String bpmnXml) {
        this.bpmnXml = bpmnXml;
    }
}

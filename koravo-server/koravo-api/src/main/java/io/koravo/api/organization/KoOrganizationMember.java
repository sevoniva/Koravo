package io.koravo.api.organization;

import io.koravo.common.model.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "ko_organization_member")
public class KoOrganizationMember extends BaseEntity {
    @Column(name = "user_id", nullable = false, length = 128)
    private String userId;

    @Column(name = "name", nullable = false, length = 256)
    private String name;

    @Column(name = "department", nullable = false, length = 256)
    private String department;

    @Column(name = "role", nullable = false, length = 64)
    private String role;

    @Column(name = "status", nullable = false, length = 64)
    private String status;

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDepartment() {
        return department;
    }

    public void setDepartment(String department) {
        this.department = department;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }
}

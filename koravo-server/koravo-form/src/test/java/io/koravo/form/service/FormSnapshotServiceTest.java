package io.koravo.form.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.koravo.form.domain.FormStatus;
import io.koravo.form.domain.KoFormSchema;
import io.koravo.form.domain.KoFormSnapshot;
import io.koravo.form.repo.FormSchemaRepository;
import io.koravo.form.repo.FormSnapshotRepository;
import io.koravo.form.web.FormSchemaResponse;
import io.koravo.security.UserContextHolder;
import io.koravo.tenant.TenantContextHolder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Map;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FormSnapshotServiceTest {
    private final FormSnapshotRepository repository = mock(FormSnapshotRepository.class);
    private final FormSchemaRepository formSchemaRepository = mock(FormSchemaRepository.class);
    private final FormSnapshotService service = new FormSnapshotService(repository, formSchemaRepository, new ObjectMapper());

    @AfterEach
    void tearDown() {
        TenantContextHolder.clear();
        UserContextHolder.clear();
    }

    @Test
    void saveSnapshotStoresSubmittedDataAndSchemaSnapshot() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");
        FormSchemaResponse schema = new FormSchemaResponse(
                "form-1",
                "leave",
                "Leave",
                2,
                "{\"type\":\"object\",\"properties\":{\"reason\":{\"type\":\"string\"}}}",
                "{\"reason\":{\"ui:widget\":\"textarea\"}}",
                "ACTIVE",
                "USER_FLOW"
        );

        service.saveSnapshot("pi-1", "task-1", "form-1", schema, Map.of("reason", "ok"));

        ArgumentCaptor<KoFormSnapshot> captor = ArgumentCaptor.forClass(KoFormSnapshot.class);
        verify(repository).save(captor.capture());
        KoFormSnapshot snapshot = captor.getValue();
        assertThat(snapshot.getTenantId()).isEqualTo("default");
        assertThat(snapshot.getCreatedBy()).isEqualTo("admin");
        assertThat(snapshot.getProcessInstanceId()).isEqualTo("pi-1");
        assertThat(snapshot.getTaskId()).isEqualTo("task-1");
        assertThat(snapshot.getFormSchemaId()).isEqualTo("form-1");
        assertThat(snapshot.getFormSchemaVersion()).isEqualTo(2);
        assertThat(snapshot.getSchemaJson()).contains("\"reason\"");
        assertThat(snapshot.getUiSchemaJson()).contains("textarea");
        assertThat(snapshot.getDataJson()).isEqualTo("{\"reason\":\"ok\"}");
    }

    @Test
    void listByProcessInstanceIncludesFormSchemaDisplayName() {
        TenantContextHolder.setTenantId("default");
        KoFormSnapshot snapshot = new KoFormSnapshot();
        snapshot.setId("snapshot-1");
        snapshot.setTenantId("default");
        snapshot.setProcessInstanceId("pi-1");
        snapshot.setTaskId("task-1");
        snapshot.setFormSchemaId("form-1");
        snapshot.setFormSchemaVersion(2);
        snapshot.setDataJson("{\"reason\":\"ok\"}");
        KoFormSchema schema = new KoFormSchema();
        schema.setId("form-1");
        schema.setTenantId("default");
        schema.setFormKey("business-request-form");
        schema.setFormName("业务申请表");
        schema.setVersion(2);
        schema.setSchemaJson("{\"type\":\"object\"}");
        schema.setStatus(FormStatus.ACTIVE);
        when(repository.findByTenantIdAndProcessInstanceIdOrderByCreatedAtAsc("default", "pi-1"))
                .thenReturn(List.of(snapshot));
        when(formSchemaRepository.findByTenantIdAndIdInAndDeletedFalse("default", List.of("form-1")))
                .thenReturn(List.of(schema));

        var snapshots = service.listByProcessInstance("pi-1");

        assertThat(snapshots).singleElement().satisfies(response -> {
            assertThat(response.formKey()).isEqualTo("business-request-form");
            assertThat(response.formName()).isEqualTo("业务申请表");
        });
    }
}

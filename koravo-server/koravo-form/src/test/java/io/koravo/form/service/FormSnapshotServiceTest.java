package io.koravo.form.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.koravo.form.domain.KoFormSnapshot;
import io.koravo.form.repo.FormSnapshotRepository;
import io.koravo.form.web.FormSchemaResponse;
import io.koravo.security.UserContextHolder;
import io.koravo.tenant.TenantContextHolder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class FormSnapshotServiceTest {
    private final FormSnapshotRepository repository = mock(FormSnapshotRepository.class);
    private final FormSnapshotService service = new FormSnapshotService(repository, new ObjectMapper());

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
                "ACTIVE"
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
}

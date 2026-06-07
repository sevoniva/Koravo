package io.koravo.form.service;

import io.koravo.form.domain.FormStatus;
import io.koravo.form.domain.KoFormSchema;
import io.koravo.form.repo.FormSchemaRepository;
import io.koravo.form.web.FormSchemaRequest;
import io.koravo.tenant.TenantContextHolder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class FormSchemaServiceTest {
    private final FormSchemaRepository repository = mock(FormSchemaRepository.class);
    private final FormSchemaService service = new FormSchemaService(repository);

    @AfterEach
    void tearDown() {
        TenantContextHolder.clear();
    }

    @Test
    void listReturnsTenantSchemas() {
        TenantContextHolder.setTenantId("default");
        KoFormSchema schema = schema("form-1", 1);
        when(repository.findByTenantIdAndDeletedFalseOrderByUpdatedAtDesc("default")).thenReturn(List.of(schema));

        var result = service.list();

        assertThat(result).hasSize(1);
        assertThat(result.getFirst().id()).isEqualTo("form-1");
    }

    @Test
    void updateIncrementsVersion() {
        TenantContextHolder.setTenantId("default");
        KoFormSchema schema = schema("form-1", 1);
        when(repository.findByIdAndTenantIdAndDeletedFalse("form-1", "default")).thenReturn(Optional.of(schema));
        when(repository.save(any(KoFormSchema.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var result = service.update("form-1", new FormSchemaRequest(
                "leave",
                "Leave Approval",
                "{\"type\":\"object\",\"required\":[\"days\"]}",
                "{}"
        ));

        assertThat(result.version()).isEqualTo(2);
        assertThat(result.formName()).isEqualTo("Leave Approval");
        assertThat(result.status()).isEqualTo("ACTIVE");
    }

    private KoFormSchema schema(String id, int version) {
        KoFormSchema schema = new KoFormSchema();
        schema.setId(id);
        schema.setTenantId("default");
        schema.setFormKey("leave");
        schema.setFormName("Leave");
        schema.setVersion(version);
        schema.setSchemaJson("{\"type\":\"object\"}");
        schema.setUiSchemaJson("{}");
        schema.setStatus(FormStatus.ACTIVE);
        return schema;
    }
}

package io.koravo.engine.dto;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ProcessTraceDTOTest {
    @Test
    void traceCarriesBpmnCurrentTasksAndTimeline() {
        ProcessTraceDTO trace = new ProcessTraceDTO(
                "pi-1",
                "pd-1",
                "biz-1",
                "RUNNING",
                "<definitions />",
                List.of("approveTask"),
                List.of(new TaskDTO("task-1", "Approve", "pi-1", "pd-1", "biz-1", null, "admin", "approveTask")),
                List.of(new ProcessTraceNodeDTO("start", "Start", "startEvent", Instant.EPOCH, Instant.EPOCH, "COMPLETED"))
        );

        assertThat(trace.bpmnXml()).contains("definitions");
        assertThat(trace.currentActivityIds()).containsExactly("approveTask");
        assertThat(trace.timeline().getFirst().status()).isEqualTo("COMPLETED");
    }
}

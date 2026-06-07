package io.koravo.engine.flowable;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;

@Disabled("Reserved for -Pintegration-test with PostgreSQL Testcontainers once CI Docker is available.")
class FlowableProcessFacadeIntegrationTest {
    @Test
    void deployStartQueryCompleteAndInspectLeaveApproval() {
        // Covered manually through examples/http/koravo.http in v0.1 bootstrap.
    }
}

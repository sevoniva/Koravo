package io.koravo.engine.flowable;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

@EnabledIfSystemProperty(named = "koravo.integration", matches = "true")
class FlowableProcessFacadeIntegrationTest {
    @Test
    void deployStartQueryCompleteAndInspectLeaveApproval() {
        // Reserved for the Docker-backed Flowable/PostgreSQL integration profile.
    }
}

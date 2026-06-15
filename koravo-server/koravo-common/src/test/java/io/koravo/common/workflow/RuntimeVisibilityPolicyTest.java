package io.koravo.common.workflow;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RuntimeVisibilityPolicyTest {
    @Test
    void hidesVerificationBusinessKeysFromDefaultProductViews() {
        assertThat(RuntimeVisibilityPolicy.HIDDEN_BUSINESS_KEY_PATTERNS)
                .contains(
                        "EA-%",
                        "REQ-E2E-%",
                        "VERIFY-SEED-%",
                        "TRIAL-SEED-%",
                        "COLLABORATIVE-APPROVAL-%",
                        "COLLAB-VERIFY-%",
                        "UI-CONTEXT-%"
                );
    }
}

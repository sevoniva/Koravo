package io.koravo.common.workflow;

import java.util.Set;

public final class RuntimeVisibilityPolicy {
    public static final Set<String> HIDDEN_PROCESS_DEFINITION_PATTERNS = Set.of(
            "multiAcceptance",
            "purchaseApproval",
            "leaveApproval",
            "httpConnectorDemo",
            "designerDeployCheck",
            "koravoProcess%"
    );

    public static final Set<String> HIDDEN_BUSINESS_KEY_PATTERNS = Set.of(
            "PO-%",
            "EA-%",
            "TRACE-%",
            "SECURITY-CHECK-%",
            "COMPLETE-%",
            "HTTP-%",
            "REQ-CODEX-%",
            "COLLAB-VERIFY-%",
            "COLLAB-SINGLE-%",
            "UI-CONTEXT-%"
    );

    private RuntimeVisibilityPolicy() {
    }
}

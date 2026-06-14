package io.koravo.model.dto;

import io.koravo.common.model.AssetOrigin;
import jakarta.validation.constraints.NotNull;

public record ProcessModelAssetOriginRequest(
        @NotNull AssetOrigin assetOrigin
) {
}

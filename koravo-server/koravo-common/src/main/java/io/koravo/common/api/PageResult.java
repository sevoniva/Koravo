package io.koravo.common.api;

import java.util.List;

public record PageResult<T>(
        List<T> items,
        long total,
        int page,
        int pageSize
) {
    public static <T> PageResult<T> of(List<T> items, long total, int page, int pageSize) {
        return new PageResult<>(items, total, page, pageSize);
    }
}

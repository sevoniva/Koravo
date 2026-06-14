package io.koravo.api.system;

import io.koravo.security.UserContextHolder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SystemHealthServiceTest {
    @AfterEach
    void tearDown() {
        UserContextHolder.clear();
    }

    @Test
    void healthMessagesDoNotExposeReleaseStageCopy() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        StringRedisTemplate redisTemplate = mock(StringRedisTemplate.class);
        when(jdbcTemplate.queryForObject("select 1", Integer.class)).thenReturn(1);
        UserContextHolder.setUser("admin", UserContextHolder.ROLE_ADMIN);

        SystemHealthService service = new SystemHealthService(jdbcTemplate, redisTemplate);
        SystemHealthResponse response = service.health();

        assertThat(response.dependencies())
                .filteredOn(item -> "minio".equals(item.key()))
                .singleElement()
                .extracting(SystemHealthResponse.SystemHealthItem::message)
                .isEqualTo("对象存储健康探测暂未启用");
    }
}

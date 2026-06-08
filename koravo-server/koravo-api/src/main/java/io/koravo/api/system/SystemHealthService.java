package io.koravo.api.system;

import io.koravo.security.UserContextHolder;
import io.koravo.tenant.TenantContextHolder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Service
public class SystemHealthService {
    private final JdbcTemplate jdbcTemplate;
    private final StringRedisTemplate redisTemplate;

    @Value("${koravo.version:0.1.0-SNAPSHOT}")
    private String version = "0.1.0-SNAPSHOT";

    public SystemHealthService(JdbcTemplate jdbcTemplate, StringRedisTemplate redisTemplate) {
        this.jdbcTemplate = jdbcTemplate;
        this.redisTemplate = redisTemplate;
    }

    public SystemHealthResponse health() {
        List<SystemHealthResponse.SystemHealthItem> dependencies = new ArrayList<>();
        dependencies.add(checkDatabase());
        dependencies.add(checkRedis());
        dependencies.add(new SystemHealthResponse.SystemHealthItem(
                "minio",
                "MinIO",
                "NOT_CONFIGURED",
                "v0.1 未接入对象存储健康探测"
        ));
        boolean up = dependencies.stream().noneMatch(item -> "DOWN".equals(item.status()));
        return new SystemHealthResponse(
                up ? "UP" : "DEGRADED",
                version,
                Instant.now(),
                TenantContextHolder.getTenantId(),
                UserContextHolder.getUserId(),
                dependencies,
                new SystemHealthResponse.WorkflowEnablementInfo(true, "配置检查接口已启用"),
                new SystemHealthResponse.UrlPolicyInfo(true, false, true, "允许 localhost；公网地址必须使用 HTTPS；拒绝内网地址")
        );
    }

    private SystemHealthResponse.SystemHealthItem checkDatabase() {
        try {
            Integer result = jdbcTemplate.queryForObject("select 1", Integer.class);
            return new SystemHealthResponse.SystemHealthItem("database", "数据库", result != null && result == 1 ? "UP" : "DOWN", "连接正常");
        } catch (Exception e) {
            return new SystemHealthResponse.SystemHealthItem("database", "数据库", "DOWN", readable(e));
        }
    }

    private SystemHealthResponse.SystemHealthItem checkRedis() {
        try {
            if (redisTemplate.getConnectionFactory() == null) {
                return new SystemHealthResponse.SystemHealthItem("redis", "Redis", "DOWN", "未配置 Redis 连接");
            }
            String result;
            try (RedisConnection connection = redisTemplate.getConnectionFactory().getConnection()) {
                result = connection.ping();
            }
            return new SystemHealthResponse.SystemHealthItem("redis", "Redis", "PONG".equalsIgnoreCase(result) ? "UP" : "DOWN", "连接正常");
        } catch (Exception e) {
            return new SystemHealthResponse.SystemHealthItem("redis", "Redis", "DOWN", readable(e));
        }
    }

    private String readable(Exception e) {
        String message = e.getMessage();
        return message == null || message.isBlank() ? "连接失败" : message;
    }
}

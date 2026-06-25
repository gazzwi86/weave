---
topic: observability
stack: java
references:
  - docs/stack-equivalents.md
---

# Micrometer + OpenTelemetry — Spring Boot 3.3: @Observed, OTLP export, logback traceId

Spring Boot 3.3 brings Micrometer Tracing 1.3 + micrometer-tracing-bridge-otel.
`@Observed` on a service method generates a span + metrics counter automatically.

```xml
<!-- pom.xml: add these four starters -->
<!-- micrometer-tracing-bridge-otel, opentelemetry-exporter-otlp,
     micrometer-registry-otlp, spring-boot-starter-aop (for @Observed) -->
```

```yaml
# application.yml
management:
  tracing:
    sampling:
      probability: 1.0           # 100 % in dev; set 0.1 in prod
  otlp:
    tracing:
      endpoint: ${OTEL_EXPORTER_OTLP_ENDPOINT:http://otel-collector:4317}
    metrics:
      export:
        url: ${OTEL_EXPORTER_OTLP_ENDPOINT:http://otel-collector:4317}/v1/metrics
        step: 30s

  observations:
    key-values:
      service.name: order-service             # added to every observation

logging:
  pattern:
    console: "%d{HH:mm:ss} %-5level [%X{traceId:-},%X{spanId:-}] %logger{36} - %msg%n"
```

```java
// OrderService.java — @Observed generates span + metric automatically
package com.example.orders;

import io.micrometer.observation.annotation.Observed;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.UUID;

@Service
public class OrderService {

    private static final Logger log = LoggerFactory.getLogger(OrderService.class);
    private final OrderRepository repo;

    public OrderService(OrderRepository repo) { this.repo = repo; }

    // @Observed creates a span named "order.create"
    // + increments micrometer counter "order.create.count"
    @Observed(name = "order.create", contextualName = "create-order")
    public Order create(CreateOrderRequest req) {
        log.info("Creating order for customer {}", req.customerId());
        // traceId and spanId appear in the log line via logback %X{traceId}
        var order = Order.newOrder(req.customerId(), req.items());
        return repo.save(order);
    }

    @Observed(name = "order.list", contextualName = "list-orders")
    public List<Order> findByCustomer(UUID customerId) {
        log.debug("Listing orders for customer {}", customerId);
        return repo.findByCustomerId(customerId);
    }
}
```

```java
// ObservationConfig.java — enable @Observed AOP
import io.micrometer.observation.ObservationRegistry;
import io.micrometer.observation.aop.ObservedAspect;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ObservationConfig {
    @Bean
    ObservedAspect observedAspect(ObservationRegistry registry) {
        return new ObservedAspect(registry);
    }
}
```

```xml
<!-- logback-spring.xml — %X{traceId} reads from MDC populated by Micrometer Tracing -->
<configuration>
  <!-- dev: human-readable with trace IDs -->
  <springProfile name="!prod">
    <appender name="CONSOLE" class="ch.qos.logback.core.ConsoleAppender">
      <encoder>
        <pattern>%d{HH:mm:ss} %-5level [%X{traceId:-none},%X{spanId:-none}] %logger{36} - %msg%n</pattern>
      </encoder>
    </appender>
    <root level="DEBUG"><appender-ref ref="CONSOLE"/></root>
  </springProfile>
  <!-- prod: JSON via logstash-logback-encoder -->
  <springProfile name="prod">
    <appender name="JSON" class="ch.qos.logback.core.ConsoleAppender">
      <encoder class="net.logstash.logback.encoder.LogstashEncoder"/>
    </appender>
    <root level="INFO"><appender-ref ref="JSON"/></root>
  </springProfile>
</configuration>
```

**Why:** `@Observed` is one annotation for a span + metrics counter + timer —
less boilerplate than manual `Tracer.startSpan()`. `%X{traceId}` in logback
uses MDC populated by Micrometer Tracing, correlating logs to traces without
code changes in every service method.

---
topic: api
stack: java
references:
  - docs/stack-equivalents.md
---

# Spring Boot 3.3 — @RestController with Records, Validation, springdoc

Java 21, Spring Boot 3.3, jakarta-validation 3.x, springdoc-openapi 2.x.
Records are the preferred DTO type; `@ControllerAdvice` centralises error mapping.

```java
// OrderController.java
package com.example.orders;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/orders")
@Tag(name = "orders", description = "Customer order management")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @Operation(summary = "List orders for a customer")
    @GetMapping
    public List<OrderResponse> listOrders(@RequestParam UUID customerId) {
        return orderService.findByCustomer(customerId);
    }

    @Operation(summary = "Create a new order")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public OrderResponse createOrder(@Valid @RequestBody CreateOrderRequest req) {
        return orderService.create(req);
    }

    @Operation(summary = "Get order by id")
    @GetMapping("/{id}")
    public OrderResponse getOrder(@PathVariable UUID id) {
        return orderService.findById(id)
                .orElseThrow(() -> new OrderNotFoundException(id));
    }
}
```

```java
// DTOs — records (Java 21)
public record CreateOrderRequest(
    @NotNull UUID customerId,
    @NotEmpty @Valid List<OrderItemRequest> items
) {}

public record OrderItemRequest(
    @NotBlank String skuId,
    @Min(1) int qty
) {}

public record OrderResponse(UUID id, UUID customerId, String status, double total) {}
```

```java
// GlobalExceptionHandler.java
@ControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.UNPROCESSABLE_ENTITY)
    public ProblemDetail handleValidation(MethodArgumentNotValidException ex) {
        var detail = ProblemDetail.forStatus(422);
        detail.setProperty("errors", ex.getBindingResult().getFieldErrors()
                .stream().map(e -> e.getField() + ": " + e.getDefaultMessage()).toList());
        return detail;
    }

    @ExceptionHandler(OrderNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ProblemDetail handleNotFound(OrderNotFoundException ex) {
        return ProblemDetail.forStatusAndDetail(404, ex.getMessage());
    }
}
```

**Why:** `ProblemDetail` (RFC 9457) is Spring Boot 3's native error format.
Records eliminate boilerplate. `@ControllerAdvice` keeps controllers clean.

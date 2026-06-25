---
topic: data
stack: java
references:
  - docs/stack-equivalents.md
---

# JPA/Hibernate — @Entity, @OneToMany, Spring Data JpaRepository, @Query

Java 21, Spring Boot 3.3, Hibernate 6. Records for DTOs; entities use classes.
`@OneToMany(cascade=ALL, orphanRemoval=true)` is the safe default for aggregates.

```java
// Order.java
package com.example.orders.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(
    name = "orders",
    indexes = {
        @Index(name = "ix_orders_customer_status", columnList = "customer_id, status")
    }
)
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "customer_id", nullable = false)
    private UUID customerId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private OrderStatus status = OrderStatus.PENDING;

    @Column(precision = 12, scale = 2, nullable = false)
    private BigDecimal total = BigDecimal.ZERO;

    @Column(name = "created_at", updatable = false, nullable = false)
    private Instant createdAt = Instant.now();

    // Cascade ALL + orphanRemoval = true-aggregate-root pattern
    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<OrderItem> items = new ArrayList<>();

    // -- factory / domain methods --------------------------------------------
    public static Order newOrder(UUID customerId, List<OrderItem> items) {
        var order = new Order();
        order.customerId = customerId;
        items.forEach(i -> { i.setOrder(order); order.items.add(i); });
        order.total = items.stream()
            .map(i -> i.getUnitPrice().multiply(BigDecimal.valueOf(i.getQty())))
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        return order;
    }

    public void confirm() {
        if (status != OrderStatus.PENDING) {
            throw new IllegalStateException("Cannot confirm order in status " + status);
        }
        this.status = OrderStatus.CONFIRMED;
    }

    // -- getters (no setters on aggregate root) ------------------------------
    public UUID getId()          { return id; }
    public UUID getCustomerId()  { return customerId; }
    public OrderStatus getStatus() { return status; }
    public BigDecimal getTotal() { return total; }
    public List<OrderItem> getItems() { return List.copyOf(items); }
}
```

```java
// OrderRepository.java
package com.example.orders.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;
import java.util.UUID;

public interface OrderRepository extends JpaRepository<Order, UUID> {

    // derived query — Spring Data generates SQL
    List<Order> findByCustomerIdOrderByCreatedAtDesc(UUID customerId);

    // custom JPQL — join fetch avoids N+1 on items
    @Query("SELECT o FROM Order o JOIN FETCH o.items WHERE o.customerId = :customerId")
    List<Order> findWithItemsByCustomerId(UUID customerId);

    // native query when JPQL is insufficient
    @Query(value = "SELECT * FROM orders WHERE status = 'pending' AND created_at < now() - interval '24 hours'",
           nativeQuery = true)
    List<Order> findStaleOrders();
}
```

**Why:** `JOIN FETCH` in `@Query` prevents lazy-loading N+1 on the `items`
collection. The aggregate-root pattern (no setters, factory method) keeps
invariants inside the entity. Records are used for DTOs; entities need classes
because Hibernate requires a no-arg constructor.

# Java — testing overlay

## Framework

- **JUnit 5** (Jupiter) — unit + integration.
- **AssertJ** — fluent assertions.
- **Mockito** — mocking at boundaries only.
- **Testcontainers** — real Postgres / Kafka / Redis in integration tests.
- **RestAssured** — API contract tests.
- **Playwright Java** or **Selenide** — browser automation (Plugin Law B).
- **Pact JVM** or **Spring Cloud Contract** — consumer-driven contracts.

## Layout

```
src/
  main/java/com/example/feature/...
  test/java/com/example/feature/
    FeatureServiceTest.java        # unit
    FeatureIntegrationTest.java    # Testcontainers
    FeatureE2ETest.java            # Playwright / RestAssured
```

## Naming

```java
class CalculateScoreTest {
  @Test void returnsZeroForEmptyNumbers() { ... }
  @Test void appliesBonusMultiplier() { ... }
  @Test void rejectsNegativeBonus() { ... }
}
```

## Coverage — JaCoCo

```xml
<plugin>
  <groupId>org.jacoco</groupId>
  <artifactId>jacoco-maven-plugin</artifactId>
  <version>0.8.12</version>
  <executions>
    <execution>
      <goals><goal>prepare-agent</goal></goals>
    </execution>
    <execution>
      <id>jacoco-check</id>
      <goals><goal>check</goal></goals>
      <configuration>
        <rules>
          <rule>
            <element>BUNDLE</element>
            <limits>
              <limit><counter>LINE</counter><value>COVEREDRATIO</value><minimum>0.80</minimum></limit>
              <limit><counter>BRANCH</counter><value>COVEREDRATIO</value><minimum>0.75</minimum></limit>
            </limits>
          </rule>
        </rules>
      </configuration>
    </execution>
  </executions>
</plugin>
```

## Integration test example (Testcontainers)

```java
@Testcontainers
@SpringBootTest
class BookRepositoryIT {
  @Container
  static PostgreSQLContainer<?> db = new PostgreSQLContainer<>("postgres:16-alpine");

  @DynamicPropertySource
  static void props(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", db::getJdbcUrl);
    r.add("spring.datasource.username", db::getUsername);
    r.add("spring.datasource.password", db::getPassword);
  }

  @Autowired BookRepository repo;

  @Test void persistsAndReadsBook() {
    var saved = repo.save(new Book("Dune", "Herbert"));
    assertThat(repo.findById(saved.id())).isPresent();
  }
}
```

## Browser automation (Plugin Law B / Law 16)

Drive the UI via Playwright Java **and** assert backend state via the JPA
repo in the same test. A green UI with no row in the DB is a Law 16 violation.

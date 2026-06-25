# Java — tooling overlay

## Build

- **Maven** (default) or **Gradle** (Kotlin DSL preferred for new projects).
- **JDK 21 LTS** baseline. Use Temurin via `brew install --cask temurin@21`.
- Maven wrapper (`./mvnw`) committed so CI and local builds match.

## Code formatting

Spotless + google-java-format runs on `mvn compile` and fails CI if drift:

```bash
./mvnw spotless:apply         # format
./mvnw spotless:check         # CI
```

## Git hooks

Use **pre-commit** framework (language-agnostic) to orchestrate:

```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: spotless
        name: spotless apply
        entry: ./mvnw spotless:apply
        language: system
        pass_filenames: false
      - id: checkstyle
        name: checkstyle
        entry: ./mvnw checkstyle:check
        language: system
        pass_filenames: false
      - id: spotbugs
        name: spotbugs
        entry: ./mvnw spotbugs:check
        language: system
        pass_filenames: false
      - id: unit-tests
        name: affected tests
        entry: ./mvnw -pl changed -am test
        language: system
        pass_filenames: false
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.21.2
    hooks:
      - id: gitleaks
```

Pre-push hook: `./mvnw verify` (full suite + integration).

## Javadoc

Public APIs require Javadoc.

```java
/**
 * Calculates the player's score from collected numbers.
 *
 * @param numbers values collected during the round
 * @param bonus   multiplier from the current phase; must be non-negative
 * @return the total score (non-negative)
 * @throws IllegalArgumentException if {@code bonus} is negative
 */
public int calculateScore(int[] numbers, double bonus) { ... }
```

## Config / secrets validation

```java
@ConfigurationProperties(prefix = "app")
@Validated
public record AppConfig(
    @NotBlank String databaseUrl,
    @NotBlank String stripeSecretKey
) {}
```

Boot fails fast if any `@NotBlank` property is missing.

## Dependency audit

`mvn org.owasp:dependency-check-maven:check` in pre-push and CI. Suppress
false positives in `owasp-suppressions.xml` with non-empty reasoning comment.

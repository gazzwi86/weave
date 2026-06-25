---
topic: ci
stack: java
references:
  - docs/stack-equivalents.md
---

# GitHub Actions — Java 21 Maven: setup-java Temurin, mvn verify, SpotBugs SARIF, Testcontainers

Temurin 21, Maven 3.9, SpotBugs SARIF upload, Testcontainers Docker-in-Docker.

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build:
    name: Build & Test (Java 21)
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Set up JDK 21 (Temurin)
        uses: actions/setup-java@v4
        with:
          java-version: "21"
          distribution: temurin
          cache: maven

      # Maven build: compile + checkstyle + test + SpotBugs
      - name: mvn verify
        run: mvn --batch-mode --no-transfer-progress verify
        env:
          TESTCONTAINERS_REUSE_ENABLE: "true"   # speed up repeated runs locally

      # SpotBugs emits SARIF when spotbugs-maven-plugin is configured with sarif format
      - name: Upload SpotBugs SARIF
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: target/spotbugsXml.sarif
          category: spotbugs

      # Surefire test report
      - name: Publish test results
        if: always()
        uses: EnricoMi/publish-unit-test-result-action@v2
        with:
          files: target/surefire-reports/*.xml

      # Cache Testcontainers images between runs
      - name: Cache Testcontainers images
        uses: actions/cache@v4
        with:
          path: ~/.testcontainers
          key: tc-${{ hashFiles('pom.xml') }}
          restore-keys: tc-
```

```xml
<!-- pom.xml snippet: SpotBugs with SARIF output -->
<plugin>
  <groupId>com.github.spotbugs</groupId>
  <artifactId>spotbugs-maven-plugin</artifactId>
  <version>4.8.6.4</version>
  <configuration>
    <effort>Max</effort>
    <threshold>Medium</threshold>
    <sarifOutput>true</sarifOutput>
    <sarifOutputFile>${project.build.directory}/spotbugsXml.sarif</sarifOutputFile>
    <includeFilterFile>spotbugs-include.xml</includeFilterFile>
  </configuration>
  <executions>
    <execution>
      <phase>verify</phase>
      <goals><goal>check</goal></goals>
    </execution>
  </executions>
</plugin>
```

```xml
<!-- spotbugs-include.xml — only flag high-signal categories -->
<FindBugsFilter>
  <Match>
    <Bug category="SECURITY"/>
  </Match>
  <Match>
    <Bug category="CORRECTNESS"/>
  </Match>
</FindBugsFilter>
```

**Why:** SARIF upload integrates SpotBugs findings into GitHub's Security tab —
no separate dashboard. `TESTCONTAINERS_REUSE_ENABLE=true` keeps containers alive
between test runs on dev machines. `--batch-mode` prevents Maven downloading
checksums interactively during CI.

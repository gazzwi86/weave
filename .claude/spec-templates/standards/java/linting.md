# Java — linting overlay

## Toolchain

- **Checkstyle** — code style + complexity (cyclomatic, nesting, method/file length).
- **PMD** — bug patterns, duplicated code, design smells.
- **SpotBugs** + **FindSecBugs** — correctness + security analysis.
- **google-java-format** (via **Spotless**) — formatter.
- **ErrorProne** — compile-time bug checking.

## Maven setup (pom.xml excerpt)

```xml
<build>
  <plugins>
    <plugin>
      <groupId>com.diffplug.spotless</groupId>
      <artifactId>spotless-maven-plugin</artifactId>
      <version>2.44.0</version>
      <configuration>
        <java><googleJavaFormat/></java>
      </configuration>
      <executions><execution><goals><goal>check</goal></goals></execution></executions>
    </plugin>

    <plugin>
      <groupId>org.apache.maven.plugins</groupId>
      <artifactId>maven-checkstyle-plugin</artifactId>
      <version>3.6.0</version>
      <configuration>
        <configLocation>checkstyle.xml</configLocation>
        <failOnViolation>true</failOnViolation>
      </configuration>
    </plugin>

    <plugin>
      <groupId>com.github.spotbugs</groupId>
      <artifactId>spotbugs-maven-plugin</artifactId>
      <version>4.8.6.6</version>
      <configuration>
        <includeFilterFile>spotbugs-include.xml</includeFilterFile>
        <plugins>
          <plugin>
            <groupId>com.h3xstream.findsecbugs</groupId>
            <artifactId>findsecbugs-plugin</artifactId>
            <version>1.13.0</version>
          </plugin>
        </plugins>
      </configuration>
    </plugin>

    <plugin>
      <groupId>org.apache.maven.plugins</groupId>
      <artifactId>maven-pmd-plugin</artifactId>
      <version>3.26.0</version>
    </plugin>
  </plugins>
</build>
```

## checkstyle.xml (complexity excerpt — Plugin Law E)

```xml
<module name="Checker">
  <module name="TreeWalker">
    <module name="CyclomaticComplexity">
      <property name="max" value="10"/>
    </module>
    <module name="MethodLength">
      <property name="max" value="50"/>
    </module>
    <module name="FileLength">
      <property name="max" value="300"/>
    </module>
    <module name="ParameterNumber">
      <property name="max" value="5"/>
    </module>
    <module name="NestedIfDepth">
      <property name="max" value="4"/>
    </module>
  </module>
</module>
```

Cognitive complexity is enforced via **SonarQube** (community edition works)
or SonarCloud integration.

## Waiver syntax

```java
@SuppressWarnings("CyclomaticComplexity") // weave: allow-complex reason="state-machine transition — 11 arms by design"
int transition(State s, Event e) { ... }
```

## Dependency audit

`mvn org.owasp:dependency-check-maven:check` on pre-push and in CI.

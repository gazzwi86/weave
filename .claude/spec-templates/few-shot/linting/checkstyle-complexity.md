---
topic: linting
stack: java
references:
  - docs/stack-equivalents.md
  - templates/standards/base/complexity.md
---

# Checkstyle + SpotBugs — Plugin Law E thresholds for Java 21

checkstyle.xml at Plugin Law E limits. SpotBugs include filter for high-signal
categories only. Both wired into Maven via plugins.

```xml
<!-- checkstyle.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE module PUBLIC
  "-//Checkstyle//DTD Checkstyle Configuration 1.3//EN"
  "https://checkstyle.org/dtds/configuration_1_3.dtd">

<module name="Checker">
  <property name="charset" value="UTF-8"/>
  <property name="severity" value="error"/>
  <property name="fileExtensions" value="java"/>

  <!-- File length ≤ 300 lines (Plugin Law E) -->
  <module name="FileLength">
    <property name="max" value="300"/>
  </module>

  <module name="TreeWalker">

    <!-- Cyclomatic complexity ≤ 10 (Plugin Law E) -->
    <module name="CyclomaticComplexity">
      <property name="max" value="10"/>
    </module>

    <!-- Method length ≤ 50 lines (Plugin Law E) -->
    <module name="MethodLength">
      <property name="max" value="50"/>
      <property name="countEmpty" value="false"/>
    </module>

    <!-- Parameters ≤ 5 (Plugin Law E) -->
    <module name="ParameterNumber">
      <property name="max" value="5"/>
      <property name="tokens" value="METHOD_DEF,CTOR_DEF"/>
    </module>

    <!-- Nesting depth ≤ 4 (Plugin Law E) -->
    <module name="NestedIfDepth">
      <property name="max" value="4"/>
    </module>
    <module name="NestedForDepth">
      <property name="max" value="3"/>
    </module>
    <module name="NestedTryDepth">
      <property name="max" value="2"/>
    </module>

    <!-- Import ordering -->
    <module name="ImportOrder">
      <property name="groups" value="java,javax,jakarta,org,com"/>
      <property name="separated" value="true"/>
      <property name="option" value="top"/>
      <property name="sortStaticImportsAlphabetically" value="true"/>
    </module>

    <!-- Basic quality -->
    <module name="VisibilityModifier"/>
    <module name="EmptyBlock"/>
    <module name="EqualsHashCode"/>
    <module name="MagicNumber">
      <property name="ignoreNumbers" value="-1, 0, 1, 2"/>
    </module>
  </module>
</module>
```

```xml
<!-- spotbugs-include.xml — high-signal bugs only -->
<FindBugsFilter>
  <Match><Bug category="SECURITY"/></Match>
  <Match><Bug category="CORRECTNESS"/></Match>
  <Match><Bug pattern="NP_NULL_ON_SOME_PATH_FROM_RETURN_VALUE"/></Match>
  <Match><Bug pattern="RCN_REDUNDANT_NULLCHECK_WOULD_HAVE_BEEN_A_NPE"/></Match>
</FindBugsFilter>
```

```xml
<!-- pom.xml snippets -->
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-checkstyle-plugin</artifactId>
  <version>3.4.0</version>
  <configuration>
    <configLocation>checkstyle.xml</configLocation>
    <failsOnError>true</failsOnError>
    <violationSeverity>error</violationSeverity>
  </configuration>
  <executions>
    <execution><phase>verify</phase><goals><goal>check</goal></goals></execution>
  </executions>
</plugin>
```

```java
// Waiver syntax (Plugin Law E)
@SuppressWarnings("checkstyle:CyclomaticComplexity")
// weave: allow-complex reason="state-machine transition — 11 arms by design"
int transition(State s, Event e) {
    return switch (s) {
        // 11 arms
        default -> throw new IllegalStateException();
    };
}
```

**Why:** Checkstyle runs at `verify` phase, so `mvn verify` fails before tests
if complexity gates are violated. SpotBugs include filter avoids noise from
low-signal categories (PERFORMANCE, STYLE) while keeping SECURITY and
CORRECTNESS mandatory.

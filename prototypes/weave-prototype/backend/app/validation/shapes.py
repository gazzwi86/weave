"""SHACL shapes encoding Weave's relationship range constraints.

These catch the "ontology hallucination" failure mode (a relationship pointing
at the wrong kind of node) flagged in the research: e.g. an LLM linking a
node's ``inDomain`` to a Service instead of a Business Domain. Keep shapes in
step with the relationship vocabulary in ``namespaces.py``.
"""

SHACL_SHAPES = """
@prefix sh:    <http://www.w3.org/ns/shacl#> .
@prefix weave: <https://weave.dev/ontology#> .
@prefix skos:  <http://www.w3.org/2004/02/skos/core#> .

weave:InDomainShape a sh:NodeShape ;
    sh:targetSubjectsOf weave:inDomain ;
    sh:property [
        sh:path weave:inDomain ;
        sh:class weave:BusinessDomain ;
        sh:severity sh:Violation ;
        sh:message "A node's domain must be a Business Domain." ] .

weave:HasCapabilityShape a sh:NodeShape ;
    sh:targetSubjectsOf weave:hasCapability ;
    sh:property [
        sh:path weave:hasCapability ;
        sh:class weave:BusinessCapability ;
        sh:severity sh:Violation ;
        sh:message "A node's capability must be a Business Capability." ] .

weave:RealizesShape a sh:NodeShape ;
    sh:targetSubjectsOf weave:realizes ;
    sh:property [
        sh:path weave:realizes ;
        sh:class weave:BusinessCapability ;
        sh:severity sh:Violation ;
        sh:message "'realizes' must point to a Business Capability." ] .

weave:DescribesShape a sh:NodeShape ;
    sh:targetSubjectsOf weave:describes ;
    sh:property [
        sh:path weave:describes ;
        sh:class skos:Concept ;
        sh:severity sh:Violation ;
        sh:message "'describes' must point to a Concept." ] .
"""

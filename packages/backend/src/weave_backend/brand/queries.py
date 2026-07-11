"""CE-BRAND-1's two fixed SPARQL SELECTs. Neither takes caller input, so
these are plain module-level constants, not query builders (contrast
`search/sparql_search.py::build_search_query`, which interpolates a search
term). `ORDER BY ?s` is load-bearing -- ADR-022 decision 3's duplicate-
`contentType` merge policy depends on a stable subject-IRI order.
"""

from __future__ import annotations

_PREFIX = "PREFIX weave: <https://weave.io/ontology/>"

TOKENS_QUERY = f"""{_PREFIX}
SELECT ?contentType ?contentBody ?sourceUri WHERE {{
  ?s a weave:BrandStandard ;
     weave:contentType ?contentType .
  OPTIONAL {{ ?s weave:contentBody ?contentBody }}
  OPTIONAL {{ ?s weave:sourceUri ?sourceUri }}
}}
ORDER BY ?s
"""

VOICE_RULES_QUERY = f"""{_PREFIX}
SELECT ?ruleId ?severity ?assertion WHERE {{
  ?s a weave:VoiceRule ;
     weave:ruleId ?ruleId ;
     weave:severity ?severity ;
     weave:assertion ?assertion .
}}
ORDER BY ?s
"""

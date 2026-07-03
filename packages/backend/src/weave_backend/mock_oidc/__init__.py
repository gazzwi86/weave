"""Local-only OIDC provider stub (PLAT-TASK-002, KEY DESIGN CALL 1).

Stands in for AWS Cognito's hosted UI until a real Cognito pool is
bootstrapped (see infra/terraform). The frontend's next-auth Cognito
provider and the backend's ``/api/auth/refresh`` point at this issuer via
``OIDC_ISSUER_URL`` in dev/test; switching to real Cognito later is an env
var change only, not a code change.
"""

# staging (not wired yet)

Not deployed this phase — no essential-only staging deploy exists yet. When
staging is needed: copy `environments/dev/{providers,variables,main}.tf` here
unchanged (module code is shared; environments vary by tfvars only) and adapt
the literal names in `providers.tf`'s `backend "s3"` block and `main.tf`'s
module arguments (`weave-dev` → `weave-staging`). Use this `staging.tfvars`
for the values.

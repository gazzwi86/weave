# prod (not wired yet)

Not deployed this phase (Law F: no cloud spend beyond the essential dev
elements). When prod is ready: copy `environments/dev/{providers,variables,main}.tf`
here unchanged and adapt the literal names (`weave-dev` → `weave-prod`) plus
the `backend "s3"` block. Use this `prod.tfvars` — note `deploy_prod_stack =
true` here, which is the whole point of a prod environment.

.PHONY: dev test lint scaffold up down migrate seed

# AC-1: (re)create the monorepo directory tree, then prove the repo still
# lints clean. Idempotent — safe to re-run on an already-scaffolded repo.
scaffold:
	mkdir -p packages/backend packages/frontend packages/shared infra/terraform
	$(MAKE) lint

# Local-first dev stack (oxigraph, postgres, localstack, redis).
# Ollama is NOT started here — run it natively on the host (ADR-011); the
# in-container Ollama is opt-in via `docker compose --profile ollama up`.
up:
	docker compose up -d

down:
	docker compose down -v

# Apply any pending Postgres migrations (run once after `make up`, before
# `make seed`/`make dev`). Safe to re-run -- tracked in `schema_migrations`.
migrate:
	cd packages/backend && uv run python -m weave_backend.db.migrate

# Idempotent demo data: one workspace, an admin + client login (both via
# mock-oidc), a small BPMO graph. Not wired into `make dev` automatically --
# run it explicitly once after `make migrate` on a fresh stack.
seed:
	cd packages/backend && uv run python -m weave_backend.db.seed_demo

# AC-2/AC-3: mock-oidc stands in for the Cognito hosted UI in dev.
# FIX 3 (P0): backend defaults to AnthropicProvider, which 502s with no API
# key -- dev points AI routing at host-native Ollama instead (ADR-011).
dev:
	cd packages/backend && WEAVE_ENV=dev WEAVE_MODEL_PROVIDER=ollama OLLAMA_MODEL=batiai/qwen3.6-27b:iq3 \
		WEAVE_SPEC_DRAFT_TIMEOUT_S=600 OLLAMA_TIMEOUT_S=300 \
		uv run uvicorn weave_backend:app --reload --port 8000 & \
	cd packages/backend && uv run weave-mock-oidc & \
	cd packages/frontend && AUTH_RATE_LIMIT_MAX=300 npm run dev

test:
	cd packages/backend && uv run pytest -m "not docker and not e2e"
	cd packages/frontend && npm test

lint:
	cd packages/backend && uv run ruff check . && uv run mypy src/ tests/
	cd packages/frontend && npm run lint && npm run typecheck

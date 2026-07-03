.PHONY: dev test lint scaffold up down

# AC-1: (re)create the monorepo directory tree, then prove the repo still
# lints clean. Idempotent — safe to re-run on an already-scaffolded repo.
scaffold:
	mkdir -p packages/backend packages/frontend packages/shared infra/terraform
	$(MAKE) lint

# Local-first dev stack (oxigraph, postgres, localstack, redis, ollama).
up:
	docker compose up -d

down:
	docker compose down -v

dev:
	cd packages/backend && uv run uvicorn weave_backend:app --reload --port 8000 & \
	cd packages/frontend && npm run dev

test:
	cd packages/backend && uv run pytest
	cd packages/frontend && npm test

lint:
	cd packages/backend && uv run ruff check . && uv run mypy src/ tests/
	cd packages/frontend && npm run lint && npm run typecheck

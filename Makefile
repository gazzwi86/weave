.PHONY: dev test lint

dev:
	cd packages/backend && uv run uvicorn weave_backend:app --reload --port 8000 & \
	cd packages/frontend && npm run dev

test:
	cd packages/backend && uv run pytest
	cd packages/frontend && npm test

lint:
	cd packages/backend && uv run ruff check . && uv run mypy src/ tests/
	cd packages/frontend && npm run lint && npm run typecheck

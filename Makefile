.PHONY: dev test lint

dev:
	cd packages/api && uv run uvicorn weave_api:app --reload --port 8000 & \
	cd packages/web && npm run dev

test:
	cd packages/api && uv run pytest
	cd packages/web && npm test

lint:
	cd packages/api && uv run ruff check . && uv run mypy src/ tests/
	cd packages/web && npm run lint && npm run typecheck

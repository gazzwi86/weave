---
topic: infra
stack: cross-stack
references:
  - docs/stack-equivalents.md
---

# Docker Compose — Local Dev: Postgres 16 + LocalStack + Mailpit + App

Healthchecks ensure dependent services start only when dependencies are ready.
Named volumes persist data across restarts. `profiles` keep optional services
out of the default `docker compose up`.

```yaml
# docker-compose.yml
name: myapp

services:

  # -- PostgreSQL 16 ----------------------------------------------------------
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER:     appuser
      POSTGRES_PASSWORD: apppass
      POSTGRES_DB:       myapp_dev
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./infra/postgres/init:/docker-entrypoint-initdb.d   # seed scripts
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U appuser -d myapp_dev"]
      interval: 5s
      timeout: 3s
      retries: 5

  # -- LocalStack (AWS services emulation) ------------------------------------
  localstack:
    image: localstack/localstack:3
    environment:
      SERVICES: s3,dynamodb,sqs,secretsmanager
      DEBUG: "0"
    volumes:
      - localstack_data:/var/lib/localstack
      - /var/run/docker.sock:/var/run/docker.sock
    ports:
      - "4566:4566"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4566/_localstack/health"]
      interval: 10s
      timeout: 5s
      retries: 10

  # -- Mailpit (SMTP catch-all) ------------------------------------------------
  mailpit:
    image: axllent/mailpit:latest
    ports:
      - "1025:1025"   # SMTP
      - "8025:8025"   # Web UI
    environment:
      MP_SMTP_AUTH_ACCEPT_ANY: "1"
      MP_SMTP_AUTH_ALLOW_INSECURE: "1"

  # -- Application ------------------------------------------------------------
  app:
    build:
      context: .
      target: development                        # multi-stage: dev target
    environment:
      DATABASE_URL:   "postgresql://appuser:apppass@postgres:5432/myapp_dev"
      AWS_ENDPOINT:   "http://localstack:4566"
      AWS_ACCESS_KEY_ID:     test
      AWS_SECRET_ACCESS_KEY: test
      AWS_REGION:            ap-southeast-2
      SMTP_HOST:      mailpit
      SMTP_PORT:      "1025"
    volumes:
      - .:/app                                   # hot-reload: mount source
      - /app/node_modules                        # don't overwrite container deps
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
      localstack:
        condition: service_healthy
    command: npm run dev

volumes:
  postgres_data:
  localstack_data:
```

```bash
# Common commands
docker compose up -d postgres localstack   # start infra only
docker compose up                          # start everything
docker compose logs -f app                 # tail app logs
docker compose down -v                     # nuke volumes (fresh start)

# Run migrations against local DB
DATABASE_URL=postgresql://appuser:apppass@localhost:5432/myapp_dev npx prisma migrate dev
```

**Why:** `condition: service_healthy` prevents the app from starting before
Postgres accepts connections — eliminates the classic race-condition startup
crash. `target: development` in the build lets the Dockerfile have a lean prod
stage without mounting source code.

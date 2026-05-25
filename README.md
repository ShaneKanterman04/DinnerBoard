# DinnerBoard

DinnerBoard is a self-hosted family dinner planner and shared grocery list. It is built for one household per install: Mom plans the week, everyone can add groceries and suggest meals, and the whole board updates live across phones and laptops.

## MVP Features

- Weekly dinner board with recipe, custom, leftovers, takeout, and undecided states
- Manual recipe book with ingredients, steps, servings, tags, and source URL
- One active shared grocery list with sections, quantities, checked items, and added-by tracking
- Recipe ingredients can be pushed to the grocery list
- Family meal suggestions with planner accept/dismiss workflow
- Invite-code onboarding and username-only return login
- Realtime updates through server-sent events
- Installable PWA shell with service worker and notification endpoint
- SQLite persistence in a Docker named volume

## Local Development

```sh
pnpm install
pnpm dev
```

The dev server listens on `0.0.0.0` by default.

Seed starter recipes:

```sh
pnpm seed
```

## Self-Hosting

```sh
docker compose up --build
```

Persistent data lives in the `dinnerboard-data` named volume. The app health endpoint is `/api/health`.

## Hostlet

This repo includes `hostlet.yml` for a Hostlet compose deployment:

```yaml
version: 1
runtime: compose
compose:
  file: compose.yaml
  web_service: web
  port: 3000
  health_path: /api/health
```

## Auth Tradeoff

DinnerBoard intentionally uses low-friction household auth: invite code for first join, then username-only login. That is good for family usability, but it is not a high-security model. Self-hosters should keep the app behind trusted access if the household data is sensitive.

## Checks

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```


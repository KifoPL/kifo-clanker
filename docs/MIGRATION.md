# TypeScript migration

The first implementation milestone from the 13 October 2026 rewrite plan is a runnable development foundation. It is not a production replacement for the original bot.

## Implemented

- Node 24 LTS, TypeScript 7.0.2, discord.js 14.27.0, ESM and strict compilation, with pinned dependencies and a reproducible lockfile.
- Explicit startup and shutdown, awaited command dispatch, safe mentions, credential-free structured logs, and liveness/readiness endpoints.
- One shared PostgreSQL pool (maximum five connections), bounded database timeouts, and one prefix cache hydrated before Discord login. Ordinary messages do not query configuration. Database prefix edits take effect after restart in this milestone.
- Transactional SQL migrations with a concurrent-run lock and immutable migration checksums.
- One non-overlapping durable scheduler with bounded concurrent batches, leases, fenced completion, expired-lease recovery and capped retries. The runtime intentionally has an empty handler registry until the corresponding features are ported. Unsupported jobs are never claimed.
- One command per file, a typed registry, and prefix help generated from migrated commands. Command deployment is a separate test-guild-only CLI.
- A non-root Docker runtime and Aspire AppHost that starts PostgreSQL, waits for migrations to succeed, then starts the bot. PostgreSQL 18 data persists in a named volume at `/var/lib/postgresql`.
- CI for typecheck, unit tests, PostgreSQL integration, compilation, AppHost compilation, and Docker build; current CodeQL and dependency-update workflows.

The legacy package, lockfile, commands, entry point, and Procfile are unchanged under `legacy/`. `legacy/docs` links to the existing documentation. Root runtime dependencies no longer include MySQL, `kifo`, Axios, Redis, or the old unused packages. The preserved legacy package still has its original dependency graph. The original package's ISC metadata disagrees with the AGPLv3 `LICENSE`; that ownership decision remains open and no license change is made here.

## Run the development runtime

Use Node 24.21.0 (the container and CI pin this release; local Node 24.19 or later is supported).

```sh
npm ci
cp .env.example .env
# Fill DISCORD_TOKEN and DATABASE_URL for a disposable PostgreSQL database and test bot.
npm run migrate
npm run check
npm run dev
```

The development, start, migration and command-deployment scripts read `.env` when it exists. Production and Aspire inject environment variables. `LOGIN_TOKEN` belongs to the legacy bot; the new bot requires `DISCORD_TOKEN`. Keep the production bot token out of migration smoke tests. Enable the Message Content intent in the test bot's Discord portal for prefix help.

`npm run build` compiles to `dist/`; `npm start` runs the compiled bot. Readiness at `/health/ready` requires Discord readiness and a successful database probe; `/health/live` reports process liveness. Both use port 8080 by default. HTTP health requests issue a database probe, unlike ordinary messages.

To register the three commands, set `DISCORD_APPLICATION_ID` and `DISCORD_TEST_GUILD_ID`, then run `npm run deploy-commands`. This replaces application commands in that test guild. It does not update global commands and must not point at a production guild during the parity work. Startup never deploys commands.

## Docker and Aspire

```sh
docker build -t kifo-clanker:dev .
# Set DATABASE_URL externally; migration must finish before the bot starts.
docker run --rm --env DATABASE_URL kifo-clanker:dev dist/scripts/migrate.js
docker run --rm --env DATABASE_URL --env DISCORD_TOKEN -p 8080:8080 kifo-clanker:dev
```

For a managed cloud build, supply the session CA with `--secret id=proxy_ca,src="$CODEX_PROXY_CERT"` when needed. The CA is mounted only during dependency installation and is not stored in the image.

Aspire requires .NET SDK 10.0.401, Aspire CLI 13.6.1 on `PATH`, and Docker. Set the secret `Parameters:discord-token` in the AppHost's user secrets. PostgreSQL's password is a secret parameter managed by Aspire. Do not put either secret in tracked configuration.

```sh
dotnet build infra/AppHost/AppHost.csproj
aspire start --apphost infra/AppHost/AppHost.csproj --non-interactive
aspire wait bot --apphost infra/AppHost/AppHost.csproj --non-interactive
aspire stop --apphost infra/AppHost/AppHost.csproj --non-interactive
```

The migration and bot containers use `database.Resource.UriExpression` as `DATABASE_URL`, not an Npgsql connection string. A failed migration prevents the bot from starting. Docker's baked liveness check applies to the bot; the migration container exits after applying migrations. Run one bot replica while gateway-event processing has no deduplication.

## Verification

```sh
npm run check
DATABASE_URL=postgresql://USER:PASSWORD@HOST/TEST_DATABASE npm run test:integration
```

The integration suite creates and drops an isolated random schema. Use a test database with schema-creation privileges. Without `DATABASE_URL`, this suite is explicitly skipped; CI supplies PostgreSQL 18.6. It checks concurrent migration locking, idempotency, rollback, checksum drift, prefix hydration, overlapping scheduler workers, expired leases, terminal attempts and unsupported job types.

Validated on 13 October 2026: clean install, strict typecheck, 21 unit tests, the PostgreSQL 18.6 integration suite (including incomplete-schema rejection), application compilation, dependency audit with zero reported vulnerabilities in the new package, AppHost compilation with zero warnings/errors, Docker build and compiled migration execution. The image runs as UID 1000 and excludes legacy code. Missing-token startup exits unsuccessfully with networking disabled. Live Discord behavior and full Aspire startup were not tested; production data import has not begun.

## Feature parity

| Legacy surface | Migrated | Remaining |
|---|---|---|
| Prefix commands (15) | help | clean, list, menu, perms, remove, stats, top, giveaway, lang, prefix, react, superslow, todo, test |
| Slash commands (19) | ping, reverse, epoch | autothreading, bookmark, countdown, cringe, error, guide, howgay, iq, poll, pp, stfu, test, threads, ticket, ticketing, urmum |
| Context menus (3) | None | detect language, save, user stats |
| Inline owner commands | None | serverlist, deploy, cmdlist (test-guild registration CLI is available) |
| Passive behavior | Prefix dispatch/help only | automatic reactions, slowmode, ticket filtering, automatic threads, reaction menus, bookmark/todo cleanup, deleted-menu restoration, mention greeting, guild lifecycle notifications, Discord-channel telemetry |
| Scheduled behavior | Scheduler infrastructure only | giveaways, role/permission restoration, menu expiry, poll completion, countdowns, presence updates |
| Persistence | guild_settings and scheduled_jobs baseline | Domain tables, repositories, settings updates, MySQL importer and reconciliation |
| Observability | Structured stdout and HTTP health | OpenTelemetry, custom spans and metrics |

Intentional changes in migrated commands: Unicode reversal preserves grapheme clusters; invalid dates, calendar rollovers and out-of-range epochs are rejected; ISO datetimes without timezone offsets use UTC. Prefix matching is case-insensitive and a bare `!kifo` displays migrated help instead of the legacy welcome. Help lists only available commands; historical categories and permission-filtered lists are pending. Slash names and existing options are retained.

## Continue the rewrite

Next, define repositories and services for moderation, menus and temporary operations, then wire their commands and scheduler handlers. Persist operation intent before Discord effects, validate permissions in the actual target channel, preserve allow/deny/inherit states, and make each scheduled handler cancellable and idempotent. Leases provide at-least-once execution; they do not guarantee exactly-once Discord messages. A handler that ignores cancellation can outlive its lease.

Inspect actual production MySQL DDL, indexes, triggers, SQL modes and timezone settings before implementing or certifying the importer. All 13 legacy tables must map to a rehearsed, reconciled PostgreSQL import. This milestone does not access or migrate production data.

After full parity: run test-guild validation, migration and rollback rehearsals, failure injection, resource measurements, Docker/Aspire startup and persistence checks, then prepare a separate production cutover. Never run both runtimes with the same production token. To run the preserved legacy bot, use its own dependencies and working directory (`cd legacy`, `npm ci`, then `node index.js`) and its original environment variables. Move any local legacy `.env` into that directory deliberately; no secrets were moved by this change.

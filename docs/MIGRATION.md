---
title: Deployment and data migration
permalink: /docs/MIGRATION/
---
{% include docs-nav.html %}

# Deployment and data migration

Kifo Clanker provides 35 native slash commands, three context menus, passive channel features, and durable scheduled workflows. Production deployment is a separate step: live Discord, provider credentials, and the actual production MySQL schema/snapshot must be validated before cutover.

## Implemented surface

| Surface | Implemented |
|---|---|
| 35 native slash commands | autothreading, bookmark, clean, cmdlist, countdown, cringe, deploy, epoch, error, giveaway, guide, help, howgay, iq, lang, list, menu, perms, ping, poll, pp, react, reload, remove, reverse, serverlist, stats, stfu, superslow, threads, ticket, ticketing, todo, top, urmum |
| 3 context menus | detect language, save, user stats |
| Owner-only slash commands, included above | /serverlist, /deploy, /cmdlist, /reload for operator configuration changes |
| Passive behavior | Auto reactions, superslow, ticket-channel filtering, automatic threads, role/permission reaction menus, note/bookmark DM deletion, deleted/bulk-deleted menu restoration, mention greeting, guild lifecycle notifications |
| Scheduled behavior | Giveaways, temporary role restoration, permission restoration, menu expiry, poll results, countdown alerts, presence refresh |
| Migration tools | Read-only MySQL export with optional DDL, all 13-table dry-run/import, canonical reconciliation, controlled failed-job retry |
| Delivery | Multi-stage non-root Docker image, persistent PostgreSQL 18.6, Aspire migration gate, CI, CodeQL, Dependabot |
| Observability | Structured stdout, optional bounded Discord log relay, liveness/readiness, OpenTelemetry command/query/job spans, latency/outcome/pool/lag/memory/event-loop/drop metrics |

Registry validation and direct handler tests check the registered command surface and structured inputs. Help, registration and generated documentation use the same registry. Each command has its own file; shared behavior is implemented in feature services.

Use `/help` or Discord's command picker. `/list server`, `/list user`, and `/list roles` cover member exports; `/stats` accepts a member or role; `/top` takes a winner count, duration, channel, and emoji. The [guides](guideList.md) explain common workflows.

Migrations use PostgreSQL’s `CREATE ... IF NOT EXISTS` and verify existing objects against the expected catalog structure. Compatible existing tables and indexes are adopted without rewriting rows or identity counters. Incompatible columns, defaults, constraints, indexes, triggers, or row-level security cause the transaction to roll back; the migrator does not guess how to repair them. Applied migration checksums remain strict.

The migration role needs `CREATE` permission on the database to create and drop a private reference schema inside its transaction. The runtime role does not need that permission. The current six migrations contain schema changes only; future data migrations need a separate validation path before using the reference-schema replay.

## Architecture and intentional corrections

Node 24 LTS, TypeScript 7.0.2, discord.js 14.27.0, ESM, strict compilation, and Biome linting replace the old runtime. One `pg.Pool` serves the entire process with at most five connections and finite connection/query/lock timeouts. Commands do not import the entry point. Imports and feature construction never connect, log in, or start polling.

Startup verifies all six migration checksums and required tables, hydrates configuration, connects Discord, resolves owner/team membership, reconciles recoverable operations, then accepts events and starts scheduling. Ordinary messages run passive features only; those features and `/help` use cached settings with zero configuration SELECTs. Configuration commands update cache after successful writes; bot owners can use `/reload` after operator database edits. Cache reload failures preserve existing feature state.

Message processing is ordered by channel, with explicit continue/handled/deleted results. Intake bounds concurrent work to 16 and pending work to 256. Saturated application commands receive an immediate retry response. Dropped menu reaction/deletion events trigger bounded durable reconciliation through the same scheduler loop. On shutdown, intake closes, unstarted work is discarded, scans/jobs cancel and drain, Discord disconnects, the pool closes, and telemetry flushes. The process enforces a 15-second shutdown deadline; unfinished leased jobs recover after restart.

Startup can be cancelled during gateway login and checks cancellation before ready hooks, command registration, and scheduler startup. Interactions received before readiness get a private retry response. Scan cancellation has a separate bounded intake so active scans cannot occupy every slot needed to cancel them.

One non-overlapping scheduler claims bounded batches using `FOR UPDATE SKIP LOCKED`, releases database connections before Discord I/O, renews leases while handlers are actually running, and fences completion by lease token and expiry. Each job completes, retries with backoff, or becomes terminal individually. Unsupported job types are not claimed. Presence refresh and overflow reconciliation share that loop.

Intentional changes and fixes:

- Native inputs retain the interaction actor and respond through Discord interactions, with private confirmation edits using the interaction webhook.
- Permissions are checked in the actual target channel, with fresh authorization after confirmation. Role changes enforce user and bot hierarchy. Temporary-operation intent and restoration jobs commit before Discord effects; permission restoration preserves allow/deny/inherit and detects later changes.
- Menus preserve preexisting roles and unrelated overwrite bits. Privileged menu creation requires the creator and bot to hold granted permissions, plus an explicit user/message/action-bound 30-second button confirmation.
- Superslow uses an atomic unique channel/user cooldown transition; concurrent messages admit exactly one transition per window.
- Top scans have cancellation, finite pagination and time limits. Cross-channel rankings and source content go only to the requester in DMs. Same-channel output remains public. Statistics support servers, members/bots, and roles; channel/message statistics are unsupported.
- Unicode reversal preserves grapheme clusters. Epoch parsing rejects impossible/out-of-range dates; ISO datetimes without offsets use UTC. Discord IDs stay decimal strings, with BigInt for deterministic calculators.
- “1 day” archive options mean 1440 minutes. Private tickets create private threads. Archive and thread visibility settings follow current Discord capabilities.
- Giveaways paginate entrants, exclude bots and persist winners before announcement. Poll/countdown/giveaway results produce new replies with stable enforced nonces and persisted result IDs. Crash recovery does not reroll winners.
- Missing integrations fail clearly. GitHub issue creation has a durable per-user throttle. User-controlled mentions are disabled by default. Attachments use bounded in-memory buffers instead of writes into the application directory.

The regression review against the original bot also covered failure and concurrency paths:

- Test Clanker command access is restricted to tester role `832194217493135400` or resolved/configured bot owners, for both slash commands and context menus.
- Source access is fetched freshly and rechecked before delivering long-running scans or saved attachments. Authorization refreshes role definitions, channel overwrites, and inherited thread-parent permissions as well as membership. Private-thread membership changes are respected; cold-start DM reaction deletion resolves the recipient before authorization.
- Moderation reserves ownership before capturing the authoritative prior state. Role restoration works after the invoking channel disappears; `/remove` and selected-channel `/clean` work from threads. Guild-wide cleanup rechecks Administrator after confirmation. Due restoration waits for an in-process mutation to settle, and expired intents cannot start a new effect. Restoration notifications try the saved channel, then the operator's DMs, without making notification failures repeat the mutation.
- Menu admission checks expiry in PostgreSQL, cancelled snapshot captures cannot grant or remove unrelated state, and partial bot users cannot join. Lost guild access preserves participant records for retries; departed members' permission snapshots remain because their overwrites survive leaving the server. Reversion reports retained unknown legacy effects for manual review. Successful grants/restorations send best-effort participant DMs after saving state; duplicate reactions do not repeat notifications.
- Scheduled results force a fresh source-message fetch. Temporary permission or guild-access loss remains retryable; computed results can reach the creator in DMs when channel delivery fails. Failed visible poll/giveaway setup cancels its domain record. Maintenance failures do not starve durable jobs, and stopping during a claim releases work without starting it.
- Automation can be disabled after the bot loses feature permissions; private tickets require the matching thread permission. Webhook authors no longer cause unnecessary member fetches, ticket starter threads avoid automatic-thread races, and reload cannot publish stale configuration over a committed command.
- Late interaction failures preserve already delivered results; failed initial delivery can still recover through the original response. Reverse rejects empty input and epoch accepts valid ISO fractional seconds. Inherited broken GIF links were replaced with verified links to the same clips.

## Local setup

Use Node 24.21.0 (container and CI pin this release; local Node 24.19+ is supported).

```sh
npm ci
cp .env.example .env
# Fill DISCORD_TOKEN and DATABASE_URL for a test bot and disposable PostgreSQL.
npm run migrate
npm run check
npm run dev
```

PostgreSQL has no `CREATE OR ALTER TABLE`. The migrator uses `CREATE TABLE IF NOT EXISTS` and catalog checks to adopt existing tables only when their structure is compatible. Incompatible types, defaults, checks, indexes, extra uniqueness, row-level security, or triggers cause a rollback without modifying those tables. Applied migration checksum drift is still rejected. The migration account needs **CREATE on the target database** to build a temporary reference schema; this is not the role’s `CREATEDB` attribute, and the runtime account needs no additional schema-creation privileges. Current migrations are schema-only; future data migrations need a separate compatibility plan.

`npm run build` emits compiled code; `npm start` runs it. Development, start, migration, registration, and import/export scripts read `.env` when present. Production and Aspire inject environment variables. Configure `DISCORD_TOKEN` for the gateway and `DATABASE_URL` for PostgreSQL. Environment values are validated before entry points open connections; validation errors identify fields without printing secrets.

Enable Discord's Message Content, Server Members, and Presence privileged intents for each deployed bot. Give it the permissions and role hierarchy required by the specific features being tested. Test users need tester role `832194217493135400`; application owners and configured operators can also use Test Clanker.

`/health/live` reports process liveness. `/health/ready` requires gateway readiness and a database probe. The default health port is 8080. Database outages affect readiness independently of liveness.

Optional configuration:

- `BOT_OWNER_IDS`: additional trusted operator IDs; application owner/accepted team members are resolved automatically.
- `LANGUAGE_DETECT_KEY`: DetectLanguage API key for language commands.
- `GITHUB_TOKEN` (or legacy `GITHUB_KEY`), `GITHUB_REPOSITORY`: issue integration, default repository `KifoPL/kifo-clanker`.
- `JOKE_API_URL`: HTTPS humor endpoint, default `https://www.yomomma.info/`.
- `DISCORD_LOG_CHANNEL_ID`: optional command/error/lifecycle relay. Logging continues through stdout if Discord is unavailable.
- `DISCORD_TEST_GUILD_ID`: test registration guild override, default `822800862581751848`.
- `DISCORD_DEPLOY_CHANNEL_ID`: startup registration status channel override; both bots default to `822800863050858541`.
- `OTEL_EXPORTER_OTLP_ENDPOINT`: HTTP/protobuf endpoint; Aspire supplies endpoint and exporter configuration.
- `SCHEDULER_PAUSED=true`: pauses scheduled execution for migration checks. Commands, passive events and startup reconciliation remain active; this is not a dry-run flag.

Startup automatically registers all 35 slash commands and three context menus after Discord login, before readiness. Authenticated Test Clanker (`796447999747948584`) replaces commands in the configured test guild; production Kifo Clanker (`795638549730295820`) replaces global commands immediately. Other bot identities do not deploy automatically. Registration failures stop startup; a failed status notification is logged without stopping a successfully registered bot. The status channels above receive the result; a channel ID is never used as the registration guild ID. Automatic registration does not require `DISCORD_APPLICATION_ID`.

For manual test-guild registration, set `DISCORD_APPLICATION_ID` and `DISCORD_TEST_GUILD_ID`, then run `npm run deploy-commands`. The owner-only `/deploy` command supports guild/global/both registration and removal through a bound confirmation. `npm run generate-docs` rebuilds [the command reference](commandList.md) without opening a database or gateway connection.

## Docker and Aspire

```sh
docker build -t kifo-clanker:dev .
docker run --rm --env DATABASE_URL kifo-clanker:dev dist/scripts/migrate.js
docker run --rm --env DATABASE_URL --env DISCORD_TOKEN -p 8080:8080 kifo-clanker:dev
```

Migrations must complete before running the bot directly. Runtime images include compiled application code and migrations, run as UID 1000, and exclude MySQL drivers, `.env`, dumps, `.git`, and host dependencies. The MySQL exporter is development tooling, run with `npm ci` locally; it is not a runtime-container command.

For a managed cloud build, supply the session CA using `--secret id=proxy_ca,src="$CODEX_PROXY_CERT"` when required. The CA exists only in dependency-install build mounts, not image layers. Keep TLS verification enabled.

Aspire requires .NET SDK 10.0.401, Aspire CLI 13.6.1 on PATH, and Docker. The file-based AppHost is `infra/AppHost/apphost.cs`; `aspire.config.json` points at this file, so `aspire run` discovers it from the repository root or `infra/AppHost`. Configure secrets with the stable ID `kifo-clanker-apphost`:

```sh
dotnet user-secrets set "Parameters:discord-token" "YOUR_TEST_BOT_TOKEN" --id kifo-clanker-apphost
```

The Discord token is read from AppHost user-secrets under `Parameters:discord-token`. Aspire automatically generates a PostgreSQL password and persists it in the same user-secrets store as `Parameters:postgres-password`, so it remains stable across restarts with the existing data volume. An existing configured password is respected; keep it if the volume was initialized with it. Do not commit secrets.

Aspire forwards optional `BOT_OWNER_IDS`, `SCHEDULER_PAUSED`, `DISCORD_TEST_GUILD_ID`, `DISCORD_DEPLOY_CHANNEL_ID`, `DISCORD_LOG_CHANNEL_ID`, `GITHUB_REPOSITORY`, and `JOKE_API_URL` from AppHost configuration. It forwards `LANGUAGE_DETECT_KEY`, `GITHUB_TOKEN`, and legacy `GITHUB_KEY` as secret parameters when configured. Leaving optional settings unset uses the bot's defaults. The AppHost does not read the bot's `.env`; set shell environment variables or values under the same keys in the `kifo-clanker-apphost` user-secrets store.

The file-based .NET/Aspire SDK and package pins require coordinated manual updates in `global.json`, `infra/AppHost/apphost.cs`, and CI. Dependabot continues checking npm, Docker, and GitHub Actions; its NuGet discovery does not support inline `.cs` package directives.

```sh
dotnet build infra/AppHost/apphost.cs
aspire start --apphost infra/AppHost/apphost.cs --non-interactive
aspire wait bot --apphost infra/AppHost/apphost.cs --non-interactive
aspire stop --apphost infra/AppHost/apphost.cs --non-interactive
```

The resource order is PostgreSQL healthy → migrations succeed → bot initializes → Discord ready. A failed migration prevents bot startup. Both application containers receive a PostgreSQL URI via `database.Resource.UriExpression`, not an Npgsql connection string. PostgreSQL 18 storage persists in the named `kifo-clanker-postgres-data` volume mounted at `/var/lib/postgresql`. Run one bot replica: job leases do not deduplicate gateway events across replicas.

## Export, import and reconcile

Use a read-only MySQL source account and take a separately recoverable backup. Set `MYSQL_SOURCE_URL` and an explicit `MYSQL_SOURCE_TIMEZONE` offset, then export to new filenames:

```sh
npm run export-mysql -- snapshot.json --ddl schema.json
npm run import-mysql -- snapshot.json --dry-run
# DATABASE_URL must point to the prepared target, with both bots stopped.
npm run migrate
npm run import-mysql -- snapshot.json --apply
npm run verify-import -- snapshot.json
```

The exporter reads all 13 tables in one read-only repeatable-read consistent snapshot, requires InnoDB for that guarantee, preserves bigint strings/date strings/BIT buffers, masks connection errors, and creates output files with mode 0600 without printing rows. Optional DDL evidence includes schema and relevant source settings. Both tools reject invalid identifiers, unknown columns, malformed dates and conflicting duplicates instead of silently discarding data.

The JSON format is `{ "timezone": "+02:00", "tables": { "prefixes": [], ... } }`, with all 13 table arrays required. Preserve snowflakes as strings. If historical local datetimes span different DST offsets, export already zoned timestamps or establish per-row offsets; a single guessed offset is not sufficient. Inspect actual production DDL, triggers, SQL modes, collations, timezone behavior, and representative sanitized rows before certifying production import. The committed fixture is synthetic, not a production dump.

| Legacy tables | Target |
|---|---|
| prefixes | guild_settings, retained source settings |
| react | auto_reactions |
| superslow, superslowusers | superslow_settings, unique superslow_cooldowns |
| ticketing, autothreading | ticket_settings, autothreading_settings |
| giveaway, polls, countdown | domain records plus completion/confirmation jobs |
| role_remove, perms | moderation_operations plus dated restoration jobs |
| menu_perms, menu_roles | menus plus dated expiry jobs |

Dry-run requires no target connection. Apply validates the entire snapshot before one transaction; conflicting target data rolls back. Identical repeated imports are idempotent. Reconciliation compares canonical rows, counts, timestamps and pending job payloads/deduplication keys; run it before enabling bot activity. Superslow's historical repeated rows collapse to the latest timestamp with an explicit report.

Two legacy gaps cannot be reconstructed automatically:

- Old permission records do not reliably record the applied state. Restoration detects unknown/conflicting state and preserves it for operator review.
- Old menus do not record creator identity or participants' prior state. Imported participants are marked unknown; existing effects are not blindly removed. Deleted/expired imported configurations remain available for reconciliation. Review imported privileged-menu configuration and historical participants before enabling it.

Failed restoration jobs retain the operation/ownership record. Diagnose the target, permissions and saved state, resolve any conflict, then use `npm run retry-job -- <failed-job-id>`. This only resets failed jobs, preserves payload/schedule, and cannot steal running leases. Never delete an unresolved intent merely to unblock a new operation.

## Release gates and rollback

Local verification covers strict compilation/lint, registry validation, authorization, privacy, cancellations, durable intent, lease recovery, retry stability, import rollback/reconciliation, bounded intake and actual HTTP/protobuf telemetry export. PostgreSQL tests use random isolated schemas and do not touch existing rows. Run them with a test database:

Release checks include unit tests, PostgreSQL 18.6 integration tests, lint, strict typecheck, compilation, a clean install, and dependency audit. Validate the Docker image and compiled migrations as UID 1000, and build the AppHost before cutover. The documentation workflow checks that the generated command reference matches the registry, builds Jekyll, and verifies local page links and anchors.

```sh
npm run check
DATABASE_URL=postgresql://USER:PASSWORD@HOST/TEST_DATABASE npm run test:integration
```

Aspire rehearsal proved successful migration gating, persistent restart, and failed-migration blocking/rollback with dummy secrets. Real Discord readiness, provider credentials, a live MySQL export, and production schema certification remain to be tested in the deployment environment. No production bot or data was used in this rewrite.

For cutover, rehearse against a restored snapshot, stop the old bot and writes, take a final backup, export/import/reconcile, then start the new deployment and monitor readiness, scheduler lag, retries and terminal jobs. Validate menu/permission reconciliation first. A paused scheduler alone does not suppress passive Discord effects.

Announcements remain at-least-once: a crash after Discord accepts a reply but before its ID is saved can cause a duplicate if retry occurs after Discord's nonce deduplication window. Winners and result snapshots remain stable. Role/permission restoration uses idempotent state checks; later changes are preserved where detectable. Discord requests can also settle after a local timeout or after the process that sent them crashes: in-process mutation/restoration coordination cannot make remote effects atomic across a restart. Inspect unresolved intents and conflicting snapshots during recovery.

Before new writes or Discord effects, rollback can restore the previous deployment. Afterwards, rollback requires reconciling new PostgreSQL state and Discord actions; simply restarting the old MySQL bot can lose changes or replay jobs.

Keep a separately recoverable copy of the previous deployment and its data before cutover. Never run two bot deployments with the same production token. The repository license is AGPLv3; see [LICENSE](https://github.com/KifoPL/kifo-clanker/blob/rewrite/LICENSE).

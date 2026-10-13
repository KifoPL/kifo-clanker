# TypeScript rewrite

The legacy command features and automation surface are implemented in the new root package through 37 native slash commands and three context menus. Text message commands and custom prefixes are disabled. Production deployment is a separate step: live Discord, provider credentials, and the actual production MySQL schema/snapshot must be validated before cutover.

## Implemented surface

| Surface | Implemented |
|---|---|
| 37 native slash commands | autothreading, bookmark, clean, cmdlist, countdown, cringe, deploy, epoch, error, giveaway, guide, help, howgay, iq, lang, list, menu, perms, ping, poll, pp, prefix, react, reload, remove, reverse, serverlist, stats, stfu, superslow, test, threads, ticket, ticketing, todo, top, urmum |
| 3 context menus | detect language, save, user stats |
| Owner-only slash commands, included above | /serverlist, /deploy, /cmdlist, /reload for operator configuration changes |
| Passive behavior | Auto reactions, superslow, ticket-channel filtering, automatic threads, role/permission reaction menus, note/bookmark DM deletion, deleted/bulk-deleted menu restoration, mention greeting, guild lifecycle notifications |
| Scheduled behavior | Giveaways, temporary role restoration, permission restoration, menu expiry, poll results, countdown alerts, presence refresh |
| Migration tools | Read-only MySQL export with optional DDL, all 13-table dry-run/import, canonical reconciliation, controlled failed-job retry |
| Delivery | Multi-stage non-root Docker image, persistent PostgreSQL 18.6, Aspire migration gate, CI, CodeQL, Dependabot |
| Observability | Structured stdout, optional bounded Discord log relay, liveness/readiness, OpenTelemetry command/query/job spans, latency/outcome/pool/lag/memory/event-loop/drop metrics |

The parity tests read the legacy source without executing it, retain every existing slash name, option path, type, and required input, and check that former text commands are registered as native slash commands. Help, registration and generated documentation use the same registry. Each command has its own file; shared behavior is implemented in feature services.

Use `/help` or Discord's command picker. Former text commands now expose structured options: `/list server`, `/list user`, and `/list roles` cover member exports; `/stats` accepts a member or role; `/top` takes a winner count, duration, channel, and emoji. `/test` keeps its original `input` and `input2` options and adds `arguments` for the former whitespace-separated argument test. `/prefix` is informational only: it explains that text prefixes are retired and makes no custom-prefix or premium-feature offer. Imported prefix values are retained for migration history and do not enable text commands.

## Architecture and intentional corrections

Node 24 LTS, TypeScript 7.0.2, discord.js 14.27.0, ESM, strict compilation, and Biome linting replace the old runtime. One `pg.Pool` serves the entire process with at most five connections and finite connection/query/lock timeouts. Commands do not import the entry point. Imports and feature construction never connect, log in, or start polling.

Startup verifies all six migration checksums and required tables, hydrates configuration, connects Discord, resolves owner/team membership, reconciles recoverable operations, then accepts events and starts scheduling. Ordinary messages run passive features only; those features and `/help` use cached settings with zero configuration SELECTs. Configuration commands update cache after successful writes; bot owners can use `/reload` after operator database edits. Cache reload failures preserve existing feature state.

Message processing is ordered by channel, with explicit continue/handled/deleted results. Intake bounds concurrent work to 16 and pending work to 256. Saturated application commands receive an immediate retry response. Dropped menu reaction/deletion events trigger bounded durable reconciliation through the same scheduler loop. On shutdown, intake closes, unstarted work is discarded, scans/jobs cancel and drain, Discord disconnects, the pool closes, and telemetry flushes. The process enforces a 15-second shutdown deadline; unfinished leased jobs recover after restart.

One non-overlapping scheduler claims bounded batches using `FOR UPDATE SKIP LOCKED`, releases database connections before Discord I/O, renews leases while handlers are actually running, and fences completion by lease token and expiry. Each job completes, retries with backoff, or becomes terminal individually. Unsupported job types are not claimed. Presence refresh and overflow reconciliation share that loop.

Intentional changes and fixes:

- Text prefix parsing, dispatch and cache loading are removed. Message events cannot invoke commands; old default/custom prefixes follow ordinary passive-message behavior. Native inputs retain the interaction actor and respond through Discord interactions, with private confirmation edits using the interaction webhook.
- Permissions are checked in the actual target channel, with fresh authorization after confirmation. Role changes enforce user and bot hierarchy. Temporary-operation intent and restoration jobs commit before Discord effects; permission restoration preserves allow/deny/inherit and detects later changes.
- Menus preserve preexisting roles and unrelated overwrite bits. Privileged menu creation requires the creator and bot to hold granted permissions, plus an explicit user/message/action-bound 30-second button confirmation.
- Superslow uses an atomic unique channel/user cooldown transition; concurrent messages admit exactly one transition per window.
- Top scans have cancellation, finite pagination and time limits. Cross-channel rankings and source content go only to the requester in DMs. Same-channel output remains public. Disabled legacy channel/message statistics remain explicitly unsupported rather than claiming invented parity.
- Unicode reversal preserves grapheme clusters. Epoch parsing rejects impossible/out-of-range dates; ISO datetimes without offsets use UTC. Discord IDs stay decimal strings, with BigInt for deterministic calculators.
- “1 day” archive options mean 1440 minutes. Private tickets create private threads. Old boost-level restrictions superseded by current Discord capabilities are removed.
- Giveaways paginate entrants, exclude bots and persist winners before announcement. Poll/countdown/giveaway results produce new replies with stable enforced nonces and persisted result IDs. Crash recovery does not reroll winners.
- Missing integrations fail clearly. GitHub issue creation has a durable per-user throttle. User-controlled mentions are disabled by default. Attachments use bounded in-memory buffers instead of writes into the application directory.

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

`npm run build` emits compiled code; `npm start` runs it. Development, start, migration, registration, and import/export scripts read `.env` when present. Production and Aspire inject environment variables. New configuration uses `DISCORD_TOKEN`; legacy `LOGIN_TOKEN` stays confined to the preserved old bot.

Enable Discord's Message Content, Server Members, and Presence privileged intents for the test bot. Give it the permissions and role hierarchy required by the specific features being tested.

`/health/live` reports process liveness. `/health/ready` requires gateway readiness and a database probe. The default health port is 8080. Database outages affect readiness independently of liveness.

Optional configuration:

- `BOT_OWNER_IDS`: additional trusted operator IDs; application owner/accepted team members are resolved automatically.
- `LANGUAGE_DETECT_KEY`: DetectLanguage API key for language commands.
- `GITHUB_TOKEN` (or legacy `GITHUB_KEY`), `GITHUB_REPOSITORY`: issue integration, default repository `KifoPL/kifo-clanker`.
- `JOKE_API_URL`: HTTPS humor endpoint, default `https://www.yomomma.info/`.
- `DISCORD_LOG_CHANNEL_ID`: optional command/error/lifecycle relay. Logging continues through stdout if Discord is unavailable.
- `OTEL_EXPORTER_OTLP_ENDPOINT`: HTTP/protobuf endpoint; Aspire supplies endpoint and exporter configuration.
- `SCHEDULER_PAUSED=true`: pauses scheduled execution for migration checks. Commands, passive events and startup reconciliation remain active; this is not a dry-run flag.

Register all 37 slash commands and three context menus in a test guild by setting `DISCORD_APPLICATION_ID` and `DISCORD_TEST_GUILD_ID`, then running `npm run deploy-commands`. This replaces that test guild's application commands. Startup never deploys commands. The owner-only `/deploy` command supports reviewed guild/global/both registration and removal through a bound confirmation. `npm run generate-docs` rebuilds [the command reference](commandList.md) without opening a database or gateway connection.

## Docker and Aspire

```sh
docker build -t kifo-clanker:dev .
docker run --rm --env DATABASE_URL kifo-clanker:dev dist/scripts/migrate.js
docker run --rm --env DATABASE_URL --env DISCORD_TOKEN -p 8080:8080 kifo-clanker:dev
```

Migrations must complete before running the bot directly. Runtime images include compiled application code and migrations, run as UID 1000, and exclude legacy code, MySQL drivers, `.env`, dumps, `.git`, and host dependencies. The MySQL exporter is development tooling, run with `npm ci` locally; it is not a runtime-container command.

For a managed cloud build, supply the session CA using `--secret id=proxy_ca,src="$CODEX_PROXY_CERT"` when required. The CA exists only in dependency-install build mounts, not image layers. Keep TLS verification enabled.

Aspire requires .NET SDK 10.0.401, Aspire CLI 13.6.1 on PATH, and Docker. Configure AppHost user secrets `Parameters:discord-token` and `Parameters:postgres-password`. Keep the PostgreSQL password stable across restarts and do not commit secrets.

```sh
dotnet build infra/AppHost/AppHost.csproj
aspire start --apphost infra/AppHost/AppHost.csproj --non-interactive
aspire wait bot --apphost infra/AppHost/AppHost.csproj --non-interactive
aspire stop --apphost infra/AppHost/AppHost.csproj --non-interactive
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
| prefixes | guild_settings, retained as migration history; text prefixes are disabled |
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

Local verification covers strict compilation/lint, registry parity, authorization, privacy, cancellations, durable intent, lease recovery, retry stability, import rollback/reconciliation, bounded intake and actual HTTP/protobuf telemetry export. PostgreSQL tests use random isolated schemas and do not touch existing rows. Run them with a test database:

Validated on 13 October 2026: 131 unit tests and six PostgreSQL 18.6 integration tests pass; lint, strict typecheck, compilation, clean install, and dependency audit (zero reported vulnerabilities in the new package) pass. The frozen Docker image builds and runs compiled migrations as UID 1000; AppHost builds with zero warnings/errors. The preserved legacy package retains its original dependency graph and is excluded from the runtime image.

```sh
npm run check
DATABASE_URL=postgresql://USER:PASSWORD@HOST/TEST_DATABASE npm run test:integration
```

Aspire rehearsal proved successful migration gating, persistent restart, and failed-migration blocking/rollback with dummy secrets. Real Discord readiness, provider credentials, a live MySQL export, and production schema certification remain to be tested in the deployment environment. No production bot or data was used in this rewrite.

For cutover, rehearse against a restored snapshot, stop the old bot and writes, take a final backup, export/import/reconcile, then start the new deployment and monitor readiness, scheduler lag, retries and terminal jobs. Validate menu/permission reconciliation first. A paused scheduler alone does not suppress passive Discord effects.

Announcements remain at-least-once: a crash after Discord accepts a reply but before its ID is saved can cause a duplicate if retry occurs after Discord's nonce deduplication window. Winners and result snapshots remain stable. Role/permission restoration uses idempotent state checks; later changes are preserved where detectable.

Before new writes or Discord effects, rollback can restore the previous deployment. Afterwards, rollback requires reconciling new PostgreSQL state and Discord actions; simply restarting the old MySQL bot can lose changes or replay jobs.

The old bot and original package/lockfile remain under `legacy/` for reference and migration review; `legacy/docs` links to existing docs. Run it only from its own directory with its own dependencies and original environment. Never run both bots with the same production token. Root `package.json` formerly claimed ISC while `LICENSE` contains AGPLv3; this rewrite does not silently relicense the project.

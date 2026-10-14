# Kifo Clanker™

<img src="docs/images/promo/new%20logo%20SQUARE%20resized.png" alt="Kifo Clanker logo" width="120" align="right">

**Top-quality unorthodox Discord commands, with a little Star Wars spirit.**

Kifo Clanker handles temporary roles, channel permissions, reaction contests, detailed stats, and conversations that deserve their own thread. Choose from **35 native slash commands and three context menus**; start with `/help` in Discord.

[Invite the bot](https://discord.com/oauth2/authorize?client_id=795638549730295820&scope=bot%20applications.commands&permissions=120528432320) · [Explore the website](https://kifopl.github.io/kifo-clanker/) · [Support server](https://discord.gg/HxUFQCxPFp)

![GitHub license](https://img.shields.io/github/license/kifopl/kifo-clanker)
![Node.js](https://img.shields.io/badge/Node.js-24_LTS-1f425f)
![TypeScript](https://img.shields.io/badge/TypeScript-7-3178c6)

## A few things your server can do

| Feature | Try it |
|---|---|
| Reaction contests, one entry per author and tied rankings | `/top winners:3 duration:7d channel:#art emoji:⭐` |
| Remove a role temporarily, with a reviewed confirmation | `/remove member:@member role:@role duration:1h` |
| Let members opt into roles or channel access | `/menu role role:@Announcements` |
| Public or private ticket threads | `/ticket title:How do I join the event?` |
| Detailed stats and filtered member exports | `/stats member:@member` · `/list roles role:@Members` |
| To-do notes, bookmarks, polls, and countdown alerts | `/todo text:Prepare the event` · message → Apps → save |

[Command reference](docs/commandList.md) · [Guides](docs/guideList.md) · [Deployment and migration](docs/MIGRATION.md)

## Run your own

The bot uses Node 24 LTS, strict TypeScript, discord.js, PostgreSQL, and a durable scheduler. Docker and Aspire orchestration, CI, telemetry, and MySQL import tools are included.

```sh
npm ci
cp .env.example .env
# Configure a test bot token and a disposable PostgreSQL database.
npm run migrate
npm run dev
```

See the [deployment guide](docs/MIGRATION.md) for command registration, permissions, provider credentials, production-data migration, and release checks. Live Discord and production-data validation are required before cutover.

The documentation keeps the original Architect theme and Kifo Clanker branding. `npm run generate-docs` rebuilds the command reference from the current registry; GitHub Actions validates the Jekyll website with its `/kifo-clanker/` project path.

## Join the community

Bring ideas, report bugs, or ask for help in the [Discord support server](https://discord.gg/HxUFQCxPFp), or [open an issue](https://github.com/KifoPL/kifo-clanker/issues/new/choose).

[Vote on top.gg](https://top.gg/bot/795638549730295820) · [Support development](https://www.buymeacoffee.com/kifoPL) · [KifoPL’s links](https://bio.link/kifopl)

For fellow Star Wars fans: [The Galactic Republic Discord](https://discord.gg/Hhp74va), [YouTube](https://www.youtube.com/channel/UC8-8TAqa9pr1aTfa5Ei83wg), and [community wiki](https://tgr-discord-server.fandom.com/wiki/TGR_Discord_Server_Wiki).

May the force be with you! — [KifoPL](https://github.com/KifoPL)

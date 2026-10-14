---
title: Automatic threads
permalink: /docs/guides/autothreading/
---
{% include docs-nav.html %}

# Automatic threads

Give each new post its own discussion thread. Run `/autothreading on` in the server text or announcement channel you want to configure, outside an existing thread.

You need **Manage Channels** and **Manage Threads**. The bot needs **View Channel**, **Send Messages**, **Send Messages in Threads**, **Create Public Threads**, **Manage Threads**, and **Manage Channels** in that channel.

## Configure the channel

For example, choose:

```text
/autothreading on title:Discuss [member]’s post archiving:1d bots:false
```

| Option | What it controls |
|---|---|
| `title` | The title template for every new thread, up to 100 characters. |
| `archiving` | Inactivity before Discord archives the thread: 1 hour, 1 day, 3 days, or 1 week. |
| `bots` | Whether bot-authored posts also receive threads. |
| `slowmode` | Optional cooldown between messages inside each new thread. |

Review and confirm the settings. To change an enabled channel, run `/autothreading off` and confirm, then enable it again with the new settings.

## Personalize thread names

| Placeholder | Replaced by |
|---|---|
| `[member]` | The author’s display name. |
| `[channel]` | The channel name, with hyphens replaced by spaces. |
| `[server]` | The server name. |
| `[embed_t]` | The first 50 characters of the first embed’s title, or `n/a`. |
| `[embed_d]` | The first 50 characters of the first embed’s description, or `n/a`. |

All occurrences are replaced. The final name is trimmed to Discord’s 100-character thread limit; an empty result becomes `Discussion`.

Use `/autothreading list` to see configured channels and `/autothreading help` to reopen this guide. Archiving follows current Discord channel capabilities; if Discord rejects a setting, check the channel and the bot’s permissions.

[Full command options](../commandList.md#autothreading) · [Managing tickets](ticketing.md)

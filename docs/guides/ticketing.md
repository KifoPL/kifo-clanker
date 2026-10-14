---
title: Setting up ticketing
permalink: /docs/guides/ticketing/
---
{% include docs-nav.html %}

# Setting up ticketing

Use ticketing for support questions, reports, or community Q&A. Configure a server text channel, then members can create threads there with `/ticket`.

Run `/ticketing on` in the parent channel, outside a thread. You need **Manage Channels** and **Manage Threads**. The bot needs **View Channel**, **Send Messages**, **Send Messages in Threads**, **Create Public Threads**, **Manage Threads**, **Manage Channels**, and **Manage Messages**. Private tickets also require the bot’s **Create Private Threads** permission and a regular text channel.

## Choose the settings

```text
/ticketing on visibility:private archiving:1d slowmode:10s
```

| Option | What it controls |
|---|---|
| `visibility` | Public threads or private threads. Private tickets include the requester. |
| `archiving` | Inactivity before Discord archives a ticket: 1 hour, 1 day, 3 days, or 1 week. |
| `slowmode` | Optional cooldown between messages inside each ticket. |

Review and confirm the configuration. The bot can then post a short member guide if you choose to confirm that extra step. To change settings, disable ticketing first with `/ticketing off`, confirm, and enable it again.

## Set channel permissions

| Audience | Permissions to allow |
|---|---|
| Members who can open tickets | View Channel, Use Application Commands, Send Messages in Threads. |
| Moderators | The permissions above, plus Send Messages, Manage Messages, Manage Threads, and the configuration permissions they need. |
| Kifo Clanker | The bot permissions listed above, including Create Private Threads for private tickets. |

The command does not change role or member overwrites for you. You can configure the parent channel so members cannot post ordinary messages while still allowing application commands and thread replies.

When ticketing is enabled, the bot removes ordinary parent-channel messages from users who do not have **Manage Channels**. Messages inside ticket threads remain available for discussion. Discord handles inactivity-based archiving.

## Check your setup

Open a ticket with a test member. Verify that the intended audience can read it, reply, and find the archived thread when needed. For private tickets, verify access with a member who was not invited.

Use `/ticketing list` to see configured channels and `/ticketing help` to reopen this guide.

[Full command options](../commandList.md#ticketing) · [Guide for members](ticket.md)

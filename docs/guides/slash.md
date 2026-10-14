---
title: Using slash commands
permalink: /docs/guides/slash/
---
{% include docs-nav.html %}

# Using slash commands

Type `/` in a Discord channel and choose **Kifo Clanker** in the command picker. Select a command, fill its required inputs, and send it. Discord describes each input and offers choices for members, roles, channels, and other values.

On desktop, use **Tab** to move between inputs. On mobile, tap an input to choose or enter its value. When several bots have the same command name, check the bot’s icon before sending.

## Find a command

Use `/help` for the overview or `/help command:top` for a particular command. `/guide` opens the guide list; its `choice` option links directly to a topic.

[Browse all commands and options](../commandList.md).

## Choose the right input

| Input | Example |
|---|---|
| Member, role, or channel | Select `@member`, `@Announcements`, or `#events` from Discord’s picker. |
| Integer | `winners:3` for `/top`. |
| True / false | `bots:false` for `/autothreading on`. |
| Duration text | `10m`, `1h`, or `7d`, within the command’s stated limits. |
| Message reference | Copy a message’s link from its context menu, or use a message ID when supported. |

A phrase with spaces belongs in a single text input: `/todo text:Prepare the next community event` creates one note.

Some commands show buttons to review a change before it happens. Check the target and duration, then confirm or cancel. Confirmation buttons belong to the person who started the command and expire if left unanswered.

## Who can see the result?

Many utility responses are visible only to you. Community features such as a giveaway, ticket, or reaction menu post the shared message in the channel. Cross-channel `/top` results go to your DMs so channel access stays private.

If a command reports missing permissions, check both your role and the bot’s permissions in the channel it is acting on. A server administrator can also control which slash commands members can use under Discord’s integration settings.

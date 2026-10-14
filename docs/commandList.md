---
title: Command reference
permalink: /docs/commandList/
---
{% include docs-nav.html %}

# Command reference

35 slash commands and 3 context menu actions, generated from the bot’s current registry.

Type `/` in Discord and choose Kifo Clanker. Options marked required must be provided; choose listed values in Discord’s command picker.

## Slash commands

[`/autothreading`](#autothreading) · [`/bookmark`](#bookmark) · [`/clean`](#clean) · [`/cmdlist`](#cmdlist) · [`/countdown`](#countdown) · [`/cringe`](#cringe) · [`/deploy`](#deploy) · [`/epoch`](#epoch) · [`/error`](#error) · [`/giveaway`](#giveaway) · [`/guide`](#guide) · [`/help`](#help) · [`/howgay`](#howgay) · [`/iq`](#iq) · [`/lang`](#lang) · [`/list`](#list) · [`/menu`](#menu) · [`/perms`](#perms) · [`/ping`](#ping) · [`/poll`](#poll) · [`/pp`](#pp) · [`/react`](#react) · [`/reload`](#reload) · [`/remove`](#remove) · [`/reverse`](#reverse) · [`/serverlist`](#serverlist) · [`/stats`](#stats) · [`/stfu`](#stfu) · [`/superslow`](#superslow) · [`/threads`](#threads) · [`/ticket`](#ticket) · [`/ticketing`](#ticketing) · [`/todo`](#todo) · [`/top`](#top) · [`/urmum`](#urmum)

### /autothreading

Set up automatic threads.

#### `/autothreading on`

Enable automatic threads.

| Option | Type | Required | Description | Choices and limits |
|---|---|---|---|---|
| `title` | Text | Yes | Title template; see help for placeholders. | Minimum length: 1 · Maximum length: 100 |
| `archiving` | Text | Yes | Inactivity before archiving. | Choices: 1 hour (`1h`), 1 day (`1d`), 3 days (`3d`), 1 week (`1w`) |
| `bots` | True / false | Yes | Create threads for bot messages. | — |
| `slowmode` | Text | No | Thread slowmode. | Choices: 5s (`5s`), 10s (`10s`), 15s (`15s`), 30s (`30s`), 1m (`1m`), 2m (`2m`), 5m (`5m`), 10m (`10m`), 15m (`15m`), 30m (`30m`), 1h (`1h`), 2h (`2h`), 6h (`6h`) |

#### `/autothreading off`

Disable automatic threads.

No options.

#### `/autothreading list`

List configured channels.

No options.

#### `/autothreading help`

Read the title template guide.

No options.

### /bookmark

Save a message and its attachments in your DMs.

| Option | Type | Required | Description | Choices and limits |
|---|---|---|---|---|
| `message` | Text | Yes | ID or URL of the message. | Maximum length: 200 |
| `pin` | True / false | No | Pin the saved message. False by default. | — |

### /clean

Delete empty permission overwrites in channels or categories.

| Option | Type | Required | Description | Choices and limits |
|---|---|---|---|---|
| `channel` | Channel | No | Channel or category to clean; defaults to this channel. | Channel types: `text`, `announcement`, `voice`, `stage`, `category`, `forum`, `media` |
| `all` | True / false | No | Clean every channel in the server; requires Administrator. | — |

### /cmdlist

Bot owner only: List registered commands.

No options.

### /countdown

Count down to a given time, then show your message.

| Option | Type | Required | Description | Choices and limits |
|---|---|---|---|---|
| `epoch` | Integer | Yes | Unix seconds; use /epoch date_to_epoch to get the number. | — |
| `message` | Text | Yes | The message to show when the countdown ends. | Maximum length: 1500 |

### /cringe

Express your feelings to another discord user with this beautiful poem.

| Option | Type | Required | Description | Choices and limits |
|---|---|---|---|---|
| `user` | Member | No | Direct your feelings towards this user. | — |

### /deploy

Bot owner only: Review and confirm command registration/removal.

| Option | Type | Required | Description | Choices and limits |
|---|---|---|---|---|
| `operation` | Text | Yes | Registration or removal scope. | Choices: guild (`guild`), global (`global`), both (`both`), delete-guild (`delete-guild`), delete-global (`delete-global`), delete-both (`delete-both`) |

### /epoch

Easily convert dates to epoch and vice versa.

#### `/epoch date_to_epoch`

Convert from date to epoch number (in seconds).

| Option | Type | Required | Description | Choices and limits |
|---|---|---|---|---|
| `input` | Text | Yes | Type a date like "1970-01-01T00:00:00Z", or a time period like "1h" | Maximum length: 100 |

#### `/epoch epoch_to_date`

Convert from epoch number (in seconds) to date.

| Option | Type | Required | Description | Choices and limits |
|---|---|---|---|---|
| `epoch` | Integer | Yes | The number of seconds since 1970-01-01T00:00:00 | — |

#### `/epoch help`

Receive a link to the guide for this command.

No options.

### /error

Report a bot problem as a GitHub issue. Do not spam.

| Option | Type | Required | Description | Choices and limits |
|---|---|---|---|---|
| `description` | Text | Yes | Describe how and when the error occurred. | Minimum length: 5 · Maximum length: 4000 |

### /giveaway

Choose random winners from users who react before a deadline.

| Option | Type | Required | Description | Choices and limits |
|---|---|---|---|---|
| `winners` | Integer | Yes | Number of distinct winners. | Minimum: 1 · Maximum: 2147483647 |
| `duration` | Text | Yes | Duration of at least 1 minute, for example 1h. | Maximum length: 100 |
| `emoji` | Text | No | Entry reaction, such as ✅ or a custom emoji. | Maximum length: 100 |

### /guide

Receive a guide link for a specific topic.

| Option | Type | Required | Description | Choices and limits |
|---|---|---|---|---|
| `choice` | Text | No | Select a topic to learn about. | Choices: Slash commands (`slash`), Context menus (`contextmenus`), Epoch converter (`epoch`), Using /ticket (`ticket`), Ticketing system (`ticketing`), Auto-threading system (`autothreading`) |

### /help

List slash commands or show command details.

| Option | Type | Required | Description | Choices and limits |
|---|---|---|---|---|
| `command` | Text | No | The command to describe. | — |
| `category` | Text | No | List commands in a category. | Choices: Management (`management`), Utility (`utility`), Fun (`fun`), Debug (`debug`) |

### /howgay

A quick test to find out your gayness level.

| Option | Type | Required | Description | Choices and limits |
|---|---|---|---|---|
| `user` | Member | No | A subject of measurement. | — |

### /iq

A very quick and accurate IQ test.

| Option | Type | Required | Description | Choices and limits |
|---|---|---|---|---|
| `user` | Member | No | A subject of measurement. | — |

### /lang

Detect a message’s language.

| Option | Type | Required | Description | Choices and limits |
|---|---|---|---|---|
| `message` | Text | Yes | Discord message ID or link. | Maximum length: 300 |

### /list

Export members or roles to a text attachment.

#### `/list server`

Export all server members.

No options.

#### `/list user`

Export a member’s roles; defaults to yourself.

| Option | Type | Required | Description | Choices and limits |
|---|---|---|---|---|
| `member` | Member | No | Server member whose roles to export. | — |

#### `/list roles`

Export members having every specified role, optionally in a channel.

| Option | Type | Required | Description | Choices and limits |
|---|---|---|---|---|
| `role` | Role | Yes | A role every result must have. | — |
| `roles` | Text | No | Additional role IDs or mentions, separated by spaces. | Maximum length: 1000 |
| `channel` | Channel | No | Only members who can view this channel. | — |

### /menu

Create or revert reaction role and permission menus.

#### `/menu help`

Show menu usage and permission aliases.

No options.

#### `/menu list`

List configured reaction menus.

No options.

#### `/menu role`

Create a reaction menu assigning a role.

| Option | Type | Required | Description | Choices and limits |
|---|---|---|---|---|
| `role` | Role | Yes | Role assigned to eligible reactors. | — |
| `duration` | Text | No | Revert the menu after this duration, for example 1d. | Maximum length: 100 |

#### `/menu permission`

Create a reaction menu granting a channel permission.

| Option | Type | Required | Description | Choices and limits |
|---|---|---|---|---|
| `permission` | Text | Yes | Permission name, legacy numeric ID, or alias. | Maximum length: 100 |
| `channel` | Channel | Yes | Channel whose permission should be granted. | Channel types: `text`, `announcement`, `voice`, `stage`, `category`, `forum`, `media` |
| `duration` | Text | No | Revert the menu after this duration, for example 1d. | Maximum length: 100 |

#### `/menu revert`

Revert a menu and restore captured participant states.

| Option | Type | Required | Description | Choices and limits |
|---|---|---|---|---|
| `message` | Text | Yes | Menu message ID or Discord link. | Maximum length: 200 |

### /perms

Inspect or change channel permission overwrites.

#### `/perms info`

Show permission aliases and check your management permissions.

No options.

#### `/perms report`

Export channel overwrites, optionally for a member or role.

| Option | Type | Required | Description | Choices and limits |
|---|---|---|---|---|
| `channel` | Channel | No | Channel or category; defaults to this channel. | Channel types: `text`, `announcement`, `voice`, `stage`, `category`, `forum`, `media` |
| `user` | Member | No | Show this member’s overwrite. | — |
| `role` | Role | No | Show this role’s overwrite. | — |

#### `/perms set`

Allow, deny, or inherit a permission for selected members or roles.

| Option | Type | Required | Description | Choices and limits |
|---|---|---|---|---|
| `permission` | Text | Yes | Permission name, legacy numeric ID, or alias. | Maximum length: 100 |
| `state` | Text | Yes | Permission overwrite state. | Choices: Allow (`allow`), Deny (`deny`), Inherit (`inherit`) |
| `user` | Member | No | Member whose overwrite should change. | — |
| `role` | Role | No | Role whose overwrite should change. | — |
| `targets` | Text | No | Additional member/role IDs or mentions, separated by spaces or commas. | Maximum length: 2000 |
| `duration` | Text | No | Restore the previous state after this duration, for example 10m. | Maximum length: 100 |
| `channel` | Channel | No | Channel or category; defaults to this channel. | Channel types: `text`, `announcement`, `voice`, `stage`, `category`, `forum`, `media` |

### /ping

...pong?

| Option | Type | Required | Description | Choices and limits |
|---|---|---|---|---|
| `reply` | Text | No | What do you want me to reply with? | Maximum length: 4000 |

### /poll

Create a poll.

| Option | Type | Required | Description | Choices and limits |
|---|---|---|---|---|
| `question` | Text | Yes | Ask the question or an opinion. | Maximum length: 1800 |
| `timeout` | Text | Yes | When to calculate results? Use "0" for no timeout. | Maximum length: 100 |
| `one` | Text | Yes | Option 1 | Maximum length: 150 |
| `two` | Text | Yes | Option 2 | Maximum length: 150 |
| `three` | Text | No | Option 3 | Maximum length: 150 |
| `four` | Text | No | Option 4 | Maximum length: 150 |
| `five` | Text | No | Option 5 | Maximum length: 150 |
| `six` | Text | No | Option 6 | Maximum length: 150 |
| `seven` | Text | No | Option 7 | Maximum length: 150 |
| `eight` | Text | No | Option 8 | Maximum length: 150 |
| `nine` | Text | No | Option 9 | Maximum length: 150 |
| `ten` | Text | No | Option 10 | Maximum length: 150 |

### /pp

Measure your PP length with this totally reliable pp length calculator.

| Option | Type | Required | Description | Choices and limits |
|---|---|---|---|---|
| `user` | Member | No | A subject of measurement. | — |

### /react

Configure automatic reactions.

#### `/react on`

Enable automatic reactions in this channel.

| Option | Type | Required | Description | Choices and limits |
|---|---|---|---|---|
| `emojis` | Text | Yes | 1–20 emojis separated by spaces. | Minimum length: 1 · Maximum length: 2000 |

#### `/react off`

Disable automatic reactions.

No options.

#### `/react status`

Show reactions configured in this channel.

No options.

#### `/react list`

List automatic reactions in this server.

No options.

### /reload

Bot owner only: Reload cached settings.

No options.

### /remove

Remove a member role permanently or for a chosen duration.

| Option | Type | Required | Description | Choices and limits |
|---|---|---|---|---|
| `member` | Member | Yes | Member whose role should be removed. | — |
| `role` | Role | Yes | Role to remove. | — |
| `duration` | Text | No | Restore after this duration, for example 10m or 2d. | Maximum length: 100 |

### /reverse

This command reverses anything you type.

| Option | Type | Required | Description | Choices and limits |
|---|---|---|---|---|
| `text` | Text | Yes | The text to reverse | Minimum length: 1 · Maximum length: 4096 |
| `silent` | True / false | No | Whether to show the result to only you, or everyone. False by default. | — |

### /serverlist

Bot owner only: List connected servers.

No options.

### /stats

Show server, member/bot, or role statistics.

| Option | Type | Required | Description | Choices and limits |
|---|---|---|---|---|
| `member` | Member | No | Member whose statistics to show. | — |
| `role` | Role | No | Role whose statistics to show; choose either member or role. | — |

### /stfu

An eloquent way to ask someone to lower their voice.

| Option | Type | Required | Description | Choices and limits |
|---|---|---|---|---|
| `user` | Member | No | Direct your feelings towards this user. | — |

### /superslow

Configure long message cooldowns.

#### `/superslow set`

Set the cooldown in this channel.

| Option | Type | Required | Description | Choices and limits |
|---|---|---|---|---|
| `duration` | Text | Yes | Duration from 6h to 1y. | Minimum length: 1 · Maximum length: 100 |

#### `/superslow off`

Disable cooldowns and clear their history.

No options.

#### `/superslow status`

Show the cooldown in this channel.

No options.

#### `/superslow list`

List cooldowns in this server.

No options.

### /threads

Manage threads in this channel.

#### `/threads archive`

Archive oldest active threads.

| Option | Type | Required | Description | Choices and limits |
|---|---|---|---|---|
| `count` | Text | Yes | Number of oldest threads. | Choices: All (`all`), 3 (`3`), 5 (`5`), 10 (`10`), 25 (`25`) |
| `silent` | True / false | No | Only you see the result. | — |

#### `/threads delete`

Delete oldest threads.

| Option | Type | Required | Description | Choices and limits |
|---|---|---|---|---|
| `count` | Text | Yes | Number of oldest threads. | Choices: All (`all`), 3 (`3`), 5 (`5`), 10 (`10`), 25 (`25`) |
| `which` | Text | Yes | Which threads? | Choices: Archived (`archived`), Active (`active`), Both (`both`) |
| `silent` | True / false | No | Only you see the result. | — |

### /ticket

Create a ticket.

| Option | Type | Required | Description | Choices and limits |
|---|---|---|---|---|
| `title` | Text | Yes | Your question or problem. | Minimum length: 1 · Maximum length: 256 |
| `description` | Text | No | Additional details. | Maximum length: 4000 |

### /ticketing

Set up ticketing in this channel.

#### `/ticketing on`

Enable tickets.

| Option | Type | Required | Description | Choices and limits |
|---|---|---|---|---|
| `visibility` | Text | Yes | Ticket visibility. | Choices: Public (`public`), Private (`private`) |
| `archiving` | Text | Yes | Inactivity before archiving. | Choices: 1 hour (`1h`), 1 day (`1d`), 3 days (`3d`), 1 week (`1w`) |
| `slowmode` | Text | No | Ticket slowmode. | Choices: 5s (`5s`), 10s (`10s`), 15s (`15s`), 30s (`30s`), 1m (`1m`), 2m (`2m`), 5m (`5m`), 10m (`10m`), 15m (`15m`), 30m (`30m`), 1h (`1h`), 2h (`2h`), 6h (`6h`) |

#### `/ticketing off`

Disable tickets.

No options.

#### `/ticketing list`

List configured channels.

No options.

#### `/ticketing help`

Read the ticketing guide.

No options.

### /todo

Send yourself a pinned to-do note in DMs.

| Option | Type | Required | Description | Choices and limits |
|---|---|---|---|---|
| `text` | Text | No | Your task description. | Maximum length: 4000 |
| `link` | Text | No | Discord message ID or link to include in the note. | Maximum length: 300 |

### /top

Rank unique authors by a reaction in a channel over a time period.

| Option | Type | Required | Description | Choices and limits |
|---|---|---|---|---|
| `winners` | Integer | Yes | Number of winning posts, including ties at the cutoff. | Minimum: 1 · Maximum: 10 |
| `duration` | Text | Yes | Time period between 10s and 14d. | Maximum length: 100 |
| `channel` | Channel | Yes | Channel to scan; cross-channel results are sent by DM. | Channel types: `text`, `announcement`, `public thread`, `private thread`, `voice`, `stage` |
| `emoji` | Text | Yes | Unicode emoji, custom emoji, or custom emoji ID. | Maximum length: 100 |

### /urmum

Random yo momma joke.

No options.

## Context menus

Open a message or member’s context menu, choose **Apps**, then select the action.

### detect language

Target: **message**. Detect the selected message’s language. The result is visible only to you.

### save

Target: **message**. Send yourself a DM copy of the selected message and its attachments. React with ❌ to delete the copy.

### user stats

Target: **server member**. Show the selected server member’s account, roles, presence, and other statistics privately.

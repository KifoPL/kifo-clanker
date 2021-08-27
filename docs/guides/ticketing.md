# How to use `/ticketing` and how to set up channel permissions?
> This guide covers what the command does and how to configure ticketing for your server.<br/>
> For command syntax, click [here](../commandList.md#ticketing).

## Table of Contents:

- [How to use `/ticketing` and how to set up channel permissions?](#how-to-use-ticketing-and-how-to-set-up-channel-permissions)
	- [Table of Contents:](#table-of-contents)
	- [What is a `ticketing system`?](#what-is-a-ticketing-system)
	- [How to use `ticketing system`?](#how-to-use-ticketing-system)
	- [Prerequisites for `/ticketing`](#prerequisites-for-ticketing)
	- [Server prerequisites](#server-prerequisites)
	- [What `/ticketing` does and doesn't](#what-ticketing-does-and-doesnt)
		- [This command **does**:](#this-command-does)
		- [This command **does not**:](#this-command-does-not)
	- [How to disable `/ticketing`](#how-to-disable-ticketing)
	- [Miscellaneous](#miscellaneous)
	- [What should users know when entering the `ticketing` channel?](#what-should-users-know-when-entering-the-ticketing-channel)
		- [If you want to change a few small details, here's a raw text (with Discord-ready formatting):](#if-you-want-to-change-a-few-small-details-heres-a-raw-text-with-discord-ready-formatting)

## What is a `ticketing system`?

- `Ticketing system` enables users to create `tickets` with `title` (`Problem`/`Question`) and optional `description`.
- `Ticket` is a new thread for people to answer questions about the issue.

## How to use `ticketing system`?

**Ideally**, the ticketing system is enabled in a `Text Channel`, where no one can send a normal message (the bot auto-deletes messages from non-moderators) - ticket creation is done through the `/ticket` command, which works only in channels with `/ticketing` enabled.<br/>
Although the intended use is to ask questions for moderators and receive answers, this could be also a system for any `Q&A` channels, or other uses that require threading.

## Prerequisites for `/ticketing`

Your channel should have these permissions:
- `@everyone` (or the role that will be able to use `/ticket`):
	- `ALLOW`: `VIEW_CHANNEL`, `USE_APPLICATION_COMMANDS`, `USE_PUBLIC_THREADS` or `USE_PRIVATE_THREADS` (see note below).
- `Moderators` and `Kifo Clanker`:
	- `ALLOW`: `SEND_MESSAGES`, `MANAGE_CHANNELS`, `MANAGE_THREADS`, `MANAGE_MESSAGES`, `USE_APPLICATION_COMMANDS`.

**NOTE**: If you want to set `Public` visibility, users will need `USE_PUBLIC_THREADS`. For `Private` it's `USE_PRIVATE_THREADS`.

## Server prerequisites

Not all options are available to all servers. Because of the way threads are implemented, for longer archive periods and private threads a server must have a certain boost level.
- Level 0 *(No boosts)*:
	- Ticket visibility: `Public`
	- Archivisation time-span: `1 hour`, `1 day`
- Level 1 *(2 boosts)*:
	- Ticket visibility: `Public`
	- Archivisation time-span: `1 hour`, `1 day`, `3 days`
- Level 2 *(15 boosts)*:
	- Ticket visibility: `Public`, `Private`
	- Archivisation time-span: `1 hour`, `1 day`, `3 days`, `1 week`

## What `/ticketing` does and doesn't

### This command **does**:

- Enable usage of `/ticket` in a channel.
- Automatically delete all messages that:
	- Are not sent by `Kifo Clanker`.
	- Author does not have `MANAGE_CHANNELS` and it's not a `/ticket` command.
- Set visibility, archive, and slow-mode settings for every `/ticket`.
- *(optional)* Send a message to the channel explaining how to use `/ticket`.
- Send **you** a private message explaining how to set up permissions in this channel.

### This command **does not**:

- Change permissions of any roles/members.
- Change the slow-mode of the channel.
- Auto-archive threads (this is done automatically by Discord itself).
- Send dank memes :(

## How to disable `/ticketing`

Simply use the `/ticketing off` command, provided you have the following permissions: `MANAGE_CHANNELS`, `MANAGE_THREADS`.

## Miscellaneous

- To list all channels where `/ticketing` is enabled, simply run `/ticketing list`.
- To get a link to this site, run `/ticketing help`.

## What should users know when entering the `ticketing` channel?

> *This is the message the bot pastes, should you choose that option.*

**This channel has __`tickets`__ enabled**.
1. If you have a question or a problem that needs solving, type `/ticket` to create a ticket.
2. Then, in `title`, ask the question, or state the problem.
3. If you need to provide additional details, that's what `description` is for!

**Friendly tips:** *(not required, but they help to get the answer you're looking for!)*
- **Try to find an answer yourself** *(90% of the questions have their answer somewhere in the rules or other generally accessible channels)*.
- **Keep your `titles` brief** *(the perfect title is straight to the point - people love answering simple questions, so try to make it look simple)*.
- **Skip all unnecessary details** *(people often find it disappointing when a giant wall of the text leads to small and easy questions)*.
- **Describe the origin of your problem/question** *(What topic/category brought you to this channel? Where did you expect to find an answer?)*.

And the most important one: __**Don't forget to thank the person for answering!**__ They didn't have to, yet they *chose* to help you. Share kindness everywhere you can.

> *Still confused? Type `/guide Using /ticket` for even more details.*

### If you want to change a few small details, here's a raw text (with Discord-ready formatting):

```
**This channel has __`tickets`__ enabled**.
1. If you have a question or a problem that needs solving, type `/ticket` to create a ticket.
2. Then, in `title`, ask the question, or state the problem.
3. If you need to provide additional details, that's what `description` is for!

**Friendly tips:** *(not required, but they help to get the answer you're looking for!)*
- **Try to find an answer yourself** *(90% of the questions have their answer somewhere in the rules or other generally accessible channels)*.
- **Keep your `titles` brief** *(the perfect title is straight to the point - people love answering simple questions, so try to make it look simple)*.
- **Skip all unnecessary details** *(people often find it disappointing when a giant wall of the text leads to small and easy questions)*.
- **Describe the origin of your problem/question** *(What topic/category brought you to this channel? Where did you expect to find an answer?)*.

And the most important one: __**Don't forget to thank the person for answering!**__ They didn't have to, yet they *chose* to help you. Share kindness everywhere you can.

> *Still confused? Type `/guide Using /ticket` for even more details.*
```

<hr/>

~by [KifoPL](https://bio.link/KifoPL)
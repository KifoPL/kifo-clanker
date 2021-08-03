# How to use `/ticketing` and how to set up channel permissions?
> This guide covers what the command does and how to configure ticketing for your server.<br/>
> For command syntax, click [here](../commandList.md#ticketing).

## What is `ticketing system`?

- `Ticketing system` enables users to create `tickets` with `title` (`Problem`/`Question`) and optional `description`.
- `Ticket` is a new thread for people to answer questions about the issue.

## How to use `ticketing system`?

**Ideally**, ticketing system is enabled in a `Text Channel`, where no one can send normal message (the bot auto-deletes messages from non-moderators) - ticket creation is done through `/ticket` command, that works only in channels with `/ticketing` enabled.<br/>
Although the intended use is to ask questions for moderators and receive answers, this could be also a system for any `Q&A` channels, or other uses that require threadding.

## Prerequisites for `/ticketing`

Your channel should have these permissions:
- `@everyone` (or the role that will be able to use `/ticket`):
	- `ALLOW`: `VIEW_CHANNEL`, `USE_SLASH_COMMANDS`, `USE_PUBLIC_THREADS` or `USE_PRIVATE_THREADS` (see note below).
- `Moderators` and `Kifo Clanker`:
	- `ALLOW`: `SEND_MESSAGES`, `MANAGE_CHANNELS`, `MANAGE_THREADS`, `MANAGE_MESSAGES`, `USE_SLASH_COMMANDS`.

**NOTE**: If you want to set `Public` visibility, users will need `USE_PUBLIC_THREADS`. For `Private` it's `USE_PRIVATE_THREADS`.

## Server prerequisities

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
- Set visibility, archive and slowmode settings for every `/ticket`.
- *(optional)* Send a message to the channel explaining how to use `/ticket`.
- Send **you** a private message explaining how to set up permissions in this channel.

### This command **does not**:
- Change permissions of any roles / members.
- Change slowmode of the channel.
- Auto-archive threads (this is done automatically by Discord itself).
- Send dank memes :(

## How to disable `/ticketing`

Simply use `/ticketing off` command, provided you have the following permissions: `MANAGE_CHANNELS`, `MANAGE_THREADS`.

## Miscellanous
- To list all channels where `/ticketing` is enabled, simply run `/ticketing list`.
- To get link to this site, run `/ticketing help`.

## What should users know when entering `ticketing` channel?
> *This is the message the bot pastes, should you choose that option.*

**This channel has __`tickets`__ enabled**.
1. If you have a question or a problem that needs solving, type `/ticket` to create a ticket.
2. Then, in `title`, ask the question, or state the problem.
3. If you need to provide additional details, that's what `description` is for!

**Friendly tips:** *(not required, but they definitely help getting the answer you're looking for!)*
- **Try to find an answer yourself** *(90% of the questions have their answer somewhere in the rules, or other generally accessible channels)*.
- **Keep your `titles` brief** *(perfect title is straight to the point - people love answering simple questions, so try to make it look simple)*.
- **Skip all unnecessary details** *(people often find it disappointing when a giant wall of text leads to small and easy question)*.
- **Describe the origin of your problem/question** *(What topic/category brought you to this channel? Where did you expect to find an answer?)*.

And most important one: __**Don't forget to thank the person for answering!**__ They didn't have to, yet they *chose* to help you. Share kindness everywhere you can.

> *Still confused? Type `/guide Using /ticket` for even more details.*

## If you want to change a few small details, here's a raw text (with Discord-ready formatting):
```
**This channel has __`tickets`__ enabled**.
1. If you have a question or a problem that needs solving, type `/ticket` to create a ticket.
2. Then, in `title`, ask the question, or state the problem.
3. If you need to provide additional details, that's what `description` is for!

**Friendly tips:** *(not required, but they definitely help getting the answer you're looking for!)*
- **Try to find an answer yourself** *(90% of the questions have their answer somewhere in the rules, or other generally accessible channels)*.
- **Keep your `titles` brief** *(perfect title is straight to the point - people love answering simple questions, so try to make it look simple)*.
- **Skip all unnecessary details** *(people often find it disappointing when a giant wall of text leads to small and easy question)*.
- **Describe the origin of your problem/question** *(What topic/category brought you to this channel? Where did you expect to find an answer?)*.

And most important one: __**Don't forget to thank the person for answering!**__ They didn't have to, yet they *chose* to help you. Share kindness everywhere you can.

> *Still confused? Type `/guide Using /ticket` for even more details.*
```
<hr/>

~by [KifoPL](https://bio.link/KifoPL)
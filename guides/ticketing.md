# How to use `/ticketing` and how to set up channel permissions?
> This guide covers what the command does and how to configure ticketing for your server.<br/>
> For command syntax, click [here](../commandList.md#ticketing).

## What is `ticketing system`?

- `Ticketing system` enables users to create `tickets` with `title` (`Problem`/`Question`) and optional `description`.
- `Ticket` is a new thread for people to answer questions about the issue.

## How to use `ticketing system`?

**Ideally**, ticketing system is enabled in a `Text Channel`, where no one can send normal message (`SEND_MESSAGES` is set to `DENY` for `@everyone`) - ticket creation is done through `/ticket` command, that works only in channels with `/ticketing` enabled.<br/>
Although the intended use is to ask questions for moderators and receive answers, this could be also a system for any `Q&A` channels, or other uses that require threadding.

## Prerequisites for `/ticketing`

You should have a channel with these permissions:
- `@everyone` (or the role that will be able to use `/ticket`):
	- `ALLOW`: `VIEW_CHANNEL`, `USE_SLASH_COMMANDS`, `USE_PUBLIC_THREADS` or `USE_PRIVATE_THREADS` (more on that below)
	- `DENY`: `SEND_MESSAGES`
- `Moderators` and `Kifo Clanker`:
	- `ALLOW`: `SEND_MESSAGES`, `MANAGE_CHANNELS`, `MANAGE_THREADS`, `USE_SLASH_COMMANDS`

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

This command **does**:
- Enable usage of `/ticket` in a channel.
- Set visibility, archive and slowmode settings for every `/ticket`.
- *(optional)* Send a message to the channel explaining how to use `/ticket`.
- Send **you** a private message explaining how to set up permissions in this channel.

This command **does not**:
- Change permissions of any roles / members.
- Change slowmode of the channel.
- Auto-archive threads (this is done automatically by Discord itself).
- Send dank memes :(

## How to disable `/ticketing`

Simply use `/ticketing off` command, provided you have the following permissions: `MANAGE_CHANNELS`, `MANAGE_THREADS`.
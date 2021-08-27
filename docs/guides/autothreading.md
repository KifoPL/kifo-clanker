# How to use `/autothreading`?

> This guide covers what the command does and how to configure ticketing for your server.<br/>
> For command syntax, click [here](../commandList.md#autothreading).

## Table of Contents:

- [How to use `/autothreading`?](#how-to-use-autothreading)
	- [Table of Contents:](#table-of-contents)
	- [What is `auto-threading`?](#what-is-auto-threading)
	- [How to use `autothreading system`?](#how-to-use-autothreading-system)
	- [Setting `title` for threads](#setting-title-for-threads)
		- [Examples:](#examples)
	- [Server prerequisites](#server-prerequisites)
	- [How to disable `/autothreading`](#how-to-disable-autothreading)
	- [Miscellaneous](#miscellaneous)

## What is `auto-threading`?

- `Auto-threading` automatically creates a thread under every message sent in the channel.
- A thread will be automatically created under every **USER** message, or **USER** and **BOT** message (depending on the settings).

## How to use `autothreading system`?

Issuing `/autothreading on` requires a few important options to configure. Let's go through all of them:
- `title` - this is the title of every newly created thread. Because this option is more than static text, more details can be found [below](#setting-title-for-threads).
- `archiving` - sets auto-archive feature. More on that [here](#server-prerequisities).
- `bots` - decides whether `bot` messages should also have threads. `True` will create threads upon `bot` messages, `false` will not.
- `slowmode` *(optional)* - what slow-mode should be enabled by default in 

## Setting `title` for threads

Usually, having the same title for every thread is not the expected outcome. You may want to include the author's name, or otherwise personalize it. Hence there are `5` ways to make your threads alive:
- `[member]` - will be replaced by the user's display name (nickname, or username if not set).
- `[channel]` - will be replaced by channel name (with `-` replaced as ` `).
- `[server]` - will be replaced by server name.
- `[embed_t]` - will be replaced by embed title (first `50` characters, `n/a` if there is no embed).
- `[embed_d]` - will be replaced by embed description (first `50` characters, `n/a` if there is no embed).

**NOTES**:
- Maximum thread title is `200` characters, so any longer titles will be trimmed to `197` characters with appended `...`.
- Some characters *(like `'`)* are not allowed in the `title`, and they're automatically removed by Discord. I am unsure myself, which characters **can** be used, so I advise trying out thread titles beforehand.
- If you think there should be more options, please contact me (my links at the bottom of every guide).

### Examples:

- `[member] new feature poll discussion in [channel]!`
	- `KifoPL - Bot Creator new feature poll discussion in new features polls!`
- `Thoughts on new update in [server]`
	- `Thoughts on new update in Kifo Clanker™ Support Server`
- `This is an example of how horribly long thread names will be shortened to the allowed length if by any chance thread title will be longer than the 200 characters. As you see by this example, 200 characters are all you need to fit the longest titles.`
	- `This is an example of how horribly long thread names will be shortened to the allowed length if by any chance thread title will be longer than the 200 characters. As you see by this example, 200 ch...`

## Server prerequisites

Not all options are available to all servers. Because of the way threads are implemented, for longer archive periods a server must have a certain boost level.
- Level 0 *(No boosts)*:
	- Archivisation time-span: `1 hour`, `1 day`
- Level 1 *(2 boosts)*:
	- Archivisation time-span: `1 hour`, `1 day`, `3 days`
- Level 2 *(15 boosts)*:
	- Archivisation time-span: `1 hour`, `1 day`, `3 days`, `1 week`

## How to disable `/autothreading`

Simply use the `/autothreading off` command, provided you have the following permissions: `MANAGE_CHANNELS`, `MANAGE_THREADS`.

## Miscellaneous

- To list all channels where `/autothreading` is enabled, simply run `/autothreading list`.
- To get a link to this site, run `/autothreading help`.


<hr/>

~by [KifoPL](https://bio.link/KifoPL)
# How to use `/autothreading`?
> This guide covers what the command does and how to configure ticketing for your server.<br/>
> For command syntax, click [here](../commandList.md#autothreading).

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
Usually, having the same title for every thread is not the expected outcome. You may want to include author's name, or otherwise perosnalize it. Hence there are `3` ways to make your threads live:
- `[member]` - will be replaced by user's display name (nickname, or username if not set).
- `[channel]` - will be replaced by channel name (with `-` replaced as ` `).
- `[server]` - will be replaced by server name.

**NOTES**:
- Maximum thread title is `100` characters, so any longer titles will be trimmed to `97` characters with appended `...`.
- Some characters *(like `'`)* are not allowed in the `title`, and they're automatically removed by Discord. I am unsure myself, which characters **can** be used, so I advise trying out thread titles beforehand.
- If you think there should be more options, please contact me (my links at the bottom of every guide).
### Examples:
- `[member] new feature poll discussion in [channel]!`
	- `KifoPL - Bot Creator new feature poll discussion in new features polls!`
- `Thoughts on new update in [server]`
	- `Thoughts on new update in Kifo Clanker™ Support Server`
- `This is an example on how absolutely, horribly long thread names will be shortened to the allowed length`
	- `This is an example on how absolutely, horribly long thread names will be shortened to the allowe...`

## Server prerequisities
Not all options are available to all servers. Because of the way threads are implemented, for longer archive periods a server must have a certain boost level.
- Level 0 *(No boosts)*:
	- Archivisation time-span: `1 hour`, `1 day`
- Level 1 *(2 boosts)*:
	- Archivisation time-span: `1 hour`, `1 day`, `3 days`
- Level 2 *(15 boosts)*:
	- Archivisation time-span: `1 hour`, `1 day`, `3 days`, `1 week`

## How to disable `/autothreading`
Simply use `/autothreading off` command, provided you have the following permissions: `MANAGE_CHANNELS`, `MANAGE_THREADS`.

## Miscellanous
- To list all channels where `/autothreading` is enabled, simply run `/autothreading list`.
- To get link to this site, run `/autothreading help`.


<hr/>

~by [KifoPL](https://bio.link/KifoPL)
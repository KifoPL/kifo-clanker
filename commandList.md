# List of Commands:
> Remember to add server prefix before command syntax.

### help

- This command lists all categories of commands and shows help for every command.
- Usage:
- `help` - lists all available commands
- `help <category>` - lists all commands for a specific category
- `help <command>` - shows help for specific command
## DEBUG

### error

- If this bot encountered an error anywhere, please type this command right after. It will ping me (KifoPL#3358).
WARNING! If you spam this command for no reason, you will get warned on the same premise as spam pinging. Use only when encountering actual errors.
- Usage:
	- `error <optional_description>` - pings <@289119054130839552> with optionally provided description.
- Required user permissions: SEND_MESSAGES

### ping

- This is a ping command :)
- Usage:
	- `ping` - responds with a pong :)
- Required user permissions: SEND_MESSAGES

### test

- This is just to test the functionality of the bot, as well as perms settings.
- Usage:
	- `test` - tests if the bot is online and checks for various stuff to find potential issues.
- Required user permissions: SEND_MESSAGES

## FUN

### cringe

- Express your feelings to another discord user with this beautiful poem.
- Usage:
	- `cringe <optional_user>` - informs user of their cringe level.
- Required user permissions: SEND_MESSAGES

### howgay

- A quick test to find out your gayness level.
- Usage:
	- `howgay <optional_user>` - accurately measures sexual thirst towards the same gender.
- Required user permissions: SEND_MESSAGES

### iq

- A very quick and accurate IQ test.
- Usage:
	- `iq <optional_user>` - A quick and reliable IQ test.
- Required user permissions: SEND_MESSAGES

### pp

- Measure your PP length with this totally reliable pp length calculator. Each user has his own constant pp length (like irl), it's not random.
- Usage:
	- `pp <optional_user>` - absolutely accurate measurement of pp length.
- Required user permissions: SEND_MESSAGES

### reverse

- This command reverses anything you type.
- Usage:
	- `reverse <text>` - reverses the text.
- Required user permissions: SEND_MESSAGES

### stfu

- This is an eloquent way to say "Thank you for this conversation we've had".
- Usage:
	- `stfu <optional_user>` - ask someone to lower their voice to the sub-audible level in an elegant manner.
- Required user permissions: SEND_MESSAGES

## MANAGEMENT

### list

- Lists all users in the server, or users having certain role.
To list more than 1000 users you need `MANAGE_GUILD` perms.
If the bot doesn't see some channels, lists ~~may~~ will be incorrect.
- Usage:
	- `list` - lists all users in the server
	- `list <user>` - lists roles of specified user.
	- `list <role> <optional_role2> <optional_role_n>` - lists users that have all specified roles.
- Required user permissions: SEND_MESSAGES, MANAGE_GUILD

### perms

- This powerful command manages permissions for channels and categories.
- **ADD** - allows a perm (green check), 
- **DENY** - denies a perm (red x),
- **RM** - removes a perm (grey /).
- Usage:
	- `perms <add/rm/deny> <perm> <role_or_user_id_1> ... <role_or_user_id_n>` - adds/removes/denies perms for provided users and roles in this channel. <perm> can be either full name, id (number), or alias of a perm.
	- `perms` - checks if you have permissions to manage channel, lists aliases and IDs of permissions for easier cmd usage.
	- `perms <channel_or_category_id>` - lists perms of all roles and members in a `.txt` file
	- `perms "here"/"list"` - list perms of all roles and members for this channel in a `.txt` file
	- `perms <user_or_role_id>` - lists perms for specific user/role
- Required user permissions: SEND_MESSAGES, MANAGE_CHANNELS

### stats

- Displays stats for given user, bot, role, server, ~~channel~~, ~~message~~ (in development).
If the bot doesn't see some channels, stats ~~may~~ will be incorrect.
- Usage:
	- `stats` - shows stats of the server
	- `stats <user>` - shows stats of specified user.
	- `stats <role>` - shows stats of specified role.
	- `stats me` - shows your stats.
- Required user permissions: SEND_MESSAGES

## UTILITY

### prefix

- This command informs you in detail how you can change server prefix.
- Usage:
	- `prefix` - sends a DM with details on prefix change process.
- Required user permissions: SEND_MESSAGES

### react

- This command tells the bot to react to all messages in the channel with specific reactions.
- Usage:
	- `react on <emote1> <optional_emote2> ... <optional_emoten>` - turns on react command in this channel.
	- `react off` - turns off react command in this channel
	- `react` checks if there is react module online.
	- `react list` lists channels in which the command is active.
- Required user permissions: SEND_MESSAGES, MANAGE_CHANNELS

### superslow

- Enable Super slow-mode (longer than 6 hours) for channels where you need it.
- Usage:
	- `superslow <time>` - turns on superslow command in this channel (setting time to 0s will turn off superslow module). 
	- `superslow` checks if there is superslow module online.
	- `superslow list` lists channels in which the command is active.
- Required user permissions: SEND_MESSAGES, MANAGE_CHANNELS

### todo

- This command allows you to create a simple todo notes.
- Usage:
	- `todo <description>` - sends a DM with description (react with any emote to the message to delete it).
- Required user permissions: SEND_MESSAGES

### top

- This command lists x messages with most reactions from other channel.
- Usage:
	- `top <x> <time_period> <other_channel> <reaction>` - lists top x messages with most reactions from other channel. Sends x embeds (don't set it too large).
- Required user permissions: SEND_MESSAGES, MANAGE_CHANNELS

<hr/>

> - *Some commands may require additional perms for the bot.*
> - *Last update: Thu, 01 Jul 2021 08:49:32 GMT*
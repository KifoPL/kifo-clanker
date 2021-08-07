# List of text Commands (used with prefix):
> Remember to add server prefix before command syntax.

### help
This command lists all categories of commands and shows help for every command.
- Usage:
	- `help` - lists all available commands
	- `help <category>` - lists all commands for a specific category
	- `help <command>` - shows help for specific command
	- `<command> help` - shows help for specific command
- Required user permissions: `SEND_MESSAGES`
## MANAGEMENT

### clean
This command cleans any permission overwrites that don't have `DENY` (<:RedX:857976926542757910>) or `ALLOW` (<:GreenCheck:857976926941478923>).
- Usage:
	- `clean` - cleans permission overwrites in the current channel.
	- `clean <channel>` - cleans permission overwrites in `channel`.
	- `clean <category>` - clean permission overwrites for `category` and all channels in `category`
	- `clean all` - clean permission overwrites for `all` channels in the server.
- Required user permissions: `SEND_MESSAGES`, `MANAGE_CHANNELS`, `MANAGE_ROLES`

### list
Lists all users in the server, or users having certain role.
To list more than 1000 users you need `MANAGE_GUILD` perms.
If the bot doesn't see some channels, lists ~~may~~ will be incorrect.
- Usage:
	- `list` - lists all users in the server
	- `list <user>` - lists roles of specified user.
	- `list <role> <optional_role2> <optional_role_n>` - lists users that have all specified roles.
	- `list <channel/"here"> <role> <optional_role2> <optional_role_n>` - lists users with specified roles in specified channel.
- Required user permissions: `SEND_MESSAGES`, `MANAGE_GUILD`

### menu
This powerful command allows you to create role menu or channel perms menu with optional timeout
- Usage:
	- `menu` - DMs you with channel aliases and syntax of the command.
	- `menu list` - lists active menus in the server (requires `MANAGE_GUILD`)
	- `menu perm <perm_alias> <channel>` - creates a menu, that when user reacts, they get `perm_alias` in `channel`.
	- `menu perm <perm_alias> <channel> <time_period>` - creates a menu, that when user reacts, they get `perm_alias` in `channel`. Everyone's perms will be reverted `time_period` after menu is created.
	- `menu role <role>` - creates a menu, that when user reacts, they get `role`.
	- `menu role <role> <time_period>` - creates a menu, that when user reacts, they get `role`. Everyone's role will be reverted `time_period` after menu is created.
	- `menu revert <message_url>` - removes `role` / `channel perm` from everyone who reacted to menu.
- Required user permissions: `SEND_MESSAGES`, `MANAGE_CHANNELS`

### perms
This powerful command manages permissions for channels and categories.
- **ADD** - allows a perm (green check), 
- **DENY** - denies a perm (red x),
- **RM** - removes a perm (grey /).
- Usage:
	- `perms` - checks if you have permissions to manage channel, lists aliases and Ids of permissions for easier cmd usage.
	- `perms "here"/"list"` - list perms of all roles and members for this channel in a `.txt` file
	- `perms <user_or_role_id>` - lists perms for specific user/role
	- `perms <channel_or_category_id>` - lists perms of all roles and members in a `.txt` file
	- `perms <add/rm/deny> <perm> <role_or_user_id_1> ... <role_or_user_id_n>` - adds/removes/denies perms for provided users and roles in this channel. <perm> can be either full name, id (number), or alias of a perm.
	- `perms <add/rm/deny> <perm> <role_or_user_id_1> ... <role_or_user_id_n> <time_period>` - adds/removes/denies perms for provided users and roles in this channel, then reverts the changes after <time_period>. <perm> can be either full name, id (number), or alias of a perm.
- Required user permissions: `SEND_MESSAGES`, `MANAGE_CHANNELS`

### remove
This command allows you to (temporarily) remove user role.
- Usage:
	- `remove` - Informs you of syntax.
	- `remove <user> <role>` - permanently removes role from user.
	- `remove <user> <role> <time_period>` - removes role from user, and re-adds it after given time period.
- Required user permissions: `SEND_MESSAGES`, `MANAGE_ROLES`

### stats
Displays stats for given user, bot, role, server, message, ~~channel~~ (in development).
If the bot doesn't see some channels, stats ~~may~~ will be incorrect.
- Usage:
	- `stats` - shows stats of the server
	- `stats <user>` - shows stats of specified user.
	- `stats <role>` - shows stats of specified role.
	- `stats <message_id>` - shows stats of specified message.
	- `stats me` - shows your stats.
- Required user permissions: `SEND_MESSAGES`

### top
This command lists x messages with most reactions from other channel.
- Usage:
	- `top <x> <time_period> <other_channel> <reaction>` - lists top x messages with most reactions from other channel. Sends x embeds (don't set it too large).
- Required user permissions: `SEND_MESSAGES`, `MANAGE_CHANNELS`

## UTILITY

### giveaway
This command allows you to set up a timeout, after which random winners who reacted will be selected.
- Usage:
	- `giveaway` - Informs you of syntax.
	- `giveaway <x> <time_period>` - sets up a message with default reaction as <a:done:828097348545544202> that'll choose `x` random users after `time_period`.
	- `giveaway <x> <time_period> <reaction>` - sets up a message with `reaction`, that'll choose `x` random users after `time_period`.
- Required user permissions: `SEND_MESSAGES`, `MANAGE_CHANNELS`, `ADD_REACTIONS`

### lang
This command allows you to detect message language.
- Usage:
	- `lang <message_id_or_url>` - sends a DM with description (react with any emote to the message to delete it).
- Required user permissions: `SEND_MESSAGES`

### prefix
This command informs you in detail how you can change server prefix.
- Usage:
	- `prefix` - sends a DM with details on prefix change process.
- Required user permissions: `SEND_MESSAGES`

### react
This command tells the bot to react to all messages in the channel with specific reactions.
- Usage:
	- `react on <emote1> <optional_emote2> ... <optional_emoten>` - turns on react command in this channel.
	- `react off` - turns off react command in this channel
	- `react` - checks if there is react module online.
	- `react list` - lists channels in which the command is active.
- Required user permissions: `SEND_MESSAGES`, `MANAGE_CHANNELS`

### superslow
Enable Super slow-mode (longer than 6 hours) for channels where you need it.
- Usage:
	- `superslow <time>` - turns on superslow command in this channel (setting time to 0s will turn off superslow module). 
	- `superslow` checks if there is superslow module online.
	- `superslow list` lists channels in which the command is active.
- Required user permissions: `SEND_MESSAGES`, `MANAGE_CHANNELS`

### todo
This command allows you to create a simple todo notes.
- Usage:
	- `todo <description>` - sends a DM with description (react with any emote to the message to delete it).
	- `todo <message_url> <optional_description>` - sends a DM with message content, link to the message and optional description.
- Required user permissions: `SEND_MESSAGES`

# List of slash commands (used with `/`):
## DEBUG

### error
Creates an issue on GitHub and pings KifoPL. Do not spam this command.
- Options:
	- `description` - Provide a brief description of how and when this error occurred.

### ping
...pong?
- Options:
	- `reply` *(optional)* - What do you want me to reply with?

### test
test out if the `/` commands work properly.
- Options:
	- `input` *(optional)* - The text to return.

## FUN

### cringe
Express your feelings to another discord user with this beautiful poem.
- Options:
	- `user` *(optional)* - direct your feelings towards the user.

### howgay
A quick test to find out your gayness level.
- Options:
	- `user` *(optional)* - A subject of measurement.

### iq
A very quick and accurate IQ test.
- Options:
	- `user` *(optional)* - A subject of measurement.

### pp
Measure your PP length with this totally reliable pp length calculator.
- Options:
	- `user` *(optional)* - A subject of measurement.

### reverse
This command reverses anything you type.
- Options:
	- `text` - The text to reverse
	- `silent` *(optional)* - Whether to show the result to only you, or everyone. False by default.

### stfu
This is an eloquent way to say "Thank you for this conversation we've had".
- Options:
	- `user` *(optional)* - Ask someone to lower their voice to the sub-audible level in an elegant manner.

### urmum
Random *yo momma* joke.
- Options:

## HELP

### guide
Receive link for command list, or guide regarding speficic topic.
- Options:
	- `choice` *(optional)* - Select topic, which you want to learn about.

## MANAGEMENT

### autothreading
Set up auto threading system in a channel.
- Options:
	- `on` - Turn on auto-threading system.
		- `title` - Choose the title for every thread (use /autothreading help for more info)
		- `archiving` - After what time of inactivity should threads be archived?
		- `bots` - True if you want threads to be created on bot messages as well, false otherwise.
		- `slowmode` *(optional)* - What should be the default slow-mode for threads?
	- `off` - Turn off auto-threading system.
	- `list` - List all channels with auto-threading system enabled.
	- `help` - Send a link with very detailed information regarding auto-threading system.

### threads
Manage threads in this channel.
- Options:
	- `archive` - Bulk archive oldest threads in this channel.
		- `count` - How many oldest threads would you like to archive?
		- `silent` *(optional)* - Do you want the output to be visible only by you? Defaults to false.
	- `delete` - Bulk delete specified threads in this channel.
		- `count` - How many oldest threads would you like to archive?
		- `which` - Should I delete archived, or active threads?
		- `silent` *(optional)* - Do you want the output to be visible only by you? Defaults to false.

### ticketing
Set up ticketing system in a channel.
- Options:
	- `on` - Turn on ticketing system.
		- `visibility` - Should tickets be public, allowing everyone to answer questions, or private?
		- `archiving` - After what time of inactivity should threads be archived?
		- `slowmode` *(optional)* - What should be the default slow-mode for tickets?
	- `off` - Turn off ticketing system.
	- `list` - List all channels with ticketing system enabled.
	- `help` - Send a link with very detailed information regarding ticketing system.

## UTILITY

### bookmark
Sends a copy of the message in DM (with attachments).
- Options:
	- `message` - ID or URL of the message.
	- `pin` *(optional)* - Whether the message should be pinned. False by default.

### poll
Create a poll.
- Options:
	- `question` - Ask the question or an opinion
	- `timeout` - When do you want to calculate results? "0", if never.
	- `one` - Option 1
	- `two` - Option 2
	- `three` *(optional)* - Option 3
	- `four` *(optional)* - Option 4
	- `five` *(optional)* - Option 5
	- `six` *(optional)* - Option 6
	- `seven` *(optional)* - Option 7
	- `eight` *(optional)* - Option 8
	- `nine` *(optional)* - Option 9
	- `ten` *(optional)* - Option 10

### ticket
Create a ticket
- Options:
	- `title` - The problem, or question you have.
	- `description` *(optional)* - Provide any additional information about your question/problem

<hr/>

> - *Some commands may require additional perms for the bot.*
> - *Last update: Sat, 07 Aug 2021 15:27:41 GMT*
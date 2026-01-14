"use strict";
//libraries
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetArchiveDuration = GetArchiveDuration;
const tslib_1 = require("tslib");
//*DATABASE CONNECTION
const mysql_1 = require("mysql");
const kifo = tslib_1.__importStar(require("kifo"));
const fs_1 = tslib_1.__importDefault(require("fs"));
const ms_1 = tslib_1.__importDefault(require("ms"));
const discord_js_1 = require("discord.js");
const builders_1 = require("@discordjs/builders");
require("dotenv")?.config();
require("events").EventEmitter.prototype._maxListeners = 100;
require("events").defaultMaxListeners = 100;
const main = require(`src/index`);
function GetArchiveDuration(duration) {
    switch (duration) {
        case "1h":
            return 60;
        case "1d":
            return 1440;
        case "3d":
            return 4320;
        case "1w":
            return 10080;
        default:
            return 10080; // MAX is now just the highest value
    }
}
//client login
const client = new discord_js_1.Client({
    partials: [discord_js_1.Partials.Message, discord_js_1.Partials.Channel, discord_js_1.Partials.Reaction],
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMembers,
        discord_js_1.GatewayIntentBits.GuildIntegrations,
        discord_js_1.GatewayIntentBits.GuildWebhooks,
        discord_js_1.GatewayIntentBits.GuildInvites,
        discord_js_1.GatewayIntentBits.GuildPresences,
        discord_js_1.GatewayIntentBits.GuildMessages,
        discord_js_1.GatewayIntentBits.GuildMessageReactions,
        discord_js_1.GatewayIntentBits.DirectMessageReactions,
        discord_js_1.GatewayIntentBits.GuildMessageTyping,
        discord_js_1.GatewayIntentBits.DirectMessages,
        discord_js_1.GatewayIntentBits.DirectMessageReactions,
        discord_js_1.GatewayIntentBits.DirectMessageTyping,
        discord_js_1.GatewayIntentBits.MessageContent,
    ]
});
//Owner is Discord User @KifoPL#3358 - <@289119054130839552>
async function loadOwner() {
    clientapp = await client.application.fetch();
    clientapp.commands.fetch().then(() => console.log("Fetched / commands!"));
    Owner = clientapp.owner;
    console.log("Bot owner object loaded!");
}
const prefixes = new Map();
/**
 * @example
 * "menuId" = {
    MessageId: "", //The same as menuId
    ChannelId: "",
    GuildId: "",

    isPerm: true,
    DestinationChannelId: "",
    PermName: "",

    isPerm: false,
    RoleId = "",
}
 */
const menus = new Map();
/**
 * @example
 * ticketing = {
    ChannelId: "",
    ArePublic: true || false,
    DefaultArchive: "3h" || "1d" || "3d" || "1w",
    DefaultSlowmode: "10s" || "1m" || "...",
}
 */
const ticketings = new Map();
/**
 * @example
 * autothreading = {
 * GuildId: "",
 * ChannelId: "",
    DefaultArchive: "3h" || "1d" || "3d" || "1w",
    DefaultSlowmode: "10s" || "1m" || "...",
    Title: "some string with optional parameters in brackets like [member]",
    BotAuto: True || False,
 }
 */
const autothreadings = new Map();
module.exports.menus = menus;
module.exports.ticketings = ticketings;
module.exports.autothreadings = autothreadings;
//// var reactMap = new Map();
//// var superslowMap = new Map();
let dbconfig = {
    host: process.env.HOST,
    user: process.env.USER,
    password: process.env.PASSWORD,
    database: "kifo_clanker_db",
    //totally not from stack overflow, but works beautifully
    typeCast: function castField(field, useDefaultTypeCasting) {
        // We only want to cast bit fields that have a single-bit in them. If the field
        // has more than one bit, then we cannot assume it is supposed to be a Boolean.
        if (field.type === "BIT" && field.length === 1) {
            let bytes = field.buffer();
            // A Buffer in Node represents a collection of 8-bit unsigned integers.
            // Therefore, our single "bit field" comes back as the bits '0000 0001',
            // which is equivalent to the number 1.
            return bytes === null ? false : bytes[0] === 1;
        }
        return useDefaultTypeCasting();
    },
};
/**Database connection
 * If you see this comment in another module, then it's probably set up correctly.
 */
let con;
function dbReconnect() {
    con = (0, mysql_1.createConnection)(dbconfig);
    con.connect(async function (err) {
        if (err) {
            main.log(err);
            Owner?.send({ embeds: [kifo.embed(err, "Error:")] }).catch(() => {
            });
            timer(3000).then(_ => dbReconnect());
        }
        console.log(`Connected to ${process.env.HOST} MySQL DB!`);
        module.exports.con = con;
        //for fetching prefixes from DB
        con.query(
        /*sql*/
        `SELECT Prefix, GuildId FROM prefixes`, async function (err, result) {
            if (err)
                throw err;
            prefixes.clear();
            result.forEach((row) => {
                prefixes.set(row.GuildId, row.Prefix);
            });
        });
        console.log(`Loaded prefixes!`);
    });
    con.on("error", function (err) {
        main.log(err);
        Owner?.send({ embeds: [kifo.embed(err, "Error:")] }).catch(() => {
        });
        if (err.code === "PROTOCOL_CONNECTION_LOST") {
            timer(3000).then(_ => dbReconnect());
        }
        else {
            Owner?.send({
                embeds: [kifo.embed(err, "Error BOT IS SHUT DOWN:")],
            }).catch(() => {
            });
            throw err;
        }
    });
}
dbReconnect();
client.commands = new discord_js_1.Collection();
client.slash_commands = new discord_js_1.Collection();
client.context_menus = new discord_js_1.Collection();
const commandFolders = fs_1.default.readdirSync("./commands");
console.log("Loading commands...");
let i = 0;
let j = 0;
let k = 0;
for (const folder of commandFolders) {
    const commandFiles = fs_1.default
        .readdirSync(`./commands/${folder}`)
        .filter((file) => file.endsWith(".js"));
    for (const file of commandFiles) {
        const command = require(`./src/commands/${folder}/${file}`);
        client.commands.set(command.name, command);
        console.log(`"${file.slice(0, -3)}"`);
        i++;
    }
}
i++;
console.log(`Loaded ${i} commands!`);
console.log("Loading / commands...");
const cmdFiles = fs_1.default
    .readdirSync(`./slash_commands`)
    .filter((file) => file.endsWith(".js"));
for (const file of cmdFiles) {
    const command = require(`./src/slash_commands/${file}`);
    client.slash_commands.set(command.name, command);
    console.log(`/ "${file.slice(0, -3)}"`);
    j++;
}
console.log(`Loaded ${j} / commands!`);
console.log("Loading context menus...");
const cxtFiles = fs_1.default
    .readdirSync(`./context_menus`)
    .filter((file) => file.endsWith(".js"));
for (const file of cxtFiles) {
    const context = require(`./src/context_menus/${file}`);
    client.context_menus.set(context.name, context);
    console.log(`Context menu "${context.name}"`);
    k++;
}
console.log(`Loaded ${k} context menus!`);
let command = require(`help`);
client.commands.set(command.name, command);
//*Hello message
async function hello(message, prefix) {
    //I have to do it here too
    if (message.content.toLowerCase().trim() === prefix.toLowerCase().trim()) {
        if ('sendTyping' in message.channel) {
            message.channel.sendTyping().catch(() => { });
        }
        const event = new Date(Date.now());
        if (message.channel instanceof discord_js_1.TextChannel || message.channel instanceof discord_js_1.NewsChannel) {
            main.log(message.author.tag, "issued (welcome msg) in", message.channel.name, "at", event.toUTCString());
        }
        const helloEmbed = new discord_js_1.EmbedBuilder()
            .setAuthor({
            name: "Hello there (click for bot invite link)!",
            url: "https://discord.com/api/oauth2/authorize?client_id=795638549730295820&permissions=120528432320&scope=bot%20applications.commands"
        })
            .setColor("#a039a0")
            .setTitle("See what's new! (click for invite to my bot-dev Discord Server)")
            .setURL("https://discord.gg/HxUFQCxPFp")
            .setThumbnail(message.guild?.members.me?.user?.avatarURL({
            extension: "png",
            size: 64,
        }) ?? "")
            .addFields({
            name: `Follow my GitHub repo`,
            value: "[LINK](https://github.com/KifoPL/kifo-clanker) - if you find a bug / have a cool idea for a new feature, please [create a ticket](https://github.com/KifoPL/kifo-clanker/issues/new/choose)."
        }, {
            name: `Check out top.gg page`,
            value: "[LINK](https://top.gg/bot/795638549730295820) - feel free to vote up and leave a 5 star review <a:done:828097348545544202>"
        }, {
            name: `try "${prefix}help"`,
            value: "This will list all commands available to you (you can see more commands if you're an Admin)!"
        }, {
            name: "\u200B",
            value: "This bot is developed by [KifoPL](https://bio.link/kifopl)."
        });
        helloEmbed.setAuthor({
            name: "KifoClanker",
            url: "https://discord.com/api/oauth2/authorize?client_id=795638549730295820&permissions=120528432320&scope=bot%20applications.commands"
        });
        message.reply({ embeds: [helloEmbed] }).catch(() => {
        });
        return;
    }
}
//Superior way to delay stuff using promises like a pro I am
const timer = (ms) => new Promise((res) => setTimeout(res, ms));
//timer(500).then(_ => {})
//*IF CORRECT CHANNEL, REACT
async function react(message, prefix) {
    con.query("SELECT ChannelId, emote FROM react WHERE ChannelId = ?", [message.channel.id], async function (err, result) {
        if (err)
            throw err;
        if (result.length > 0) {
            if (!message.content.startsWith(prefix)) {
                //It will react to his own messages that have attachments, this is so #kenoc-hall-of-fame looks better
                if (message.author.id != client.user?.id) {
                    if (message.author.bot)
                        return;
                }
                else {
                    if (message.embeds[0] === null)
                        return;
                }
                if (!message.guild?.members.me?.permissionsIn(message.channel.id)
                    .has(discord_js_1.PermissionFlagsBits.AddReactions)) {
                    await message.reply({
                        embeds: [
                            kifo.embed("Missing `ADD_REACTIONS` permission. Please turn off `react` module in this channel, or enable `ADD_REACTIONS` for me."),
                        ],
                    });
                    return;
                }
                var eventRT = new Date(Date.now());
                result.forEach((row) => {
                    message.react(row.emote).catch(() => {
                    });
                });
                if (message.channel instanceof discord_js_1.BaseGuildTextChannel) {
                    main.log("Reacted in " +
                        message.guild?.name +
                        ", " +
                        message.channel?.name +
                        " at " +
                        eventRT.toUTCString());
                }
            }
        }
    });
}
//*IF CORRECT CHANNEL, SUPERSLOWMODE
async function superslow(message, prefix) {
    con.query("SELECT ChannelId, Time FROM superslow WHERE ChannelId = ?", [message.channel.id], async function (err, result) {
        if (err)
            throw err;
        if (result.length > 0) {
            if (!message.guild?.members.me?.permissionsIn(message.channel.id)
                .has(discord_js_1.PermissionFlagsBits.ManageChannels)) {
                const embedreply = new discord_js_1.EmbedBuilder();
                embedreply
                    .setColor("#a039a0")
                    .setAuthor({
                    name: "Powered by Kifo Clanker™",
                    url: `https://discord.gg/HxUFQCxPFp`
                })
                    .setTitle("Missing `MANAGE_CHANNELS` permission. Please turn off `superslow` module in this channel, or enable `MANAGE_CHANNELS` for me.");
                await message.reply({ embeds: [embedreply] });
            }
            if (!message.guild?.members.me?.permissionsIn(message.channel.id)
                .has(discord_js_1.PermissionFlagsBits.ManageMessages)) {
                const embedreply = new discord_js_1.EmbedBuilder();
                embedreply
                    .setColor("#a039a0")
                    .setAuthor({
                    name: "Powered by Kifo Clanker™",
                    url: `https://discord.gg/HxUFQCxPFp`
                })
                    .setTitle("Missing `MANAGE_MESSAGES` permission. Please turn off `superslow` module in this channel, or enable `MANAGE_MESSAGES` for me.");
                return message.reply({ embeds: [embedreply] });
            }
            if (!message.member?.permissionsIn(message.channel.id)
                .has(discord_js_1.PermissionFlagsBits.ManageMessages)) {
                let slowmode = result[0].Time;
                con.query("SELECT Id, UserId, timestamp, ChannelId FROM superslowusers WHERE UserId = ? AND ChannelId = ?", [message.author.id, message.channel.id], async function (err, result2) {
                    if (err)
                        throw err;
                    // main.log(`${slowmode}, ${result2}`);
                    if (result2.length > 0) {
                        //if he can't send message yet
                        if (result2[0].timestamp + slowmode >
                            message.createdTimestamp) {
                            if (message.content.trim() === prefix.trim()) {
                                message.author
                                    .send({
                                    embeds: [
                                        kifo.embed(`You can't talk in ${(0, builders_1.channelMention)(message.channelId)} yet, please wait another ${(0, ms_1.default)(slowmode -
                                            (message.createdTimestamp -
                                                result2[0]
                                                    .timestamp), { long: true })}.`),
                                    ],
                                })
                                    .catch(() => {
                                });
                                await message.delete().catch(() => {
                                });
                                return;
                            }
                            else {
                                //I'm not kidding this msg works, because apparently subtraction forces integer type ¯\_(ツ)_/¯
                                let msg = "You can't talk in " +
                                    (0, builders_1.channelMention)(message.channelId) +
                                    " for **" +
                                    (0, ms_1.default)(slowmode -
                                        (message.createdTimestamp -
                                            result2[0].timestamp), {
                                        long: true,
                                    }) +
                                    "**. You can check, if you can talk (without risking waiting another **" +
                                    (0, ms_1.default)(slowmode -
                                        (message.createdTimestamp -
                                            result2[0].timestamp) +
                                        (message.createdTimestamp -
                                            result2[0].timestamp), { long: true }) +
                                    "**), by typing `" +
                                    prefix.trim() +
                                    "`.";
                                message.author
                                    .send({ embeds: [kifo.embed(msg)] })
                                    .catch(() => {
                                });
                                await message.delete().catch(() => {
                                });
                                return;
                            }
                        }
                        else {
                            if (message.content.trim() === prefix.trim()) {
                                message.author
                                    .send({
                                    embeds: [
                                        kifo.embed(`You can already talk in ${(0, builders_1.channelMention)(message.channelId)}.`),
                                    ],
                                })
                                    .catch(() => {
                                });
                                await message.delete().catch(() => {
                                });
                                return;
                            }
                            else {
                                con.query("INSERT INTO superslowusers ( UserId ,Timestamp ,ChannelId ) VALUES ( ?, ?, ?);", [
                                    message.author.id,
                                    message.createdTimestamp,
                                    message.channel.id,
                                ], function (err) {
                                    if (err)
                                        throw err;
                                });
                            }
                        }
                    }
                    else {
                        if (message.content.trim() === prefix.trim()) {
                            message.author
                                .send({
                                embeds: [
                                    kifo.embed(`You can already talk in ${(0, builders_1.channelMention)(message.channelId)}.`),
                                ],
                            })
                                .catch(() => {
                            });
                            await message.delete().catch(() => {
                            });
                            return;
                        }
                        else
                            con.query("INSERT INTO superslowusers ( UserId ,Timestamp ,ChannelId ) VALUES ( ?, ?, ?)", [
                                message.author.id,
                                message.createdTimestamp,
                                message.channel.id,
                            ], function (err) {
                                if (err)
                                    throw err;
                            });
                    }
                });
            }
        }
        else {
            await hello(message, prefix).catch(() => {
            });
        }
        return;
    });
}
//IF CORRECT CHANNEL, TICKET CHECK
async function ticketing(message) {
    if (ticketings.has(message.channel.id)) {
        if (message.author.id !== message.client?.user?.id)
            if (!message.member?.permissionsIn(message.channelId).has(discord_js_1.PermissionFlagsBits.ManageMessages)
                && message.interactionMetadata?.type !== 2) {
                let actionRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                    .setStyle(discord_js_1.ButtonStyle.Link)
                    .setLabel("Guide")
                    .setURL("https://kifopl.github.io/kifo-clanker/docs/guides/ticket"));
                message.author
                    .send({
                    embeds: [
                        kifo.embed("Hey, you're trying to send a message in a channel with **ticketing system**.\n> If you have a question/problem, please use `/ticket` command, to create a ticket.\n\n> If you're still confused, there is a detailed guide available, just click the button below."),
                    ],
                    components: [actionRow],
                })
                    .catch(() => {
                });
                message.delete().catch(() => {
                });
                return "deleted";
            }
    }
    return;
}
async function autothreading(message) {
    if (message.guild === null)
        return;
    if (autothreadings.has(message.channel.id)) {
        let at = autothreadings.get(message.channel.id);
        if (at?.GuildId === message.guild.id) {
            if (message.author.bot && !at.BotAuto)
                return;
            if (message.components.length > 0)
                return;
            let title = at.Title;
            let blank = "n/a";
            let embed_t = message.embeds[0]?.title ?? blank;
            if (embed_t.length > 50)
                embed_t = embed_t.slice(0, 47) + "...";
            let embed_d = message.embeds[0]?.description ?? blank;
            if (embed_d.length > 50)
                embed_d = embed_d.slice(0, 47) + "...";
            title = title
                .replace("[member]", () => message.member?.displayName ?? "member")
                .replace("[channel]", () => message.channel instanceof discord_js_1.BaseGuildTextChannel
                ? message.channel.name.replace("-", () => " ")
                : "channel")
                .replace("[server]", () => message.guild?.name ?? "server")
                .replace("[embed_t]", () => embed_t)
                .replace("[embed_d]", () => embed_d);
            if (title.length > 200)
                title = title.slice(0, 197) + "...";
            message
                .startThread({
                name: title,
                autoArchiveDuration: GetArchiveDuration(at.DefaultArchive),
                reason: "auto-threading enabled",
            })
                .then((th) => {
                if (at?.DefaultSlowmode != null)
                    th.setRateLimitPerUser((0, ms_1.default)(at.DefaultSlowmode) / 1000).catch(() => {
                    });
            })
                .catch((err) => {
                message
                    .reply({
                    embeds: [
                        kifo.embed("Unable to create thread channel! Error:\n" +
                            err),
                    ],
                })
                    .catch(() => {
                });
            });
        }
    }
}
//various checks if we can proceed with commands
function checks(message, prefix) {
    //No bot in #citizens
    ////if (message.channel.id === "707650931809976391") return false;
    //Only me and @Tester can use Offline test
    if (message.content.startsWith(prefix.trim()) &&
        message.guild?.members.me?.id === "796447999747948584")
        if (message.author.id != "289119054130839552" &&
            message.member?.roles.cache.find((role) => role.id === "832194217493135400") === undefined) {
            main.log(`msg: ${message.content}`);
            message.reply({
                embeds: [
                    kifo.embed("Only KifoPL#3358 and testers can use this bot."),
                ],
            }).catch(() => {
            });
            return false;
        }
    return true;
}
async function commands(message, prefix) {
    //If command detected, create args struct
    let args = message.content.slice(prefix.length).split(/ +/);
    let command = args.shift()?.toLowerCase();
    if (command === "serverlist" && message.author === Owner) {
        let channel = client.guilds
            .resolve("822800862581751848")
            ?.channels?.resolve("864178555457372191");
        let serversarr = [];
        let serverembed = new discord_js_1.EmbedBuilder();
        await message.client.guilds.cache
            .sort((a, b) => b.memberCount - a.memberCount)
            .each(async (guild) => {
            let owner = await guild.fetchOwner();
            serversarr.push({
                name: `${guild.id}\t${guild.name}\t`,
                value: `<:owner:823658022785908737> <@${guild.ownerId}> ${owner.user.tag}, ${guild.memberCount} members. ${guild.available
                    ? "<:online:823658022974521414>"
                    : "<:offline:823658022957613076> OUTAGE!"}`,
                inline: false
            });
        });
        serverembed
            .addFields(serversarr.slice(0, 10))
            .setTitle("Server list (top 10 by member count):")
            .setFooter({
            text: `I am in ${serversarr.length} servers as of ${new Date(Date.now()).toUTCString()}`
        })
            .setColor("#a039a0");
        if (serversarr.length > 10) {
            fs_1.default.writeFileSync(`./serverlist.txt`, serversarr.map((x) => `${x.name}\n${x.value}`).join(`\n\n`));
            channel
                .send({ embeds: [serverembed], files: ["./serverlist.txt"] })
                .then(() => {
                try {
                    fs_1.default.unlink(`./serverlist.txt`, () => {
                    });
                }
                catch {
                }
            })
                .catch(() => {
            });
        }
        else {
            channel.send({ embeds: [serverembed] }).catch(() => {
            });
        }
        return;
    }
    if (command === "deploy" && message.author === Owner) {
        const btnRow1 = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId("deploy_guild")
            .setLabel("Test")
            .setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder()
            .setCustomId("deploy_global")
            .setLabel("Production")
            .setStyle(discord_js_1.ButtonStyle.Secondary));
        const btnRow2 = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId("undeploy_guild")
            .setLabel("Delete Test")
            .setStyle(discord_js_1.ButtonStyle.Danger), new discord_js_1.ButtonBuilder()
            .setCustomId("undeploy_global")
            .setLabel("Delete Production")
            .setStyle(discord_js_1.ButtonStyle.Danger), new discord_js_1.ButtonBuilder()
            .setCustomId("undeploy_all")
            .setLabel("Delete Both")
            .setStyle(discord_js_1.ButtonStyle.Danger));
        if ('send' in message.channel) {
            message.channel
                .send({
                embeds: [
                    kifo.embed("Where would you like to deploy all `/ commands?"),
                ],
                components: [btnRow1, btnRow2],
            })
                .then((msg) => msg
                .awaitMessageComponent({ time: 15000 })
                .then((btnItr) => {
                if (btnItr.customId.startsWith("deploy_")) {
                    const commandFolders = fs_1.default
                        .readdirSync("./slash_commands")
                        .filter((file) => file.endsWith(".js"));
                    console.log("Loading / commands...");
                    let i = 0;
                    let data = [];
                    for (const cmd of commandFolders) {
                        const command = require(`./src/slash_commands/${cmd}`);
                        data.push({
                            name: command.name,
                            description: command.description,
                            options: command.options,
                            defaultPermission: command.defaultPermission,
                        });
                        console.log(`/ "${cmd.slice(0, -3)}"`);
                        i++;
                    }
                    const contextFolder = fs_1.default
                        .readdirSync(`./context_menus`)
                        .filter((file) => file.endsWith(".js"));
                    console.log("Loading context menus...");
                    let j = 0;
                    for (const ctxtMenu of contextFolder) {
                        const ctxt = require(`./src/context_menus/${ctxtMenu}`);
                        data.push({
                            name: ctxt.name,
                            type: ctxt.type,
                        });
                        console.log(`Context menu: "${ctxt.name}"`);
                        j++;
                    }
                    if (btnItr.customId === "deploy_guild") {
                        clientapp.commands.set(data, msg.guild?.id ?? "");
                        btnItr.reply({
                            embeds: [kifo.embed("DEPLOYED to Test!")],
                        });
                        console.log(`Deployed ${i} commands to test!`);
                        console.log(`Deployed ${j} context menus to test!`);
                    }
                    else if (btnItr.customId === "deploy_global") {
                        clientapp.commands.set(data);
                        btnItr.reply({
                            embeds: [
                                kifo.embed("DEPLOYED to Production (will take up to an hour)!"),
                            ],
                        });
                        console.log(`Deployed ${i} commands to production!`);
                        console.log(`Deployed ${j} context menus to production!`);
                    }
                }
                if (btnItr.customId === "undeploy_guild") {
                    clientapp.commands
                        .fetch({ guildId: btnItr.guildId ?? undefined })
                        .then((cmds) => {
                        cmds.each((cmd) => {
                            console.log(cmd.name);
                            cmd.delete();
                        });
                    });
                    btnItr.reply({
                        embeds: [kifo.embed("DELETED from test!")],
                    });
                }
                if (btnItr.customId === "undeploy_global") {
                    clientapp.commands.fetch().then((cmds) => cmds.each((cmd) => {
                        if (cmd.guildId === null) {
                            console.log(cmd.name);
                            cmd.delete();
                        }
                    }));
                    btnItr.reply({
                        embeds: [
                            kifo.embed("DELETED from production (will take up to an hour)!"),
                        ],
                    });
                }
                if (btnItr.customId === "undeploy_both") {
                    clientapp.commands.fetch().then((cmds) => cmds.each((cmd) => {
                        console.log(cmd.name);
                        cmd.delete();
                    }));
                    clientapp.commands
                        .fetch({
                        guildId: btnItr.guildId ?? undefined
                    })
                        .then((cmds) => {
                        cmds.each((cmd) => {
                            console.log(cmd.name);
                            cmd.delete();
                        });
                    });
                    btnItr.reply({
                        embeds: [
                            kifo.embed("DELETED from production (will take up to an hour) and test!"),
                        ],
                    });
                }
                msg.edit({ components: [] });
            })
                .catch(() => {
                msg.edit({ components: [] });
            }));
        }
        return;
    }
    if (command === "cmdlist" && message.author === Owner) {
        let reply = kifo.embed("", "/ Command list:");
        clientapp.commands
            .fetch({ guildId: `${message.guildId}` })
            .then((cmds) => {
            cmds.each((cmd) => {
                reply.addFields({
                    name: `${cmd.name}`,
                    value: `Guild: ${cmd.guildId}\nOptions: ${cmd.options
                        .map((o) => `${o.name}`)
                        .join(", ")}`
                });
            });
            clientapp.commands.fetch().then((cmds1) => {
                cmds1.each((cmd) => {
                    reply.addFields({
                        name: `${cmd.name}`,
                        value: `Guild: ${cmd.guildId}\nOptions: ${cmd.options
                            .map((o) => `${o.name}`)
                            .join(", ")}`
                    });
                });
                message.reply({ embeds: [reply] });
            });
        });
        return;
    }
    if (!command || !client.commands.has(command)) {
        let cmds = await clientapp.commands.fetch();
        if (command && cmds.find((cmd) => cmd.name === command) != undefined) {
            return message
                .reply({
                embeds: [
                    kifo.embed(`This is a slash command.\n\nTry \`/${command}\`!`, "Boomer alert!"),
                ],
            })
                .catch(() => {
            });
        }
        const embedreply = new discord_js_1.EmbedBuilder();
        embedreply
            .setColor("#a039a0")
            .setAuthor({
            name: "Powered by Kifo Clanker™",
            url: `https://discord.gg/HxUFQCxPFp`
        })
            .setTitle(`Command ${command} not found.`)
            .addFields({
            name: `Run \`${prefix}help\` to get list of available commands.`,
            value: `If you have a suggestion for a new command, please reach out to KifoPL#3358 - <@289119054130839552>`
        });
        return message.reply({ embeds: [embedreply] }).catch(() => {
        });
    }
    const contents = fs_1.default.readFileSync(`./commandList.json`);
    let jsonCmdList = JSON.parse(contents.toString());
    if (args[0] === "help") {
        let x = args[0];
        args[0] = command ?? "help";
        command = x;
    }
    try {
        if (command === "help") {
            const event = new Date(Date.now());
            main.log(`[Here](${message.url}) <@${message.author.id}> ${message.author.tag} issued \`${prefix}${command}\` in ${(0, builders_1.channelMention)(message.channelId)} at ${(0, builders_1.time)(event)}, ${(0, builders_1.time)(event, "R")}.`);
            client.commands.get(command).execute(message, args, prefix);
            return;
        }
        else if (command === "error") {
            const event = new Date(Date.now());
            main.log(`[Here](${message.url}) <@${message.author.id}> ${message.author.tag} issued \`${prefix}${command}\` in ${(0, builders_1.channelMention)(message.channelId)} at ${(0, builders_1.time)(event)}, ${(0, builders_1.time)(event, "R")}.`);
            client.commands
                .get(command)
                .execute(message, args, client);
            return;
        }
        else if (command === "react") {
            const command2 = require(`./${jsonCmdList.react.path}`);
            const embedreactreply = new discord_js_1.EmbedBuilder();
            embedreactreply
                .setColor("#a039a0")
                .setAuthor({
                name: "Powered by Kifo Clanker™",
                url: `https://discord.gg/HxUFQCxPFp`
            })
                .setTitle(`Command "${command.toUpperCase()}" issued by ${message.author.tag}`);
            if (!message.member?.permissionsIn(message.channelId)
                .has(discord_js_1.PermissionFlagsBits.ManageChannels))
                return message.reply({
                    embeds: [
                        kifo.embed("You do not have `MANAGE_CHANNELS` permissions."),
                    ],
                });
            if (!args[0]) {
                con.query("SELECT * FROM react WHERE ChannelId = ?", [message.channel.id], function (err, result) {
                    if (err)
                        throw err;
                    if (result.length > 0) {
                        embedreactreply.addFields({
                            name: "Warning:",
                            value: "React is already **ON**!"
                        });
                        return message.reply({ embeds: [embedreactreply] });
                    }
                    else {
                        embedreactreply.addFields({
                            name: "React is **Off**.",
                            value: `Syntax:\n${command2.usage.join("\n")}`
                        });
                        return message.reply({ embeds: [embedreactreply] });
                    }
                });
                return;
            }
            const event = new Date(Date.now());
            main.log(`[Here](${message.url}) <@${message.author.id}> ${message.author.tag} issued \`${prefix}${command}\` in ${(0, builders_1.channelMention)(message.channelId)} at ${(0, builders_1.time)(event)}, ${(0, builders_1.time)(event, "R")}.`);
            if (args[0].toUpperCase() === "LIST") {
                const newReactChannelsEmbed = new discord_js_1.EmbedBuilder()
                    .setColor("#a039a0")
                    .setAuthor({ name: "Powered by Kifo Clanker™" })
                    .setTitle("List of channels, where command is active:");
                con.query("SELECT ChannelId, GROUP_CONCAT(emote SEPARATOR ', ') AS emotes FROM react GROUP BY ChannelId ORDER BY ChannelId", function (_, result) {
                    let guildChannels = [];
                    result.forEach((row) => {
                        if (message.guild?.channels.resolveId(row.ChannelId) !=
                            null) {
                            guildChannels.push(row);
                        }
                    });
                    if (guildChannels.length > 0) {
                        if (guildChannels.length < 25) {
                            guildChannels.forEach((row) => {
                                newReactChannelsEmbed.addFields({
                                    name: `${row.emotes}`,
                                    value: `<#${row.ChannelId}>`
                                });
                            });
                        }
                        else {
                            newReactChannelsEmbed.addFields({
                                name: `Channels:`,
                                value: `<#${guildChannels
                                    .map((e) => e.ChannelId)
                                    .join(">, <#")}>`
                            });
                        }
                    }
                    else {
                        newReactChannelsEmbed.addFields({
                            name: `INFO:`,
                            value: `\`react\` is not enabled on your server yet.`
                        });
                    }
                    return message.reply({
                        embeds: [newReactChannelsEmbed],
                    });
                });
                return;
            }
            reactreturn = client.commands
                .get(command)
                .execute(message, args);
            if (reactreturn[0] === "ON") {
                let arrout = [];
                await reactreturn[1].forEach((emote) => {
                    arrout.push([message.channel.id, emote]);
                });
                con.query("INSERT INTO react (ChannelId, emote) VALUES ?", [arrout], function (err) {
                    if (err)
                        throw err;
                });
                main.log("I will now react in <#" +
                    message.channel.id +
                    "> with " +
                    arrout.map((e) => e[1]).join(", "));
            }
            else if (reactreturn[0] === "OFF") {
                con.query("DELETE FROM react WHERE ChannelId = ?", [message.channel.id], function (err) {
                    if (err)
                        throw err;
                });
            }
            return;
        }
        else if (command === "superslow") {
            const embedsuperslowreply = new discord_js_1.EmbedBuilder();
            embedsuperslowreply
                .setColor("#a039a0")
                .setAuthor({
                name: "Powered by Kifo Clanker™",
                url: `https://discord.gg/HxUFQCxPFp`
            })
                .setTitle(`Command "${command.toUpperCase()}" issued by ${message.author.tag}`);
            const commandfile = require(`./${jsonCmdList.superslow.path}`);
            if (!message.member?.permissionsIn(message.channel.id)
                .has(discord_js_1.PermissionFlagsBits.ManageChannels))
                return message.reply({
                    embeds: [
                        kifo.embed("You do not have `MANAGE_CHANNELS` permissions."),
                    ],
                });
            if (!args[0]) {
                con.query("SELECT ChannelId, Time FROM superslow WHERE ChannelId = ?", [message.channel.id], function (err, result) {
                    if (err)
                        throw err;
                    if (result.length > 0) {
                        embedsuperslowreply
                            .setTitle("Result:")
                            .setDescription("Super slow-mode is already set here to " +
                            (0, ms_1.default)((0, ms_1.default)(result[0].Time, { long: true })));
                        return message.reply({
                            embeds: [embedsuperslowreply],
                        });
                    }
                    else {
                        embedsuperslowreply
                            .setTitle("Super slow-mode is **NOT** activated.")
                            .setDescription("Syntax:\n" + commandfile.usage.join("\n"));
                        return message.reply({
                            embeds: [embedsuperslowreply],
                        });
                    }
                });
                //just in case
                return;
            }
            const event = new Date(Date.now());
            main.log(`[Here](${message.url}) <@${message.author.id}> ${message.author.tag} issued \`${prefix}${command}\` in <#${message.channel.id}> at <t:${Math.floor(event.getTime() / 1000)}>, <t:${Math.floor(event.getTime() / 1000)}:R>.`);
            if (args[0]?.toUpperCase() === "LIST") {
                const newSuperslowChannelsEmbed = new discord_js_1.EmbedBuilder()
                    .setColor("#a039a0")
                    .setTitle("List of channels, where command is active:");
                con.query("SELECT ChannelId, Time FROM superslow", function (_, result) {
                    let guildChannels = [];
                    result.forEach((row) => {
                        if (message.guild?.channels.resolve(row.ChannelId) !=
                            null) {
                            guildChannels.push(row);
                        }
                    });
                    if (guildChannels.length > 0) {
                        if (guildChannels.length < 25) {
                            guildChannels.forEach((row) => {
                                newSuperslowChannelsEmbed.addFields({
                                    name: `${(0, ms_1.default)(row.Time, { long: true })}`,
                                    value: `<#${row.ChannelId}>`
                                });
                            });
                        }
                        else {
                            newSuperslowChannelsEmbed.addFields({
                                name: `Channels:`,
                                value: `<#${guildChannels
                                    .map((e) => e.ChannelId)
                                    .join(">, <#")}>`
                            });
                        }
                    }
                    else {
                        newSuperslowChannelsEmbed.addFields({
                            name: `INFO:`,
                            value: `\`superslow\` is not enabled on your server yet.`
                        });
                    }
                    return message.reply({
                        embeds: [newSuperslowChannelsEmbed],
                    });
                });
                return;
            }
            //[0] - isOff, [1] - ms(args[0])
            let superslowreturn = client.commands
                .get(command)
                .execute(message, args);
            if (superslowreturn === null)
                return;
            //Just making sure lmao
            if (superslowreturn[0] === undefined)
                return;
            if (!superslowreturn[0]) {
                con.query("SELECT ChannelId, time FROM superslow WHERE ChannelId = ?", [message.channel.id], function (_, result) {
                    if (result.length > 0) {
                        let timestamp = result[0].Time;
                        if (timestamp === superslowreturn[1]) {
                            embedsuperslowreply
                                .setTitle("Result:")
                                .setDescription("it's already set to " +
                                (0, ms_1.default)(superslowreturn[1], {
                                    long: true,
                                }) +
                                "!");
                            return message.reply({
                                embeds: [embedsuperslowreply],
                            });
                        }
                        con.query("UPDATE superslow SET ChannelId = ?, Time = ? WHERE ChannelId = ?", [
                            message.channel.id,
                            superslowreturn[1],
                            message.channel.id,
                        ], function (err) {
                            if (err)
                                throw err;
                            embedsuperslowreply
                                .setTitle("Result:")
                                .setDescription("Super slow-mode was already activated. It is now set to " +
                                (0, ms_1.default)(superslowreturn[1], {
                                    long: true,
                                }));
                            return message.reply({
                                embeds: [embedsuperslowreply],
                            });
                        });
                    }
                    else {
                        con.query("INSERT INTO superslow ( ChannelId ,Time ) VALUES ( ?, ? );", [message.channel.id, superslowreturn[1]], function (err) {
                            if (err)
                                throw err;
                            embedsuperslowreply
                                .setTitle("Result:")
                                .setDescription("set Super slow-mode to " +
                                (0, ms_1.default)(superslowreturn[1], {
                                    long: true,
                                }) +
                                ".");
                            message.reply({
                                embeds: [embedsuperslowreply],
                            });
                            //This is to notify users of Super slow-mode active in the channel.
                            if (message.channel instanceof discord_js_1.TextChannel || message.channel instanceof discord_js_1.ThreadChannel) {
                                message.channel.setRateLimitPerUser(10);
                            }
                            return;
                        });
                    }
                    throw new Error();
                });
            }
            else if (superslowreturn[0]) {
                con.query("DELETE FROM superslowusers WHERE ChannelId = ?", [message.channel.id], function (err) {
                    if (err)
                        throw err;
                    con.query("DELETE FROM superslow WHERE ChannelId = ?", [message.channel.id], function (err1) {
                        if (err1)
                            throw err1;
                        embedsuperslowreply
                            .setTitle("Result:")
                            .setDescription("Super slow-mode is successfully disabled.");
                        message.reply({
                            embeds: [embedsuperslowreply],
                        });
                        if (message.channel instanceof discord_js_1.TextChannel || message.channel instanceof discord_js_1.ThreadChannel) {
                            message.channel.setRateLimitPerUser(0);
                        }
                        return;
                    });
                });
            }
            return;
        }
        else {
            const event = new Date(Date.now());
            main.log(`[Here](${message.url}) <@${message.author.id}> ${message.author.tag} issued \`${prefix}${command}\` in <#${message.channel.id}> at <t:${Math.floor(event.getTime() / 1000)}>, <t:${Math.floor(event.getTime() / 1000)}:R>.`);
            try {
                const debug = client.commands
                    .get(command)
                    .execute(message, args, prefix);
                debug;
            }
            catch (error) {
                message.reply({ embeds: [kifo.embed(error, "Error!")] });
                main.log(error);
            }
            return;
        }
    }
    catch (err) {
        message.reply({ embeds: [kifo.embed(err, "Error!")] });
        main.log(err);
    }
}
async function onmessage(message) {
    const prefix = await main.prefix(message.guild?.id);
    let t = await ticketing(message);
    if (t === "deleted")
        return;
    react(message, prefix).catch(() => {
    });
    await superslow(message, prefix).catch(() => {
    });
    autothreading(message);
    if (!message.guild?.members.me?.permissionsIn(message.channel.id)
        ?.has(discord_js_1.PermissionFlagsBits.SendMessages))
        return;
    if (!message.guild?.members.me?.permissionsIn(message.channel.id)
        ?.has(discord_js_1.PermissionFlagsBits.EmbedLinks))
        return message
            .reply("I need `EMBED_LINKS` permission to operate!")
            .catch(() => {
        });
    if (message.content === `<@!${client.user?.id}>` ||
        (message.content === `<@${client.user?.id}>` && !message.author.bot)) {
        let now = new Date(Date.now());
        let startDate = new Date(now.getTime() - (client.uptime ?? 0));
        return message
            .reply({
            embeds: [
                kifo.embed(`<:KifoClanker:863793928377729065> My prefix is: \`${prefix}\`\n\n<:online:823658022974521414> I'm online since <t:${Math.floor(startDate.getTime() / 1000)}:R>.`, "Hello there!"),
            ],
        })
            .catch(() => {
        });
    }
    let speakcheck = checks(message, prefix);
    if (speakcheck) {
        if (!message.content.toLowerCase().startsWith(prefix.toLowerCase()))
            if (message.content.toLowerCase().startsWith("!kifo") ||
                message.content.toLowerCase().startsWith("!ktest")) {
                return message
                    .reply({
                    embeds: [
                        kifo.embed(`This server has a custom prefix. Try \`${message.content.replace(/^!kifo|ktest/im, prefix.trim())}\` instead.`),
                    ],
                })
                    .catch(() => {
                });
            }
        if (message.author.bot)
            return;
        if (message.content
            .toLowerCase()
            .startsWith(prefix.toLowerCase().trim()) &&
            message.content.length > prefix.length) {
            commands(message, prefix);
        }
    }
}
let clientapp;
//that's @KifoPL#3358
let Owner;
//const guildIdTest = "822800862581751848";
function setCommandList() {
    let cmdListJSON = "";
    let cmdListMD = `# List of text Commands (used with prefix):\n> Remember to add server prefix before command syntax.\n\n`;
    const help = require("./help.js");
    cmdListMD += `### ${help.name}\n${help.description}\n- Usage:\n\t- ${help.usage.join("\n\t- ")}\n- Required user permissions: \`${help.perms.join("`, `")}\`\n\n`;
    cmdListJSON += `{\n`;
    for (const folder of commandFolders) {
        cmdListMD += `## ${folder.toUpperCase()}\n\n`;
        const commandFiles = fs_1.default
            .readdirSync(`./commands/${folder}`)
            .filter((file) => file.endsWith(".js"));
        for (const file of commandFiles) {
            cmdListJSON += `"${file.slice(0, file.length - 3)}": {\n`;
            cmdListJSON += `\t"file": "${file}",\n`;
            cmdListJSON += `\t"path": "commands/${folder}/${file}",\n`;
            cmdListJSON += `\t"relativepath": "../${folder}/${file}"\n\t},\n`;
            const command = require(`./src/commands/${folder}/${file}`);
            cmdListMD += `### ${command.name}\n`;
            cmdListMD += `${command.description}\n`;
            cmdListMD += `- Usage:\n\t- ${command.usage.join("\n\t- ")}\n`;
            cmdListMD += `- Required user permissions: \`${command.perms.join("`, `")}\`\n`;
            cmdListMD += `\n`;
        }
    }
    cmdListMD += `# List of slash commands (used with \`/\`):\n`;
    let cmdMap = new Map();
    const cmdFiles = fs_1.default.readdirSync(`./slash_commands`);
    for (const cmd of cmdFiles) {
        const command = require(`./src/slash_commands/${cmd}`);
        if (cmdMap.has(command.category)) {
            cmdMap.get(command.category).push(command);
        }
        else
            cmdMap.set(command.category, [command]);
    }
    const cmdMapSorted = new Map([...cmdMap.entries()].sort());
    cmdMapSorted.forEach((val, key) => {
        cmdListMD += `## ${key}\n\n`;
        val.forEach((command) => {
            cmdListMD += `### ${command?.name}\n`;
            cmdListMD += `${command?.description}\n`;
            cmdListMD += `- Options:\n`;
            if (command.options != undefined) {
                cmdListMD += `\t- ${command?.options
                    .map((x) => {
                    if (x.type === discord_js_1.ApplicationCommandOptionType.Subcommand || x.type === "SUB_COMMAND") {
                        return `\`${x.name}\` - ${x.description}${x.options != undefined
                            ? `\n\t\t- ${x.options
                                .map((o) => `\`${o.name}\`${!o.required
                                ? " *(optional)*"
                                : ""} - ${o.description}`)
                                .join("\n\t\t- ")}`
                            : ""}`;
                    }
                    else
                        return `\`${x.name}\`${!x.required ? " *(optional)*" : ""} - ${x.description}`;
                })
                    .join("\n\t- ")}\n`;
            }
            cmdListMD += `- Required user permissions: \`${command.perms.join("`, `")}\`\n`;
            cmdListMD += `\n`;
        });
    });
    cmdListMD += `# List of context menus (used with <kbd>Right-Click</kbd>):\n`;
    let cxtMap = new Map();
    for (const cxt of cxtFiles) {
        const context = require(`./src/context_menus/${cxt}`);
        if (cxtMap.has(context.type)) {
            cxtMap.get(context.type).push(context);
        }
        else
            cxtMap.set(context.type, [context]);
    }
    const cxtMapSorted = new Map([...cxtMap.entries()].sort());
    cxtMapSorted.forEach((val, key) => {
        cmdListMD += `## ${key.toUpperCase()} *(right-click on \`${key.toLowerCase()}\` to use)*\n\n`;
        val.forEach((command) => {
            cmdListMD += `### ${command?.name}\n`;
            cmdListMD += `${command?.description}\n`;
            cmdListMD += `- Required user permissions: \`${command.perms.join("`, `")}\`\n`;
            cmdListMD += `\n`;
        });
    });
    let now = new Date(Date.now());
    cmdListJSON = cmdListJSON.slice(0, cmdListJSON.length - 2);
    cmdListJSON += `\n}`;
    cmdListMD += `<hr/>\n`;
    cmdListMD += `\n> - *Some commands may require additional perms for the bot.*`;
    cmdListMD += `\n- Last update: ${now.toUTCString()}`;
    cmdListMD +=
        "\n*~by [KifoPL](https://bio.link/KifoPL)*\n\n[<kbd>Back to home page</kbd>](https://kifopl.github.io/kifo-clanker/)";
    fs_1.default.writeFile(`commandList.json`, cmdListJSON, () => {
        return;
    });
    fs_1.default.writeFile(`./docs/commandList.md`, cmdListMD, () => {
        return;
    });
    console.log(`Created commandList.json file!`);
    console.log(`Created commandList.md file!`);
}
function setGuideList() {
    let now = new Date(Date.now());
    let guideList = "# List of available guides:\n\n";
    const guides = fs_1.default
        .readdirSync(`./docs/guides`)
        .filter((guide) => guide.endsWith(".md"));
    guides.forEach((guide) => {
        const data = fs_1.default
            .readFileSync(`./docs/guides/${guide}`, {
            encoding: `utf8`,
            flag: `r`,
        })
            .split("\n")
            .shift();
        console.log(data);
        guideList += `### [${data?.slice(2, -1)}](./guides/${guide.slice(0, -3)})\n\n`;
    });
    guideList += `<hr/>\n\nLast update: ${now.toUTCString()}.\n`;
    guideList +=
        "\n*~by [KifoPL](https://bio.link/KifoPL)*\n\n[<kbd>Back to home page</kbd>](https://kifopl.github.io/kifo-clanker/)";
    fs_1.default.writeFile(`./docs/guideList.md`, guideList, () => {
        return;
    });
    console.log("Created guideList.md file!");
}
client.once("ready", () => {
    console.log("Kifo Clanker™ is online!");
    loadOwner();
    setCommandList();
    setGuideList();
    //let debug = false;
    module.exports.client = client;
    //DELETING SLASH COMMANDS CODE FOR NOW, I tried using prebuilt API, but it was "too" prebuild and it didn't fit my bot at all. Will have to do stuff manually...
    //This line is executed by default, but I'm just making sure the status is online (other factors could change the status)
    updatePresence();
    setInterval(updatePresence, 1000 * 60 * 3);
    console.log("Presence set!");
    giveawayCheck();
    setInterval(giveawayCheck, 1000 * 60);
    removeCheck();
    setInterval(removeCheck, 1000 * 60);
    permsCheck();
    setInterval(permsCheck, 1000 * 60);
    menusCheck();
    setInterval(menusCheck, 1000 * 60);
    pollsCheck();
    setInterval(pollsCheck, 1000 * 60);
    countdownCheck();
    setInterval(countdownCheck, 1000 * 60);
    con.query("SELECT * FROM menu_perms", [], function (err, result) {
        if (err)
            throw err;
        if (result.length > 0) {
            result.forEach((row) => {
                menus.set(row.MessageId, {
                    MessageId: row.MessageId,
                    ChannelId: row.ChannelId,
                    GuildId: row.GuildId,
                    isPerm: true,
                    DestinationChannelId: row.DestinationChannelId,
                    PermName: row.PermName,
                });
            });
        }
        console.log(`Mapped ${result.length} Perm Menus!`);
    });
    con.query("SELECT * FROM menu_roles", [], function (err, result) {
        if (err)
            throw err;
        if (result.length > 0) {
            result.forEach((row) => {
                menus.set(row.MessageId, {
                    MessageId: row.MessageId,
                    ChannelId: row.ChannelId,
                    GuildId: row.GuildId,
                    isPerm: false,
                    RoleId: row.RoleId,
                });
            });
        }
        console.log(`Mapped ${result.length} Role Menus!`);
    });
    con.query("SELECT Id, GuildId, ChannelId, ArePublic, DefaultSlowmode, DefaultArchive FROM ticketing", [], function (err, result) {
        if (err)
            throw err;
        if (result.length > 0) {
            result.forEach((row) => {
                ticketings.set(row.ChannelId, {
                    ChannelId: row.ChannelId,
                    GuildId: row.GuildId,
                    ArePublic: row.ArePublic,
                    DefaultSlowmode: row.DefaultSlowmode,
                    DefaultArchive: row.DefaultArchive,
                });
            });
        }
        console.log(`Loaded ${result.length} ticketings!`);
    });
    con.query("SELECT Id, GuildId, ChannelId, DefaultArchive, DefaultSlowmode, BotAuto, Title FROM autothreading", [], function (err, result) {
        if (err)
            throw err;
        if (result.length > 0) {
            result.forEach((row) => {
                autothreadings.set(row.ChannelId, {
                    ChannelId: row.ChannelId,
                    GuildId: row.GuildId,
                    DefaultArchive: row.DefaultArchive,
                    DefaultSlowmode: row.DefaultSlowmode,
                    Title: row.Title,
                    BotAuto: row.BotAuto,
                });
            });
            console.log(`Loaded ${result.length} auto-threadings!`);
        }
    });
});
function giveawayCheck() {
    let now = new Date(Date.now());
    con.query(
    /*sql*/
    `SELECT Id, MessageId, ChannelId, GuildId, UserId, Winners, EndTime, Reaction FROM giveaway WHERE EndTime <= ?`, [now], function (err, result) {
        if (err)
            throw err;
        if (result.length > 0) {
            main.log(`${result.length} giveaway${result.length > 1 ? "s have" : " has"} ended!`);
            result.forEach(async (row) => {
                let link = `https://discord.com/channels/${row.GuildId}/${row.ChannelId}/${row.MessageId}`;
                let msg;
                let channel = client.guilds
                    .resolve(row.GuildId)
                    ?.channels.resolve(row.ChannelId);
                let msgs = await channel?.messages.fetch({ cache: true });
                msg = msgs?.get(row.MessageId);
                if (msg === null)
                    Owner.send({
                        embeds: [
                            kifo.embed(`WARNING: ${link} giveaway not fetched.`),
                        ],
                    }).catch((err) => {
                        main.log(err);
                    });
                if (msg.partial) {
                    await msg.fetch().catch((err) => {
                        main.log(err);
                    });
                }
                let temp = [];
                await msg.reactions
                    .resolve(row.Reaction)
                    .users.fetch()
                    .then((col) => {
                    temp = col
                        .filter((user) => !user.bot)
                        .random(row.Winners + 1);
                })
                    .catch((err) => {
                    main.log(err);
                });
                let winners = temp;
                winners.shift();
                //generate a .txt file
                let output = "";
                let authorM = `<@!${row.UserId}>`;
                await winners.forEach((winner) => {
                    if (winner != undefined) {
                        output += `\n- <@${winner?.id ??
                            " `not enough reactions to conclude, if that's not the case notify Kifo` <@289119054130839552> "}>`;
                    }
                });
                const giveEmbed = new discord_js_1.EmbedBuilder()
                    .setTitle("Giveaway results:")
                    .setAuthor({
                    name: `Powered by Kifo Clanker™`,
                    iconURL: client.user?.avatarURL({
                        extension: "png",
                        size: 64,
                    }) ?? undefined
                })
                    .setColor("#a039a0")
                    .setFooter({
                    text: "Giveaway ended at: " + row.EndTime.toUTCString()
                })
                    .setThumbnail(client.guilds.resolve(row.GuildId)?.iconURL({
                    extension: "png",
                    size: 64,
                }) ?? null);
                if (row.Winners > 25) {
                    fs_1.default.writeFileSync(`./${row.MessageId}.txt`, output);
                    giveEmbed.setDescription("Results are in .txt file!");
                }
                else
                    giveEmbed.setDescription(output);
                let msgOptions = {
                    content: authorM,
                    embeds: [giveEmbed],
                    files: [],
                };
                if (row.Winners > 25)
                    msgOptions.files = [`./${row.MessageId}.txt`];
                await client.channels.resolve(row.ChannelId)
                    ?.send(msgOptions)
                    .catch(async () => {
                    await client.guilds
                        .resolve(row.GuildId)
                        ?.members.resolve(row.UserId)
                        ?.send(msgOptions)
                        .catch(async () => {
                        await Owner.send({
                            content: `Can't send giveaway info at Server ${client.guilds.resolve(row.GuildId)
                                ?.name}, Channel ${client.channels.resolve(row.ChannelId)?.name}. Server owner: <@${client.guilds.resolve(row.GuildId)
                                ?.ownerId}>`,
                            embeds: [giveEmbed],
                        }).catch((err) => {
                            main.log(err);
                        });
                    });
                });
                try {
                    fs_1.default.unlink(`./${row.MessageId}.txt`, () => {
                    });
                }
                catch (err) {
                }
            });
            con.query("DELETE FROM giveaway WHERE EndTime <= ?", [now], function (err1) {
                if (err1)
                    throw err1;
            });
        }
    });
}
function removeCheck() {
    let now = new Date(Date.now());
    con.query(
    /*sql*/
    `SELECT Id, UserId, RoleId, PerpetratorId, ChannelId, GuildId, EndTime FROM role_remove WHERE EndTime <= ?`, [now], function (err, result) {
        if (err)
            throw err;
        if (result.length > 0) {
            main.log(`${result.length} remove${result.length > 1 ? "s" : ""} found!`);
            result.forEach(async (row) => {
                let member = (await client.guilds
                    .resolve(row.GuildId)
                    ?.members.resolve(row.UserId)
                    ?.fetch());
                let channel = client.guilds
                    .resolve(row.GuildId)
                    ?.channels.resolve(row.ChannelId);
                member?.roles
                    .add(row.RoleId)
                    .then(() => {
                    channel
                        ?.send({
                        content: `<@!${member?.id}>, <@!${row.PerpetratorId}>`,
                        embeds: [
                            kifo.embed(`Issued by: <@!${row.PerpetratorId}>\nRole added: <@&${row.RoleId}>\nTo: <@!${member?.id}>`, `Role remove command (role readded)`),
                        ],
                    })
                        .catch((err1) => {
                        client.guilds
                            .resolve(row.GuildId)
                            ?.members.resolve(row.PerpetratorId)
                            ?.send({
                            embeds: [
                                kifo.embed(`Issued by: <@!${row.PerpetratorId}>\nRole added: <@&${row.RoleId}>\nTo: <@!${member?.id}>`, `Role remove command (role readded)`),
                            ],
                        })
                            .catch(() => {
                        });
                        main.log(err1);
                    });
                })
                    .catch((err1) => {
                    channel
                        ?.send({
                        embeds: [
                            kifo.embed(`Issued by: <@!${row.PerpetratorId}>\nRole added: <@&${row.RoleId}>\nTo: <@!${member?.id}>`, `UNABLE TO ADD ROLE BACK`),
                        ],
                    })
                        .catch((err2) => {
                        client.guilds
                            .resolve(row.GuildId)
                            ?.members.resolve(row.PerpetratorId)
                            ?.send({
                            embeds: [
                                kifo.embed(`Issued by: <@!${row.PerpetratorId}>\nRole added: <@&${row.RoleId}>\nTo: <@!${member?.id}>`, `UNABLE TO ADD ROLE BACK`),
                            ],
                        })
                            .catch(() => {
                        });
                        main.log(err2);
                    });
                    main.log(err1);
                });
            });
            con.query("DELETE FROM role_remove WHERE EndTime <= ?", [now], function (err1) {
                if (err1)
                    throw err1;
            });
        }
    });
}
function permsCheck() {
    let now = new Date(Date.now());
    con.query(
    /*sql*/
    `SELECT Id, PerpetratorId, MessageId, ChannelId, GuildId, PermId, PermFlag, EndTime, Command FROM perms WHERE EndTime <= ?`, [now], function (err, result) {
        if (err)
            throw err;
        if (result.length > 0) {
            main.log(`${result.length} perm${result.length > 1 ? "s" : ""} found!`);
            let previousMap = new Map();
            let failureMap = new Map();
            result.forEach(async (row) => {
                if (failureMap.has(row.MessageId))
                    return;
                let Current = client.guilds
                    .resolve(row.GuildId)
                    ?.channels.resolve(row.ChannelId)
                    ?.permissionOverwrites?.resolve(row.PermId)
                    ?.allow.has(row.PermFlag)
                    ? "allow"
                    : client.guilds
                        .resolve(row.GuildId)
                        ?.channels.resolve(row.ChannelId)
                        ?.permissionOverwrites?.resolve(row.PermId)
                        ?.deny.has(row.PermFlag)
                        ? "deny"
                        : "neutral";
                //a map for output message for each message (cmd)
                if (!previousMap.has(row.MessageId)) {
                    previousMap.set(row.MessageId, Current);
                }
                client.guilds
                    .resolve(row.GuildId)
                    ?.channels.resolve(row.ChannelId)
                    ?.permissionOverwrites?.edit(row.PermId, {
                    [row.PermFlag]: row.Command === "add"
                        ? true
                        : row.Command === "rm"
                            ? null
                            : false,
                })
                    // .then(() => {
                    // 	//client.channels.resolve(row.ChannelId)?.send(kifo.embed(`Changed ${row.PermFlag} from ${Current} to ${row.Command} for ${client.guilds.resolve(row.GuildId)?.members.resolve(row.PermId) != null ? "<@!" : "<@&"}${row.PermId}>.`, "Changed back perms")).catch((err) => {main.log(err)})
                    // })
                    .catch((err) => {
                    failureMap.set(row.MessageId, true);
                    client.channels
                        .resolve(row.ChannelId)
                        ?.send({
                        content: `<@!${row.PerpetratorId}>`,
                        embeds: [
                            kifo.embed(err, "Could not revert perms command!"),
                        ],
                    })
                        .catch((err) => {
                        main.log(err);
                    });
                });
            });
            previousMap.forEach((value, key) => {
                //apparently return only stops the CURRENT callback function, each iteration of for each loop is a separate function.
                if (failureMap.has(key))
                    return;
                let Output = result.filter((row) => row.MessageId === key);
                let r = Output[0];
                let Title = `Changed ${r.PermFlag} from ${value} to ${r.Command === "add"
                    ? "allow"
                    : r.Command === "rm"
                        ? "neutral"
                        : "deny"} for:\n`;
                let Description = "";
                Output.forEach((rr) => {
                    Description += `- <@${client.guilds
                        .resolve(rr.GuildId)
                        ?.members.resolve(rr.PermId) != null
                        ? "!"
                        : "&"}${rr.PermId}>\n`;
                });
                client.channels
                    .resolve(r.ChannelId)
                    ?.send({
                    content: `<@!${r.PerpetratorId}>`,
                    embeds: [kifo.embed(Description, Title)],
                })
                    .catch((err) => {
                    main.log(err);
                    client.guilds
                        .resolve(r.GuildId)
                        ?.members.resolve(r.PerpetratorId)
                        ?.send({
                        embeds: [kifo.embed(Description, Title)],
                    })
                        .catch((err) => {
                        main.log(err);
                    });
                });
            });
            con.query("DELETE FROM perms WHERE EndTime <= ?", [now], function (err1) {
                if (err1)
                    throw err1;
            });
        }
    });
}
function menusCheck() {
    let now = new Date(Date.now());
    con.query(
    /*sql*/
    `SELECT Id, GuildId, ChannelId, CmdMsgId, CmdChId, MessageId, PermName, EndDate, StartDate, DestinationChannelId FROM menu_perms WHERE EndDate <= ?`, [now], function (err, result) {
        if (err)
            throw err;
        if (result.length > 0) {
            result.forEach(async (row) => {
                let msg = await client.guilds
                    .resolve(row.GuildId)
                    ?.channels?.resolve(row.CmdChId)
                    ?.messages?.fetch(row.CmdMsgId);
                let menu = await client.guilds
                    .resolve(row.GuildId)
                    ?.channels?.resolve(row.CmdChId)
                    ?.messages?.fetch(row.MessageId);
                client.commands
                    .get("menu")
                    .revert(msg, menu, true, client.guilds
                    .resolve(row.GuildId)
                    ?.channels?.resolve(row.ChannelId), row.PermName);
            });
            main.log(`${result.length} perm menus found!`);
        }
    });
    con.query(
    /*sql*/
    `SELECT Id, GuildId, ChannelId, MessageId, RoleId, EndDate, StartDate, CmdMsgId, CmdChId FROM menu_roles WHERE EndDate <= ?`, [now], function (err, result) {
        if (err)
            throw err;
        if (result.length > 0) {
            result.forEach(async (row) => {
                let msg = await client.guilds
                    .resolve(row.GuildId)
                    ?.channels?.resolve(row.CmdChId)
                    ?.messages?.fetch(row.CmdMsgId);
                let menu = await client.guilds
                    .resolve(row.GuildId)
                    ?.channels?.resolve(row.CmdChId)
                    ?.messages?.fetch(row.MessageId);
                client.commands
                    .get("menu")
                    .revert(msg, menu, false, client.guilds
                    .resolve(row.GuildId)
                    ?.roles?.resolve(row.RoleId));
            });
            main.log(`${result.length} role menus found!`);
        }
    });
}
function pollsCheck() {
    con.query(
    /*sql*/
    `SELECT Id, UserId, GuildId, ChannelId, MessageId, EndTime FROM polls WHERE EndTime <= NOW()`, [], function (err, result) {
        if (err)
            throw err;
        if (result.length > 0) {
            main.log(`${result.length} role menus found!`);
            result.forEach(async (row) => {
                //fetch message, then show results of reactions desc, paste link to the original message
                let msg = await client.guilds
                    .resolve(row.GuildId)
                    ?.channels?.resolve(row.ChannelId)
                    ?.messages.fetch(row.MessageId);
                let questionEmbed = msg.embeds[0];
                let resultEmbed = kifo
                    .embed("", "Poll results")
                    .setURL(msg.url);
                await msg.fetch();
                let pos = 1;
                msg.reactions.cache
                    .sort((a, b) => b.count - a.count)
                    .each((r) => {
                    resultEmbed.addFields({
                        name: `${kifo.place(pos)} place:`,
                        value: `${r.emoji} - ${r.count} votes`
                    });
                    pos++;
                });
                msg.reply({
                    content: `<@!${row.UserId}>`,
                    embeds: [questionEmbed, resultEmbed],
                }).catch(() => {
                });
            });
            con.query("DELETE FROM polls WHERE EndTime <= NOW()", [], function (err) {
                if (err)
                    throw err;
            });
        }
    });
}
function countdownCheck() {
    con.query(
    /*sql*/
    `SELECT * FROM countdown c WHERE c.EndDate <= NOW()`, [], function (err, result) {
        if (err)
            throw err;
        if (result.length > 0) {
            result.forEach(async (row) => {
                let msg = await client.guilds
                    .resolve(row.GuildId)
                    ?.channels?.resolve(row.ChannelId)
                    ?.messages.fetch(row.MessageId);
                await msg.fetch();
                msg.reply({
                    content: `<@!${row.AuthorId}>`,
                    embeds: [
                        kifo
                            .embed(row.Message, "Countdown has ended!")
                            .setImage(`https://media.giphy.com/media/QAPFLCrpfalPi/giphy.gif?cid=790b7611d8c231ec8c2d7508d98b619526888e6ba98714ee&rid=giphy.gif&ct=g`),
                    ],
                }).catch(() => {
                    msg.member?.send({
                        embeds: [
                            kifo.embed(`Unable to send countdown finish message in <#${row.ChannelId}>!\n\n[__--Original message--__](${msg.url})`),
                        ],
                    });
                });
            });
            con.query(
            /*sql*/
            `DELETE FROM countdown WHERE EndDate <= NOW()`, [], function (err) {
                if (err)
                    throw err;
            });
            console.log(`${result.length} countdowns finished!`);
        }
    });
}
function updatePresence() {
    client.user?.setStatus("online");
    client.user?.setActivity({
        name: `Type "!kifo" to interact with me! I'm online for ${(0, ms_1.default)(client.uptime ?? 0, { long: true })}.`,
        type: discord_js_1.ActivityType.Playing,
    });
}
//USED BY REACT COMMAND
let reactreturn;
client.on("interactionCreate", async (interaction) => {
    let now = new Date(Date.now());
    if (!interaction.inGuild()) {
        if (interaction.isRepliable()) {
            interaction.reply({
                embeds: [
                    kifo.embed("Currently interactions only work in guilds. Sorry!"),
                ],
            });
        }
        return;
    }
    if (interaction.isChatInputCommand()) {
        main.log(`${interaction.user.tag} issued \`/${interaction.commandName}\` with these options:\n${interaction.options.data
            .map((o) => {
            if (o.type === discord_js_1.ApplicationCommandOptionType.Subcommand) {
                return `${o.name}: ${o.options
                    ?.map((subo) => `**${subo.name}** - ${subo.value}`)
                    .join(", ")}`;
            }
            else {
                return `- **${o.name}**: ${o.value}`;
            }
            //remember to add handling SUB_COMMAND_GROUP when I ever start using that
        })
            .join("\n")}\nin <#${interaction.channel?.id}> ${interaction.guild?.name}\n*at <t:${Math.floor(now.getTime() / 1000)}>, <t:${Math.floor(now.getTime() / 1000)}:R>*.`);
        // if (
        //     client.user.id === "796447999747948584" &&
        //     interaction.member?.roles.resolve("832194217493135400") === null
        // )
        //     return interaction.reply({
        //         embeds: [kifo.embed("Only testers can use this bot.")],
        //     }); TODO now all users can use test bot interactions
        if (client.slash_commands.has(interaction.commandName)) {
            try {
                client.slash_commands
                    .get(interaction.commandName)
                    .execute(interaction);
            }
            catch (error) {
                main.log(error);
            }
        }
        else {
            interaction.reply({
                embeds: [
                    kifo.embed("Unknown command! If this should not happen, please use `error` command and provide a description."),
                ],
            });
        }
    }
    if (interaction.isContextMenuCommand()) {
        if (client.context_menus.has(interaction.commandName)) {
            main.log(`${interaction.user.tag} issued \`${interaction.commandName}\` context menu for ${client.context_menus.get(interaction.commandName).type} in <#${interaction.channelId}> ${interaction.guild?.name}\n*at <t:${Math.floor(now.getTime() / 1000)}>, <t:${Math.floor(now.getTime() / 1000)}:R>*.`);
            try {
                client.context_menus
                    .get(interaction.commandName)
                    .execute(interaction);
            }
            catch (error) {
                main.log(error);
            }
        }
        else {
            interaction.reply({
                embeds: [
                    kifo.embed("How did this happen? We're smarter than this! (if you see this message, Kifo did some major fuck up in the backend, because logically speaking no one should ever see this)"),
                ],
            });
        }
    }
});
client.on("messageCreate", async (message) => {
    //this allows me to 1. catch stuff and 2. use async
    onmessage(message).catch((err) => {
        main.log(err);
    });
});
client.on("messageDelete", (message) => {
    try {
        if (menus.has(message.id)) {
            if (menus.get(message.id)?.isPerm) {
                let menu = menus.get(message.id); //TODO this needs to be a proper type
                client.commands
                    .get("menu")
                    .revert(message, message, menus.get(message.id)?.isPerm, message.guild?.channels.resolve(menu.DestinationChannelId), menu.PermName);
            }
            else {
                let menu = menus.get(message.id);
                client.commands
                    .get("menu")
                    .revert(message, message, menus.get(message.id)?.isPerm, message.guild?.roles.resolve(menu.RoleId));
            }
        }
    }
    catch (error) {
        main.log(error);
    }
});
client.on("messageDeleteBulk", (messages) => {
    messages
        .filter((msg) => menus.has(msg.id))
        .each((message) => {
        if (menus.has(message.id)) {
            if (menus.get(message.id)?.isPerm) {
                let menu = menus.get(message.id); //TODO this needs to be a proper type
                client.commands
                    .get("menu")
                    .revert(message, message, menus.get(message.id)?.isPerm, message.guild?.channels.resolve(menu.DestinationChannelId), menu.PermName);
            }
            else {
                let menu = menus.get(message.id);
                client.commands
                    .get("menu")
                    .revert(message, message, menus.get(message.id)?.isPerm, message.guild?.roles.resolve(menu.RoleId));
            }
        }
    });
});
//USED BY TODO COMMAND
client.on("messageReactionAdd", async (msgReaction, user) => {
    let msg = msgReaction.message;
    if (msg.partial) {
        await msg.fetch().catch(() => {
        });
    }
    if (user.partial) {
        await user.fetch().catch(() => {
        });
    }
    if (msg.channel.type === discord_js_1.ChannelType.DM && msg.author?.bot) {
        if (user.id !== client.user?.id) {
            if (msg.embeds[0]?.author?.name === `TODO`) {
                msg.delete().catch(() => {
                });
            }
            if (msgReaction.emoji.id === "857976926542757910")
                msg.delete().catch(() => {
                });
        }
    }
    else if (menus.has(msg.id) && !user.bot) {
        let menu = menus.get(msg.id);
        if (menu?.isPerm) {
            // @ts-ignore TODO channel can be Thread Channel which does not have perm overwrites
            let channel = msg.guild?.channels.resolve(menu.DestinationChannelId);
            //If someone has specifically denied perms, they shouldn't be able to use the menu
            if (channel?.permissionOverwrites?.resolve(user.id)?.deny.has(BigInt(discord_js_1.PermissionFlagsBits[menu?.PermName] ?? 0)))
                return;
            await channel?.permissionOverwrites.create(user.id, {
                [menu.PermName]: true,
            })
                .then(() => {
                if (menu?.isPerm) {
                    user.send({
                        embeds: [
                            kifo.embed(`You now have <:GreenCheck:857976926941478923> \`${menu?.PermName}\` in <#${menu?.DestinationChannelId}>!`),
                        ],
                    }).catch(() => {
                    });
                }
            })
                .catch((err) => {
                main.log(err);
                if (menu?.isPerm) {
                    msg.reply({
                        embeds: [
                            kifo.embed(`Could not give \`${menu?.PermName}\` for <@!${user.id}>!\n${err.message}`),
                        ],
                    });
                }
            });
        }
        else {
            let role = msg.guild?.roles.resolve(menu?.RoleId ?? "");
            let member = msg.guild?.members.resolve(user.id);
            if (member != undefined) {
                if (menu?.isPerm) {
                    return;
                }
                member.roles
                    .add(menu?.RoleId ?? "", "Used Role Menu!")
                    .then(() => member?.send({
                    embeds: [
                        kifo.embed(
                        // @ts-ignore
                        `Gave you __**${role?.name}**__ role! (Id: ${menu?.RoleId})`),
                    ],
                })
                    .catch(() => {
                }))
                    .catch((err) => {
                    if (menu?.isPerm) {
                        return;
                    }
                    msg.reply({
                        embeds: [
                            kifo.embed(`Could not give <@&${menu?.RoleId}> to <@!${user.id}>!\n${err.message}`),
                        ],
                    }).catch(() => {
                    });
                });
            }
        }
    }
});
client.on("messageReactionRemove", async (msgReaction, user) => {
    let msg = msgReaction.message;
    if (msg.partial) {
        await msg.fetch().catch(() => {
        });
    }
    if (user.partial) {
        await user.fetch().catch(() => {
        });
    }
    if (menus.has(msg.id) && !user.bot) {
        let menu = menus.get(msg.id);
        if (menu?.isPerm) {
            // @ts-ignore
            let channel = msg.guild?.channels.resolve(menu.DestinationChannelId);
            channel?.permissionOverwrites.create(user.id, {
                [menu.PermName]: null,
            })
                .then(() => {
                if (!menu?.isPerm) {
                    return;
                }
                user.send({
                    embeds: [
                        kifo.embed(`Set <:GreySlash:857976926445502505> \`${menu?.PermName}\` in <#${menu?.DestinationChannelId}>!`),
                    ],
                }).catch(() => {
                });
            })
                .catch((err) => {
                main.log(err);
                if (!menu?.isPerm) {
                    return;
                }
                msg.reply({
                    embeds: [
                        kifo.embed(`Could not remove \`${menu?.PermName}\` for <@!${user.id}>!\n${err.message}`),
                    ],
                });
            });
        }
        else {
            let role = msg.guild?.roles.resolve(menu?.RoleId ?? "");
            let member = msg.guild?.members.resolve(user.id);
            if (member != undefined) {
                if (menu?.isPerm) {
                    return;
                }
                member.roles
                    .remove(menu?.RoleId ?? "", "Used Role Menu!")
                    .then(() => member?.send({
                    embeds: [
                        kifo.embed(
                        // @ts-ignore
                        `Removed **__${role?.name}__** role! (Id: ${menu?.RoleId})`),
                    ],
                })
                    .catch(() => {
                }))
                    .catch((err) => {
                    if (menu?.isPerm) {
                        return;
                    }
                    msg.reply({
                        embeds: [
                            kifo.embed(`Could not remove <@&${menu?.RoleId}> from <@!${user.id}>!\n${err.message}`),
                        ],
                    }).catch(() => {
                    });
                });
            }
        }
    }
});
//kifo-advanced-logs
client.on("guildCreate", async (guild) => {
    let date = new Date(Date.now());
    let channel = client.guilds
        .resolve("822800862581751848")
        ?.channels?.resolve("863769411700785152");
    const embed = new discord_js_1.EmbedBuilder()
        .setColor("#a039a0")
        .setThumbnail(guild.iconURL() ?? "")
        .setTitle("New Server!")
        .addFields({ name: "Server Name", value: guild?.name ?? "unknown", inline: true }, { name: "Server Id", value: guild?.id ?? "unknown", inline: true }, { name: "Owner", value: `<@${guild?.ownerId ?? "unknown"}>`, inline: true }, { name: "Member Count", value: guild?.memberCount.toString() ?? "unknown", inline: true })
        .setFooter({ text: "Joined at: " + date.toUTCString() });
    channel?.send({ embeds: [embed] }).catch((err) => {
        main.log(err);
    });
});
//kifo-advanced-logs
client.on("guildDelete", (guild) => {
    let date = new Date(Date.now());
    let channel = client.guilds
        .resolve("822800862581751848")
        ?.channels?.resolve("863769411700785152");
    const embed = new discord_js_1.EmbedBuilder()
        .setColor("#a039a0")
        .setThumbnail(guild?.iconURL() ?? "")
        .setTitle("Removed from a server :(")
        .addFields({ name: "Server Name", value: guild?.name ?? "unknown", inline: true }, { name: "Server Id", value: guild?.id ?? "unknown", inline: true }, { name: "Owner", value: `<@${guild?.ownerId ?? "unknown"}>`, inline: true }, { name: "Member Count", value: guild?.memberCount.toString() ?? "unknown", inline: true })
        .setFooter({ text: "Left at: " + date.toUTCString() });
    channel?.send({ embeds: [embed] }).catch((err) => {
        main.log(err);
    });
});
//kifo-logs
client.on("error", (err) => {
    main.log(err);
});
//kifo-logs
client.on("warn", (info) => {
    let channel = client.guilds
        .resolve("822800862581751848")
        ?.channels?.resolve("864112365896466432");
    return channel
        ?.send({ embeds: [kifo.embed(`${info}`, "WARNING")] })
        .catch((err) => {
        main.log(err);
    });
});
//kifo-advanced-logs
client.on("guildUnavailable", async (guild) => {
    let channel = client.guilds
        .resolve("822800862581751848")
        ?.channels?.resolve("863769411700785152");
    let owner = await guild.fetchOwner();
    channel
        ?.send({
        embeds: [
            kifo.embed(`A guild "${guild?.name ?? "unknown"}", Id ${guild.id}, Owner: <@${guild?.ownerId ?? "unknown"}>, ${owner.nickname} has become unavailable!`),
        ],
    })
        .catch((err) => {
        main.log(err);
    });
});
/**
 *
 * @param {string} guildId the Id of the guild you want to get prefix for.
 * @returns prefix for the guild (default "!kifo ")
 */
exports.prefix = async function (guildId) {
    if (client.user?.id === "796447999747948584")
        return "!ktest ";
    if (prefixes.has(guildId))
        return prefixes.get(guildId);
    return "!kifo ";
};
/**
 * Logs in #kifo-logs
 * @param {string} log the message you want to log
 * @param args
 * @returns Promise, in case something breaks
 */
exports.log = function (log, ...args) {
    if (!client?.isReady()) {
        return console.log(log, ...args);
    }
    let channel = client.guilds
        .resolve("822800862581751848")
        ?.channels?.resolve("864112365896466432");
    if (log instanceof Error) {
        const now = new Date(Date.now());
        return channel
            ?.send({
            content: `<@!289119054130839552>`,
            embeds: [
                kifo.embed(`${log.stack}\n\nAt <t:${Math.floor(now.getTime() / 1000)}>, <t:${Math.floor(now.getTime() / 1000)}:R>\nOther args: ${args.join(" ")}`, `CRITICAL ERROR`),
            ],
        })
            .catch((err) => console.log(err));
    }
    return channel
        ?.send({ embeds: [kifo.embed(`${log} ${args.join(" ")}`, "LOG")] })
        .catch((err) => {
        main.log(err);
    });
};
client.login(process.env.LOGIN_TOKEN);
process.on("uncaughtException", async (err) => {
    console.error(err);
    console.log(err);
    await main.log(err);
});
//# sourceMappingURL=index.js.map
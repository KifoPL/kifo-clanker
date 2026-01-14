import { ApplicationCommandOptionType, Collection, Snowflake, ThreadAutoArchiveDuration } from "discord.js";
declare module 'discord.js' {
    interface Client {
        commands: Collection<string, any>;
        slash_commands: Collection<string, any>;
        context_menus: Collection<string, any>;
    }
}
export type ArchiveType = "1h" | "1d" | "3d" | "1w";
export type SlowmodeType = "0s" | "5s" | "10s" | "15s" | "30s" | "1m" | "2m" | "5m" | "10m" | "15m" | "30m" | "1h" | "2h" | "6h";
export declare function GetArchiveDuration(duration: ArchiveType): ThreadAutoArchiveDuration;
export interface MenuRolesInterface {
    MessageId: Snowflake;
    ChannelId: Snowflake;
    GuildId: Snowflake;
    isPerm: false;
    RoleId: Snowflake;
}
export interface MenuPermsInterface {
    MessageId: Snowflake;
    ChannelId: Snowflake;
    GuildId: Snowflake;
    isPerm: true;
    DestinationChannelId: Snowflake;
    PermName: string;
}
export type MenuType = MenuRolesInterface | MenuPermsInterface;
export interface TicketingsInterface {
    ChannelId: string;
    GuildId: Snowflake;
    ArePublic: boolean;
    DefaultArchive: ArchiveType;
    DefaultSlowmode: SlowmodeType;
}
export interface AutothreadingsInterface {
    GuildId: string;
    ChannelId: string;
    DefaultArchive: ArchiveType;
    DefaultSlowmode: SlowmodeType;
    BotAuto: boolean;
    Title: string;
}
export interface GiveawayInterface {
    Id: string;
    MessageId: Snowflake;
    ChannelId: Snowflake;
    GuildId: Snowflake;
    UserId: Snowflake;
    Winners: Snowflake[];
}
export interface KifoCommandInterface {
    name: string;
    description: string;
    options: {
        name: string;
        type: ApplicationCommandOptionType;
        description: string;
        options: {
            name: string;
            required: boolean;
            description: string;
        }[];
        required: boolean;
    }[];
    perms: string[];
}

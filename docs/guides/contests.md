---
title: Reaction contests and giveaways
permalink: /docs/guides/contests/
---
{% include docs-nav.html %}

# Reaction contests and giveaways

Use `/top` to rank posts by reactions. Use `/giveaway` to choose random winners from people who react before a deadline.

## Rank the most-loved posts

```text
/top winners:3 duration:7d channel:#art emoji:⭐
```

Choose 1–10 winning posts, a period from 10 seconds to 14 days, a channel, and the reaction to count. Unicode emojis, custom emojis, and custom emoji IDs are supported.

You need **Manage Channels** in both the command channel and the scanned channel. Both you and the bot need **View Channel** and **Read Message History** in the source; private threads also require your access.

The ranking keeps one post per author. Equal scores share a place, and posts tied at the final cutoff are included. Same-channel results are public; results from another channel arrive in your DMs. Keep DMs open for cross-channel contests.

Use **Cancel scan** to stop a scan. Scans stop after 50,000 messages or two minutes; any incomplete coverage is clearly reported. At most 100 tied winning posts are shown.

## Choose random winners

```text
/giveaway winners:2 duration:1h emoji:🎉
```

The bot posts a giveaway message in the current channel. Members react with the chosen emoji to enter; when the deadline arrives, the bot chooses distinct eligible entrants and announces the result. Bots are excluded. If you omit `emoji`, the entry reaction is ✅.

You need **Manage Channels**. The bot needs channel access, permission to post and react, and message history. Winners are saved before announcement so a restart does not reroll them.

[Ranking options](../commandList.md#top) · [Giveaway options](../commandList.md#giveaway)

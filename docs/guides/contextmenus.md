---
title: Message and member actions
permalink: /docs/guides/contextmenus/
---
{% include docs-nav.html %}

# Message and member actions

Open a message or member’s context menu and choose **Apps**. On desktop, right-click or open the message’s **…** menu. On mobile, open the message or member’s action menu; the exact placement of **Apps** depends on your Discord client.

Kifo Clanker provides three actions:

| Action | Target | Result |
|---|---|---|
| **save** | Message | A DM copy of its text and attachments. React with ❌ to delete the copy. |
| **detect language** | Message | A private language-detection result with confidence and reliability. |
| **user stats** | Server member | Private account, membership, role, presence, and other statistics. |

The bot checks that both you and it can read the selected message’s channel. Private threads also require access to the thread.

## Save something for later

Choose **Apps → save** on a message. Open your DMs with Kifo Clanker to find the copy. Keep DMs enabled; attachment copies have a total 9 MiB limit, so use the original message link for larger files.

You can also use `/bookmark message:<link>` and optionally choose `pin:true`, or `/todo text:<task>` to leave yourself a pinned task. For a task based on a message, use `/todo link:<message link> text:<note>`. React to a to-do note to complete it and remove it.

## Detect a language

Choose **Apps → detect language**, or use `/lang message:<link>`. The message must contain text. If detection is unavailable, the bot operator needs to configure the language provider.

[See all context actions](../commandList.md#context-menus).

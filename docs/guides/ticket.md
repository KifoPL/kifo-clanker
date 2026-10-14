---
title: Creating a ticket
permalink: /docs/guides/ticket/
---
{% include docs-nav.html %}

# Creating a ticket

A ticket gives your question or problem its own thread, keeping related answers together. Use `/ticket` in a channel where moderators have enabled ticketing.

1. Choose a brief `title` that describes the question.
2. Add an optional `description` with the details someone needs to help.
3. Send the command and open the thread linked in the bot’s private response.

```text
/ticket title:How do I join the event? description:I can see the event channel but cannot sign up.
```

The channel’s configuration determines whether your ticket is public or private. A public ticket can be read by people with access to its channel. A private ticket is a private thread that includes you; moderators with **Manage Threads** can access it. Only share information suitable for that audience.

You need **View Channel**, **Use Application Commands**, and **Send Messages in Threads**. If the channel is not configured for tickets, ask a moderator to check `/ticketing list`.

## Help people help you

Search existing answers first. Keep the title specific, include the steps you tried, and thank people who take time to respond. The thread title uses the first 100 characters of your title; the full title remains in the ticket’s message.

[Ticket options](../commandList.md#ticket) · [Administrator setup](ticketing.md)

---
title: Kifo Clanker™
---
{% include docs-nav.html %}

<div class="hero">
  <div>
    <p class="eyebrow">35 slash commands · 3 context menus</p>
    <h2>Unorthodox commands.<br>Extraordinary communities.</h2>
    <p>Kifo Clanker handles the fiddly jobs: temporary roles, channel permissions, reaction contests, and conversations that deserve their own thread.</p>
    <p>Built by <a href="https://github.com/KifoPL">KifoPL</a>, with a little Star Wars spirit.</p>
  </div>
  <img src="{{ '/docs/images/promo/new%20logo%20SQUARE%20resized.png' | relative_url }}" alt="Kifo Clanker logo" width="150" height="150">
</div>

<div class="actions">
  <a class="primary" href="https://discord.com/oauth2/authorize?client_id=795638549730295820&amp;scope=bot%20applications.commands&amp;permissions=120528432320">Invite to Discord</a>
  <a href="{{ '/docs/commandList/' | relative_url }}">Explore the commands</a>
</div>

## A few things your server can do

<div class="feature-grid">
  <article class="feature">
    <h3>Run a reaction contest</h3>
    <p>Find the most-loved posts, keep one entry per author, and give tied scores the same place. Cross-channel results arrive privately in your DMs.</p>
    <span class="command">/top winners:3 duration:7d channel:#art emoji:⭐</span>
  </article>
  <article class="feature">
    <h3>Make roles temporary</h3>
    <p>Remove a role for a chosen period and restore it when time is up. Review the action before confirming.</p>
    <span class="command">/remove member:@member role:@role duration:1h</span>
  </article>
  <article class="feature">
    <h3>Let members opt in</h3>
    <p>Create reaction menus for roles or channel access. Removing a reaction restores the member’s captured previous state.</p>
    <span class="command">/menu role role:@Announcements</span>
  </article>
  <article class="feature">
    <h3>Give every question a home</h3>
    <p>Offer public or private ticket threads, or automatically start a discussion under each new post.</p>
    <span class="command">/ticket title:How do I join the event?</span>
  </article>
  <article class="feature">
    <h3>Get to know your server</h3>
    <p>Check member, role, and server stats, or export a roster filtered by roles and channel visibility.</p>
    <span class="command">/list roles role:@Members channel:#events</span>
  </article>
  <article class="feature">
    <h3>Keep useful things close</h3>
    <p>Save a message with its attachments, leave yourself a pinned to-do note, or create a countdown with alerts.</p>
    <span class="command">Right-click a message → Apps → save</span>
  </article>
</div>

## Start with `/help`

Type `/` in Discord and choose Kifo Clanker. Discord shows each command’s description, required inputs, and available choices. Use `/help` for a command overview or `/guide` to open a walkthrough.

[Getting started]({{ '/docs/guides/slash/' | relative_url }}) · [All guides]({{ '/docs/guideList/' | relative_url }}) · [Command reference]({{ '/docs/commandList/' | relative_url }})

## May the force be with your community

Have an idea, need a hand, or spotted something unexpected? Join the [support server](https://discord.gg/HxUFQCxPFp) or [open an issue](https://github.com/KifoPL/kifo-clanker/issues/new/choose).

[Vote on top.gg](https://top.gg/bot/795638549730295820) · [Support development](https://www.buymeacoffee.com/kifoPL) · [KifoPL’s links](https://bio.link/kifopl)

Self-hosting? The [deployment and migration guide]({{ '/docs/MIGRATION/' | relative_url }}) covers Docker, Aspire, PostgreSQL, and the checks required before production cutover.

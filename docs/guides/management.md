---
title: Roles and channel permissions
permalink: /docs/guides/management/
---
{% include docs-nav.html %}

# Roles and channel permissions

Choose Discord members, roles, and channels directly in the command picker. Management actions check your permissions and the bot’s permissions in the target channel; role actions also check both role hierarchies.

## Remove a role temporarily

```text
/remove member:@member role:@role duration:1h
```

Review the confirmation before applying the change. The role is restored after the selected duration. Omit `duration` for a permanent removal. You and the bot need **Manage Roles**, and the target member and role must be below both of your applicable highest roles.

## Change a channel permission

```text
/perms set permission:SendMessages state:deny user:@member duration:10m channel:#events
```

Choose `allow`, `deny`, or `inherit`. A temporary change restores the captured previous overwrite, including inherited state, while preserving detectable later edits. Use `/perms report` to export overwrites and `/perms info` to see supported aliases.

The bot prompts you to confirm changes. `/clean` removes empty permission overwrites after review; cleaning every channel requires **Administrator**.

## Create an opt-in reaction menu

```text
/menu role role:@Announcements
/menu permission permission:ViewChannel channel:#events duration:1d
```

The bot posts a menu and adds its entry reaction. Eligible members react to receive the role or permission; removing their reaction restores their captured previous state. Optional `duration` reverts the menu after the selected period.

Menu creation requires **Manage Channels**; role menus also need valid role hierarchy and role management. Elevated grants require the creator and bot to hold the granted permissions and review a confirmation.

Use `/menu list` to find configured menus and `/menu revert message:<menu link>` to revert one. Existing roles and unrelated channel permissions are preserved.

[Role removal](../commandList.md#remove) · [Permissions](../commandList.md#perms) · [Reaction menus](../commandList.md#menu)

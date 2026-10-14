---
title: Dates and Discord timestamps
permalink: /docs/guides/epoch/
---
{% include docs-nav.html %}

# Dates and Discord timestamps

Unix time counts seconds from `1970-01-01T00:00:00Z`. Discord uses these seconds to show a date in each reader’s local timezone.

## Convert a date to seconds

```text
/epoch date_to_epoch input:2000-01-01T00:00:00Z
```

The result is `946684800`, also returned as copyable message text. Use an ISO date such as `2026-10-14`, or a date and time with an explicit offset such as `2026-10-14T20:00:00+02:00`.

Dates and datetimes without an offset use UTC. Invalid calendar dates are rejected rather than silently rolled into another month.

The same `input` accepts a relative duration: `1h`, `1 hour`, `3d`, or `-1m`. The bot adds it to the current time; a negative duration points into the past. Each duration belongs in a single Discord text input.

## Convert seconds back to a date

```text
/epoch epoch_to_date epoch:946684800
```

The result is `2000-01-01T00:00:00.000Z`. Use **seconds**, not milliseconds. Zero and negative epoch values are supported when the date is within range.

## Format a timestamp in Discord

Paste `<t:946684800:F>` into a message. Replace the number with your epoch and choose a style:

| Style | Format | Example form |
|---|---|---|
| `t` | Short time | `00:00` |
| `T` | Long time | `00:00:00` |
| `d` | Short date | `01/01/2000` |
| `D` | Long date | `1 January 2000` |
| `f` | Short date and time | `1 January 2000 00:00` |
| `F` | Long date and time | `Saturday, 1 January 2000 00:00` |
| `R` | Relative time | `in 1 hour` or `1 hour ago` |

The wording, date order, and timezone follow each reader’s Discord locale and device settings. If you omit the style, Discord uses `f`.

[Command options](../commandList.md#epoch) · [Discord timestamp reference](https://discord.com/developers/docs/reference#message-formatting-timestamp-styles)

# Daggerheart Stats Importer

An unofficial Foundry VTT module for importing Daggerheart adversary statblocks from plain text.

The module reads the current `Tier <number> <role>` statblock layout, creates adversary actors for the Foundryborne Daggerheart system, and builds feature items with best-effort attack, damage, and effect actions.

This module is not affiliated with or endorsed by Darrington Press.

## Requirements

- Foundry VTT 13 or 14
- Daggerheart system 2.0.0 or newer
- Game Master role to import adversaries

## Installation

### Manifest URL

Install the module in Foundry VTT using this manifest URL:

```text
https://github.com/hundrog/dh-stat-importer/releases/latest/download/module.json
```

### Manual installation

Place the module folder at:

```text
FoundryVTT/Data/modules/dh-stat-importer
```

For local development, a symlink works too:

```bash
ln -s /path/to/dh-adversary-importer \
  /path/to/FoundryVTT/Data/modules/dh-stat-importer
```

Then enable **Daggerheart Stats Importer** in your world's module settings.

## Usage

1. Open your world as a Game Master.
2. Open the importer using either:
   - Token controls → **Import Adversary**
   - The **Import Adversary** button in the Actors sidebar
   - The API: `game.modules.get("dh-stat-importer").api.open()`
3. Paste one or more statblocks into the dialog.
4. Click **Import**.

Imported actors are created in the Actors directory. When importing a single statblock, its sheet opens automatically.

## Statblock format

The importer expects the newer plain-text format that starts with a `Tier` line. Older statblock layouts are not supported.

### Skeleton

```text
ADVERSARY NAME
Tier <number> <role>
Description text, which may span multiple lines.
Motives & Tactics: Motive one, motive two, motive three

Difficulty: <number> | Thresholds: <major>/<severe> | HP: <number> | Stress: <number>
ATK: <bonus> | <attack name>: <range> | <damage> <phy|mag>
Experience: <name> +<bonus>, <name> +<bonus>

HP: □ □ □
Stress: □ □ □

Features
Feature Name - Passive|Action|Reaction: Feature description, which may span
multiple lines.
```

The only required lines are the adversary name and the `Tier <number> <role>` line. Everything else may be omitted, though missing attributes will be left unset and reported in a warning.

### Fields

- **Name**: The first non-empty line.
- **Tier**: Must follow the name and use the form `Tier 1 Solo`, `Tier 2 Bruiser`, `Tier 3 Support`, etc.
- **Description**: Text between the tier line and `Motives & Tactics`, or before the first stat line.
- **Motives & Tactics**: May continue across multiple lines.
- **Difficulty / Thresholds / HP / Stress**: Can be on one pipe-separated line, or supplied with separate `HP:` and `Stress:` lines.
- **Attack**: Uses the form `ATK: +2 | Attack Name: Melee | 1d8+2 phy`.
- **Experiences**: Comma-separated entries with signed bonuses, such as `Be Ale +3, Used Mount Salesman +2`.
- **HP and Stress boxes**: If used instead of numbers, boxes are counted. Both `□ □ □` and `[ ] [ ] [ ]` work.
- **Features**: Starts with `Features` or `FEATURES`. Each feature follows `Name - Type: Description`, where type is `Passive`, `Action`, or `Reaction`.
- **Feature values**: Optional values in parentheses are preserved, e.g. `Relentless (3) - Passive: ...`.
- **Multi-line text**: Descriptions, motives, and feature text may span multiple lines.

### Complete example

```text
CRYSTAL WARDEN
Tier 2 Bruiser
A humming guardian made of translucent stone, bound to protect
the ruined grove.
Motives & Tactics: Guard the grove, shatter intruders, rebuild

Difficulty: 13 | Thresholds: 7/14 | HP: 6 | Stress: 3
ATK: +3 | Crystal Slam: Melee | 1d10+2 phy
Experience: Ancient Guardian +2, Rooted +2

Features
Crystal Skin - Passive: The Warden has resistance to physical damage
while standing on stone.
Shatter - Action: Spend a Fear to make an attack against all targets
within Very Close range, dealing 2d6 mag damage.
Last Light - Reaction: When the Warden is reduced to 0 Hit Points, it
bursts in a flash of light.
```

### Partial example

Missing stats are allowed. The importer creates the actor and warns about which attributes were not provided.

```text
THE HOLLOW WITNESS
Tier 3 Leader
A faceless figure that watches from the edge of every gathering.
Motives & Tactics: Observe, divide, reveal secrets

Features
Unblinking - Passive: The Witness cannot be surprised.
Whispered Doubt - Action: Mark a Stress to force a target within Close
range to make a Presence Reaction Roll.
```

## Batch import

Separate multiple statblocks with a line containing only `---`:

```text
CRYSTAL WARDEN
Tier 2 Bruiser
...

---
THE HOLLOW WITNESS
Tier 3 Leader
...
```

Batch import is atomic: every statblock is parsed before any actors are created. If one block is invalid, nothing is imported.

## Old format

Statblocks using the previous layout are rejected. For example, this is **not** supported:

```text
ACID BURROWER T1 Solo
Difficulty: 14
Attack: +3
```

Use the `Tier <number> <role>` format instead.

## What gets created

- Adversary actors with tier, role, difficulty, damage thresholds, HP, Stress, motives and tactics, description, experiences, and attack data.
- Feature items with `Passive`, `Action`, or `Reaction` feature forms.
- Best-effort feature actions:
  - Attack actions when the feature describes an attack.
  - Damage actions when a damage formula is present without an attack.
  - Effect actions otherwise.
  - Costs for Fear, Stress, Hope, Armor Slots, and HP are detected when possible.
  - Save traits, ranges, and damage formulas are detected when possible.

Actor roles are mapped to the Daggerheart system's adversary types. Unknown roles fall back to `Standard`.

## API

Open the importer from a macro or script:

```js
game.modules.get("dh-stat-importer").api.open();
```

The API also exposes:

```js
game.modules.get("dh-stat-importer").api.StatblockParser;
game.modules.get("dh-stat-importer").api.DaggerheartActorCreator;
game.modules.get("dh-stat-importer").api.ImportDialog;
```

## Development

No build step is required. Run the tests with:

```bash
npm test
```

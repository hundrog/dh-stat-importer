# Daggerheart: Statblock Importer

An unofficial Foundry VTT module for importing Daggerheart adversary and environment statblocks from plain text.

The module reads the current `Tier <number> <role>` statblock layout, creates actors for the Foundryborne Daggerheart system, and builds feature items with best-effort attack, damage, and effect actions.

This module is not affiliated with or endorsed by Darrington Press.

## Requirements

- Foundry VTT 13 or 14
- Daggerheart system 2.0.0 or newer
- Game Master role to import statblocks

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
ln -s /path/to/dh-stat-importer \
  /path/to/FoundryVTT/Data/modules/dh-stat-importer
```

Then enable **Daggerheart: Statblock Importer** in your world's module settings.

## Usage

1. Open your world as a Game Master.
2. Open the importer using either:
   - Token controls → **Import Statblock**
   - The **Import Statblock** button in the Actors sidebar
   - The API: `game.modules.get("dh-stat-importer").api.open()`
3. Select **Adversary** or **Environment** at the top of the dialog.
4. Paste one or more statblocks into the dialog.
5. Click **Import**.

Imported actors are created in the Actors directory. When importing a single statblock, its sheet opens automatically.

## Statblock formats

The importer expects the newer plain-text format that starts with a `Tier` line. Other statblock layouts are not supported. The selected type applies to every statblock in the dialog, so keep adversary and environment imports separate.

### Adversary format

#### Skeleton

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

The only required lines are the adversary name and the `Tier <number> <role>` line. Everything else may be omitted, though missing attributes will be left unset and reported in a warning except for the HP and Stress Squares which will be populated using the text from above.

#### Adversary fields

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

#### Adversary example

```text
JAGGED KNIFE BANDIT
Tier 1 Standard
A cunning criminal in a cloak bearing one of the gang’s iconic knives.
Motives & Tactics: Escape, profit, steal, throw smoke
Difficulty: 12 | Thresholds: 8/14 | HP: 5 | Stress: 3
ATK: +1 | Daggers: Melee | 1d8+1 phy
Experience: Thief +2
FEATURES
Climber - Passive: The Bandit climbs just as easily as they run.
From Above - Passive: When the Bandit succeeds on a standard
attack from above a target, they deal 1d10+1 physical damage
instead of their standard damage.
```

#### Partial adversary example

Missing stats are allowed. The importer creates the actor and warns about which attributes were not provided.

```text
JAGGED KNIFE LIEUTENANT
Tier 1 Leader
A seasoned bandit in quality leathers with a strong voice and
cunning eyes.
Motives & Tactics: Bully, command, profit, reinforce

Features
Tactician - Action: When you spotlight the Lieutenant, mark a
Stress to also spotlight two allies within Close range.
More Where That Came From - Action: Summon three Jagged Knife
Lackeys, who appear at Far range.
Coup de Grace - Action: Spend a Fear to make an attack against a
Vulnerable target within Close range. On a success, deal 2d6+12
physical damage and the target must mark a Stress.
Momentum - Reaction: When the Lieutenant makes a successful
attack against a PC, you gain a Fear
```

### Environment format

#### Skeleton

```text
ENVIRONMENT NAME
Tier <number> <Exploration|Social|Traversal|Event>
Description text, which may span multiple lines.
Impulses: Impulse one, impulse two, impulse three

Difficulty: <number>
Potential adversaries: <group> (<name>, <name>), <group> (<name>, <name>)

FEATURES
Feature Name - Passive|Action|Reaction: Feature description, which may span
multiple lines.
```

The only required lines are the environment name and the `Tier <number> <type>` line. The tier type must be `Exploration`, `Social`, `Traversal`, or `Event`. Missing difficulty is left unset and reported in a warning.

#### Environment fields

- **Impulses**: May continue across multiple lines.
- **Difficulty**: A single number, such as `Difficulty: 14`.
- **Potential adversaries**: Comma-separated groups, with adversary names in parentheses. Commas inside parentheses are preserved.
- **Features**: Uses the same feature syntax as adversary statblocks.
- **GM prompts**: Question lines that follow a feature are appended to that feature's description.
- **Potential adversary links**: Groups are imported as unlinked headings in the environment's Potential Adversaries tab. The module does not search for or link matching actors.

#### Environment example

```text
AMBUSHERS
Tier 1 Event
An ambush is set by the PCs to catch unsuspecting adversaries
off-guard.
Impulses: Escape, group up, protect the most vulnerable
Difficulty: Special (see “Relative Strength”)
Potential Adversaries: Any
FEATURES
Relative Strength - Passive: The Difficulty of this environment
equals that of the adversary with the highest Difficulty.
Which adversary is the least prepared? Which one is the most?
Where Did They Come From? - Reaction: When a PC starts the
ambush on unsuspecting adversaries, you lose 2 Fear and the
first attack roll a PC makes has advantage.
What are the adversaries in the middle of doing when the ambush
starts? How does this impact their approach to the fight?
```

## Batch import

Separate multiple statblocks of the selected type with a line containing only `---`:

```text
APPRENTICE ASSASSIN
Tier 2 Minion
...

---
ADULT FLICKERFLY
Tier 3 Solo
...
```

Batch import is atomic: every statblock is parsed before any actors are created. If one block is invalid, nothing is imported. Adversary and environment blocks cannot be mixed in one batch.

## What gets created

- Adversary actors with tier, role, difficulty, damage thresholds, HP, Stress, motives and tactics, description, experiences, and attack data.
- Environment actors with tier, type, impulses, difficulty, description, and unlinked potential-adversary groups.
- Feature items with `Passive`, `Action`, or `Reaction` feature forms.
- Best-effort feature actions:
  - Attack actions when the feature describes an attack.
  - Damage actions when a damage formula is present without an attack.
  - Effect actions otherwise.
  - Costs for Fear, Stress, Hope, Armor Slots, and HP are detected when possible.
  - Save traits, ranges, and damage formulas are detected when possible.

Adversary roles are mapped to the Daggerheart system's adversary types. Unknown adversary roles fall back to `Standard`. Environment types must be `Exploration`, `Social`, `Traversal`, or `Event`.

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

Use parser kind `environment` for environment statblocks:

```js
const Parser = game.modules.get("dh-stat-importer").api.StatblockParser;
const parser = new Parser({ kind: "environment" });
const environments = parser.parseAll(text);
```

## Development

No build step is required. Run the tests with:

```bash
npm test
```

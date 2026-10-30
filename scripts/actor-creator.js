const MODULE_ID = "dh-stat-importer";
const ACTOR_ICON = "systems/daggerheart/assets/icons/documents/actors/dragon-head.svg";
const ENVIRONMENT_ICON = "systems/daggerheart/assets/icons/documents/actors/forest.svg";
const FEATURE_ICON = "systems/daggerheart/assets/icons/documents/items/stars-stack.svg";
const ATTACK_ICON = "icons/skills/melee/blood-slash-foam-red.webp";
const KNOWN_ADVERSARY_TYPES = [
  "bruiser",
  "horde",
  "leader",
  "minion",
  "ranged",
  "skulk",
  "social",
  "solo",
  "standard",
  "support"
];

/**
 * Creates Daggerheart adversary actors and feature items from parsed data.
 */
export class DaggerheartActorCreator {
  constructor({ debug = false } = {}) {
    this.debug =
      debug ||
      globalThis.game?.settings?.get?.(MODULE_ID, "debugMode") ||
      false;
  }

  /**
   * Create an actor and its embedded feature items.
   * @param {object} parsedData
   * @returns {Promise<Actor>}
   */
  async createActor(parsedData) {
    const actorData = this.buildActorData(parsedData);
    return this.createActorData(actorData);
  }

  /**
   * Create a Foundry actor from pre-built source data.
   * @param {object} actorData
   * @returns {Promise<Actor>}
   */
  async createActorData(actorData) {
    if (globalThis.game?.system?.id !== "daggerheart") {
      throw new Error("This module requires the Daggerheart system.");
    }

    const actor = await Actor.create(actorData);
    this._debug("Created actor", actor);
    return actor;
  }

  /**
   * Build the actor source data without creating a Foundry document.
   * @param {object} parsedData
   * @returns {object}
   */
  buildActorData(parsedData) {
    return parsedData.kind === "environment"
      ? this.buildEnvironmentActorData(parsedData)
      : this.buildAdversaryActorData(parsedData);
  }

  buildAdversaryActorData(parsedData) {
    const system = {
      tier: parsedData.tier,
      type: this._mapRole(parsedData.roleId)
    };

    if (parsedData.difficulty !== null) {
      system.difficulty = parsedData.difficulty;
    }

    if (
      parsedData.thresholds?.major !== null &&
      parsedData.thresholds?.severe !== null
    ) {
      system.damageThresholds = {
        major: parsedData.thresholds.major,
        severe: parsedData.thresholds.severe
      };
    }

    const resources = {};
    if (parsedData.hitPoints !== null) {
      resources.hitPoints = { value: 0, max: parsedData.hitPoints };
    }
    if (parsedData.stress !== null) {
      resources.stress = { value: 0, max: parsedData.stress };
    }
    if (Object.keys(resources).length > 0) {
      system.resources = resources;
    }

    if (parsedData.description) {
      system.description = `<p>${this._escapeHtml(parsedData.description)}</p>`;
    }
    if (parsedData.motivesAndTactics) {
      system.motivesAndTactics = parsedData.motivesAndTactics;
    }

    const experiences = this._buildExperiences(parsedData.experiences);
    if (Object.keys(experiences).length > 0) {
      system.experiences = experiences;
    }

    if (parsedData.attack) {
      system.attack = this._buildAttack(parsedData.attack);
    }

    const actorData = {
      name: parsedData.name,
      type: "adversary",
      img: ACTOR_ICON,
      system,
      prototypeToken: {
        name: parsedData.name,
        texture: { src: ACTOR_ICON },
        disposition: -1
      },
      items: this.buildFeatureItems(parsedData),
      flags: {}
    };

    this._debug("Built actor data", actorData);
    return actorData;
  }

  /**
   * Build environment actor source data without creating a Foundry document.
   * @param {object} parsedData
   * @returns {object}
   */
  buildEnvironmentActorData(parsedData) {
    const system = {
      tier: parsedData.tier,
      type: parsedData.typeId || "exploration"
    };

    if (parsedData.difficulty !== null) {
      system.difficulty = parsedData.difficulty;
    }
    if (parsedData.impulses) {
      system.impulses = this._escapeHtml(parsedData.impulses);
    }
    if (parsedData.description) {
      system.description = `<p>${this._escapeHtml(parsedData.description)}</p>`;
    }

    const potentialAdversaries = this._buildPotentialAdversaries(
      parsedData.potentialAdversaries
    );
    if (Object.keys(potentialAdversaries).length > 0) {
      system.potentialAdversaries = potentialAdversaries;
    }

    const actorData = {
      name: parsedData.name,
      type: "environment",
      img: ENVIRONMENT_ICON,
      system,
      prototypeToken: {
        name: parsedData.name,
        texture: { src: ENVIRONMENT_ICON },
        disposition: 0
      },
      items: this.buildFeatureItems(parsedData),
      flags: {}
    };

    this._debug("Built environment actor data", actorData);
    return actorData;
  }

  _buildPotentialAdversaries(groups = []) {
    return Object.fromEntries(
      groups.map(label => [
        this._randomId(),
        {
          label,
          adversaries: []
        }
      ])
    );
  }

  /**
   * Build embedded feature items.
   * @param {object} parsedData
   * @returns {object[]}
   */
  buildFeatureItems(parsedData) {
    return (parsedData.features ?? []).map(feature => this._buildFeatureItem(feature));
  }

  _buildExperiences(experiences = []) {
    return Object.fromEntries(
      experiences.map(experience => [
        this._randomId(),
        {
          name: experience.name,
          value: experience.value,
          description: ""
        }
      ])
    );
  }

  _buildAttack(attack) {
    const damage = attack.damage;
    const diceSize = damage?.diceSize ?? 6;
    const damageBonus = damage?.bonus ?? null;
    const damageType = damage?.type ?? "physical";

    return {
      name: attack.name || "Attack",
      img: ATTACK_ICON,
      type: "attack",
      range: attack.rangeId || "melee",
      roll: {
        type: "attack",
        trait: null,
        difficulty: null,
        bonus: attack.bonus ?? null,
        advState: "neutral",
        diceRolling: {
          multiplier: "prof",
          flatMultiplier: 1,
          dice: "d6",
          compare: null,
          treshold: null
        },
        useDefault: false
      },
      damage: {
        main: damage
          ? {
              value: {
                custom: { enabled: true, formula: damage.formula },
                multiplier: "flat",
                flatMultiplier: 1,
                dice: `d${diceSize}`,
                bonus: damageBonus
              },
              applyTo: "hitPoints",
              type: [damageType],
              resultBased: false,
              valueAlt: {
                multiplier: "prof",
                flatMultiplier: 1,
                dice: "d6",
                bonus: null,
                custom: { enabled: false, formula: "" }
              },
              base: false,
              includeBase: false,
              direct: false,
              fullRestore: false,
              itemId: null
            }
          : null,
        resources: {}
      },
      _id: this._randomId(),
      systemPath: "actions",
      baseAction: false,
      description: "",
      originItem: { type: "itemCollection" },
      actionType: "action",
      chatDisplay: false,
      cost: [],
      uses: {
        value: null,
        max: null,
        recovery: null,
        consumeOnSuccess: false
      },
      target: { type: "any", amount: 1 },
      effects: [],
      save: { trait: null, difficulty: null, damageMod: "none" },
      triggers: [],
      areas: []
    };
  }

  _buildFeatureItem(feature) {
    const name = feature.value ? `${feature.name} (${feature.value})` : feature.name;

    return {
      name,
      type: "feature",
      img: FEATURE_ICON,
      system: {
        description: feature.description
          ? `<p>${this._escapeHtml(feature.description)}</p>`
          : "",
        resource: null,
        actions: this._buildFeatureActions(feature),
        attribution: {},
        gmNotes: "",
        featureForm: feature.type,
        granter: null,
        actorResources: []
      },
      effects: [],
      folder: null,
      sort: 0,
      flags: {}
    };
  }

  _buildFeatureActions(feature) {
    const description = feature.description || "";
    const lower = description.toLowerCase();
    const damage = this._parseDamage(description);
    const costs = this._parseCosts(lower);
    const hasAttack = /\b(?:standard\s+)?attack\b/i.test(lower);

    let type = "effect";
    if (feature.type === "passive") {
      if (costs.length === 0 && !damage) return {};
      if (damage) type = "damage";
    } else if (hasAttack) {
      type = "attack";
    } else if (damage) {
      type = "damage";
    }

    const actionId = this._randomId();
    const action = {
      _id: actionId,
      systemPath: "actions",
      type,
      name: feature.value ? `${feature.name} (${feature.value})` : feature.name,
      description: "",
      img: FEATURE_ICON,
      chatDisplay: true,
      actionType: feature.type,
      cost: costs,
      uses: {
        value: 0,
        max: feature.value ?? null,
        recovery: null,
        consumeOnSuccess: false
      },
      target: {
        type: "any",
        amount: /\ball\s+(?:targets|creatures|adversaries)\b/i.test(lower) ? null : 1
      },
      effects: [],
      baseAction: false,
      originItem: { type: "itemCollection" },
      triggers: [],
      areas: []
    };

    const range = this._parseRange(description);
    if (range) action.range = range;

    if (type === "attack") {
      action.roll = {
        type: "attack",
        trait: null,
        difficulty: null,
        bonus: null,
        advState: "neutral",
        diceRolling: {
          multiplier: "prof",
          flatMultiplier: 1,
          dice: "d6",
          compare: null,
          treshold: null
        },
        useDefault: false
      };
      action.save = {
        trait: this._parseSaveTrait(lower),
        difficulty: null,
        damageMod: "none"
      };
    }

    if (type === "attack" || type === "damage") {
      action.damage = {
        main: damage ? this._buildDamagePart(damage) : null,
        resources: {}
      };
    }

    this._debug("Built feature action", action);
    return { [actionId]: action };
  }

  _buildDamagePart(damage) {
    return {
      value: {
        custom: { enabled: true, formula: damage.formula },
        multiplier: "flat",
        flatMultiplier: 1,
        dice: `d${damage.diceSize}`,
        bonus: damage.bonus || null
      },
      applyTo: "hitPoints",
      type: [damage.type],
      resultBased: false,
      valueAlt: {
        multiplier: "prof",
        flatMultiplier: 1,
        dice: "d6",
        bonus: null,
        custom: { enabled: false, formula: "" }
      },
      base: false,
      includeBase: false,
      direct: false,
      fullRestore: false,
      itemId: null
    };
  }

  _parseCosts(lowerDescription) {
    const costs = new Map();
    const add = (key, value = 1) => {
      costs.set(key, Math.max(costs.get(key) ?? 0, value));
    };
    const amount = token => {
      if (!token || /^an?$/i.test(token)) return 1;
      return Number.parseInt(token, 10) || 1;
    };

    for (const match of lowerDescription.matchAll(
      /\b(?:spend|mark)\s+(?:(\d+)|an?)?\s*fear\b/g
    )) {
      add("fear", amount(match[1]));
    }
    for (const match of lowerDescription.matchAll(
      /\bmark\s+(?:(\d+)|an?)?\s*stress\b/g
    )) {
      add("stress", amount(match[1]));
    }
    for (const match of lowerDescription.matchAll(
      /\b(?:spend|mark)\s+(?:(\d+)|an?)?\s*hope\b/g
    )) {
      add("hope", amount(match[1]));
    }
    if (/\bmark\s+(?:an?\s+)?armor\s+slot\b/.test(lowerDescription)) {
      add("armor", 1);
    }
    if (/\bmark\s+(?:an?\s+)?(?:additional\s+)?(?:a\s+)?hp\b/.test(lowerDescription)) {
      add("hitPoints", 1);
    }

    return [...costs.entries()].map(([key, value]) => ({
      scalable: false,
      key,
      value,
      step: null,
      consumeOnSuccess: false,
      itemId: null
    }));
  }

  _parseSaveTrait(lowerDescription) {
    const match = lowerDescription.match(
      /\b(agility|strength|finesse|instinct|presence|knowledge)\b(?:\s+or\s+(?:agility|strength|finesse|instinct|presence|knowledge))?(?:\s+reaction)?\s+(?:roll|save)\b/
    );
    return match?.[1] ?? null;
  }

  _parseRange(description) {
    const ranges = [
      { id: "veryClose", regex: /\bvery\s+close\b/gi },
      { id: "veryFar", regex: /\bvery\s+far\b/gi },
      { id: "close", regex: /\bclose\b/gi },
      { id: "far", regex: /\bfar\b/gi },
      { id: "melee", regex: /\bmelee\b/gi },
      { id: "self", regex: /\bself\b/gi }
    ];

    let best = null;
    for (const range of ranges) {
      const match = range.regex.exec(description);
      if (match && (!best || match.index < best.index)) {
        best = { id: range.id, index: match.index };
      }
    }
    return best?.id ?? "";
  }

  _parseDamage(description) {
    const match = description.match(
      /(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?\s*(phy|physical|mag|magical)/i
    );
    if (!match) return null;

    const diceCount = Number.parseInt(match[1], 10);
    const diceSize = Number.parseInt(match[2], 10);
    const sign = match[3] === "-" ? -1 : 1;
    const bonus = match[4] ? sign * Number.parseInt(match[4], 10) : 0;
    const typeText = match[5].toLowerCase();
    const type = typeText.startsWith("phy") ? "physical" : "magical";

    return {
      formula: `${diceCount}d${diceSize}${bonus > 0 ? `+${bonus}` : bonus < 0 ? bonus : ""}`,
      diceCount,
      diceSize,
      bonus,
      type
    };
  }

  _mapRole(roleId) {
    const adversaryTypes = globalThis.CONFIG?.DH?.ACTOR?.allAdversaryTypes?.();
    if (adversaryTypes && typeof adversaryTypes === "object") {
      const keys = Object.keys(adversaryTypes);
      if (keys.includes(roleId)) return roleId;

      const match = keys.find(key => key.toLowerCase() === roleId);
      if (match) return match;
    }

    return KNOWN_ADVERSARY_TYPES.includes(roleId) ? roleId : "standard";
  }

  _escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => {
      switch (character) {
        case "&":
          return "&amp;";
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        case '"':
          return "&quot;";
        case "'":
          return "&#39;";
        default:
          return character;
      }
    });
  }

  _randomId() {
    return (
      globalThis.foundry?.utils?.randomID?.() ??
      Math.random().toString(36).slice(2, 18)
    );
  }

  _debug(message, data) {
    if (this.debug) console.debug(`Daggerheart Statblock Importer | ${message}`, data);
  }
}

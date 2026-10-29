const BOX_CHARACTERS = /[\u25a1\u2610\u25fb\u25a2]|\[\s*\]/g;
const FEATURE_TYPES = ["passive", "action", "reaction"];
const ENVIRONMENT_TYPE_IDS = ["exploration", "social", "traversal", "event"];
const RANGE_IDS = {
  melee: "melee",
  close: "close",
  veryclose: "veryClose",
  far: "far",
  veryfar: "veryFar",
  self: "self"
};

export class StatblockParseError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "StatblockParseError";
    this.code = code;
    this.details = details;
  }
}

/**
 * Parser for the current Daggerheart adversary and environment statblock formats.
 *
 * The parser intentionally has no Foundry dependencies so it can be tested
 * outside of Foundry VTT.
 */
export class StatblockParser {
  constructor({ debug = false, kind = "adversary" } = {}) {
    this.debug = debug;
    this.kind = kind === "environment" ? "environment" : "adversary";
  }

  /**
   * Parse a single statblock.
   * @param {string} text
   * @returns {object}
   */
  parse(text) {
    const results = this.parseAll(text);
    return results[0];
  }

  /**
   * Parse one or more statblocks separated by a line containing only "---".
   * @param {string} text
   * @returns {object[]}
   */
  parseAll(text) {
    if (!text || typeof text !== "string" || !text.trim()) {
      throw new StatblockParseError("EMPTY", "Please provide a statblock to import.");
    }

    const blocks = this._splitBlocks(text);
    if (blocks.length === 0) {
      throw new StatblockParseError("EMPTY", "Please provide a statblock to import.");
    }

    return blocks.map((block, index) => {
      try {
        return this._parseBlock(block);
      } catch (error) {
        if (error instanceof StatblockParseError) {
          error.details = { ...error.details, blockIndex: index + 1 };
        }
        throw error;
      }
    });
  }

  _splitBlocks(text) {
    const blocks = [];
    let current = [];

    for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
      if (/^\s*---\s*$/.test(line)) {
        const block = current.join("\n").trim();
        if (block) blocks.push(block);
        current = [];
      } else {
        current.push(line);
      }
    }

    const block = current.join("\n").trim();
    if (block) blocks.push(block);

    return blocks;
  }

  _parseBlock(text) {
    const lines = this._normalizeLines(text);
    const header = this._parseHeader(lines);

    if (this.kind === "environment") {
      return this._parseEnvironmentBlock(header);
    }

    return this._parseAdversaryBlock(header);
  }

  _normalizeLines(text) {
    return text
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map(line => line.replace(/\s+/g, " ").trim())
      .filter(Boolean);
  }

  _parseHeader(lines) {
    if (lines.length === 0) {
      throw new StatblockParseError("EMPTY", "Please provide a statblock to import.");
    }

    const name = lines.shift();
    if (!name) {
      throw new StatblockParseError("MISSING_NAME", "Could not find the statblock name.");
    }

    const tierLine = lines.shift();
    if (!tierLine) {
      throw new StatblockParseError(
        "MISSING_TIER",
        "Could not find the 'Tier <number> <role>' line."
      );
    }

    const tierMatch = tierLine.match(/^Tier\s+(\d+)\s+(.+)$/i);
    if (!tierMatch) {
      throw new StatblockParseError(
        "INVALID_FORMAT",
        "Statblock format not recognized. Expected a name line followed by a 'Tier <number> <role>' line.",
        { line: tierLine }
      );
    }

    return {
      name,
      tier: Number.parseInt(tierMatch[1], 10),
      role: tierMatch[2].trim(),
      lines
    };
  }

  _parseAdversaryBlock({ name, tier, role, lines }) {
    if (
      lines.some(line =>
        /^(?:Impulses|Potential\s+Adversar(?:y|ies))\s*:/i.test(line)
      )
    ) {
      throw new StatblockParseError(
        "TYPE_MISMATCH",
        "This looks like an environment. Select Environment and try again."
      );
    }

    const result = {
      kind: "adversary",
      name,
      tier,
      role,
      roleId: this._normalizeRole(role),
      description: "",
      motivesAndTactics: "",
      difficulty: null,
      thresholds: { major: null, severe: null },
      hitPoints: null,
      stress: null,
      attack: null,
      experiences: [],
      features: [],
      missing: []
    };

    let state = "description";
    let currentFeature = null;

    const saveFeature = () => {
      if (!currentFeature) return;
      currentFeature.description = currentFeature.description.trim();
      result.features.push(currentFeature);
      currentFeature = null;
    };

    const appendText = (target, line) => {
      if (target) {
        result[target] = result[target] ? `${result[target]} ${line}` : line;
      }
    };

    for (const line of lines) {
      const featureHeader = this._parseFeatureHeader(line);
      if (featureHeader) {
        saveFeature();
        currentFeature = featureHeader;
        state = "features";
        continue;
      }

      if (/^Features?$/i.test(line)) {
        saveFeature();
        state = "features";
        continue;
      }

      const motivesMatch = line.match(/^Motives\s*&\s*Tactics\s*:\s*(.*)$/i);
      if (motivesMatch) {
        state = "motives";
        if (motivesMatch[1].trim()) appendText("motivesAndTactics", motivesMatch[1].trim());
        continue;
      }

      if (/^(Difficulty|Thresholds?)\s*:/i.test(line)) {
        this._parseStatsLine(line, result);
        state = "body";
        continue;
      }

      if (/^ATK\s*:/i.test(line)) {
        result.attack = this._parseAttackLine(line);
        state = "body";
        continue;
      }

      if (/^Experience\s*:/i.test(line)) {
        this._parseExperienceLine(line, result);
        state = "body";
        continue;
      }

      if (/^HP\s*:/i.test(line)) {
        const value = line.replace(/^HP\s*:\s*/i, "");
        if (result.hitPoints === null) result.hitPoints = this._parseResourceValue(value);
        state = "body";
        continue;
      }

      if (/^Stress\s*:/i.test(line)) {
        const value = line.replace(/^Stress\s*:\s*/i, "");
        if (result.stress === null) result.stress = this._parseResourceValue(value);
        state = "body";
        continue;
      }

      if (state === "description") {
        appendText("description", line);
      } else if (state === "motives") {
        appendText("motivesAndTactics", line);
      } else if (state === "features" && currentFeature) {
        currentFeature.description = currentFeature.description
          ? `${currentFeature.description} ${line}`
          : line;
      }
    }

    if (state === "features") saveFeature();

    result.missing = this._getMissingFields(result);
    this._debug("Parsed statblock", result);
    return result;
  }

  _parseEnvironmentBlock({ name, tier, role, lines }) {
    const typeId = this._normalizeEnvironmentType(role);
    if (!typeId) {
      throw new StatblockParseError(
        "INVALID_ENVIRONMENT_TYPE",
        "Environment type not recognized. Use Exploration, Social, Traversal, or Event.",
        { line: role }
      );
    }

    if (
      lines.some(line =>
        /^(?:ATK|Thresholds?|HP|Stress|Experience|Motives\s*&\s*Tactics)\s*:/i.test(
          line
        )
      )
    ) {
      throw new StatblockParseError(
        "TYPE_MISMATCH",
        "This looks like an adversary. Select Adversary and try again."
      );
    }

    const result = {
      kind: "environment",
      name,
      tier,
      role,
      typeId,
      description: "",
      impulses: "",
      difficulty: null,
      potentialAdversaries: [],
      features: [],
      missing: []
    };

    let state = "description";
    let currentFeature = null;
    let potentialAdversariesText = "";

    const saveFeature = () => {
      if (!currentFeature) return;
      currentFeature.description = currentFeature.description.trim();
      result.features.push(currentFeature);
      currentFeature = null;
    };

    const appendText = (target, line) => {
      if (!target) return;
      result[target] = result[target] ? `${result[target]} ${line}` : line;
    };

    for (const line of lines) {
      const featureHeader = this._parseFeatureHeader(line);
      if (featureHeader) {
        saveFeature();
        currentFeature = featureHeader;
        state = "features";
        continue;
      }

      if (/^Features?$/i.test(line)) {
        saveFeature();
        state = "features";
        continue;
      }

      const impulsesMatch = line.match(/^Impulses\s*:\s*(.*)$/i);
      if (impulsesMatch) {
        state = "impulses";
        if (impulsesMatch[1].trim()) appendText("impulses", impulsesMatch[1].trim());
        continue;
      }

      const adversariesMatch = line.match(
        /^Potential\s+Adversar(?:y|ies)\s*:\s*(.*)$/i
      );
      if (adversariesMatch) {
        state = "potentialAdversaries";
        if (adversariesMatch[1].trim()) {
          potentialAdversariesText = potentialAdversariesText
            ? `${potentialAdversariesText} ${adversariesMatch[1].trim()}`
            : adversariesMatch[1].trim();
        }
        continue;
      }

      const difficultyMatch = line.match(/^Difficulty\s*:\s*(\d+)/i);
      if (difficultyMatch) {
        result.difficulty = Number.parseInt(difficultyMatch[1], 10);
        state = "body";
        continue;
      }

      if (state === "description") {
        appendText("description", line);
      } else if (state === "impulses") {
        appendText("impulses", line);
      } else if (state === "potentialAdversaries") {
        potentialAdversariesText = potentialAdversariesText
          ? `${potentialAdversariesText} ${line}`
          : line;
      } else if (state === "features" && currentFeature) {
        currentFeature.description = currentFeature.description
          ? `${currentFeature.description} ${line}`
          : line;
      }
    }

    if (state === "features") saveFeature();

    result.potentialAdversaries = this._splitPotentialAdversaries(
      potentialAdversariesText
    );
    result.missing = result.difficulty === null ? ["difficulty"] : [];
    this._debug("Parsed environment statblock", result);
    return result;
  }

  _splitPotentialAdversaries(text) {
    if (!text.trim()) return [];

    const groups = [];
    let current = "";
    let depth = 0;
    let quote = null;

    for (const character of text) {
      if (quote) {
        current += character;
        if (
          (quote === '"' && character === '"') ||
          (quote === "\u201c" && character === "\u201d")
        ) {
          quote = null;
        }
        continue;
      }

      if (character === '"' || character === "\u201c") {
        quote = character;
        current += character;
        continue;
      }

      if (character === "(") {
        depth += 1;
      } else if (character === ")" && depth > 0) {
        depth -= 1;
      } else if (character === "," && depth === 0) {
        const group = current.trim();
        if (group) groups.push(group);
        current = "";
        continue;
      }

      current += character;
    }

    const group = current.trim();
    if (group) groups.push(group);
    return groups;
  }

  _parseStatsLine(line, result) {
    for (const rawSegment of line.split("|")) {
      const segment = rawSegment.trim();

      const difficultyMatch = segment.match(/^Difficulty\s*:\s*(\d+)/i);
      if (difficultyMatch) {
        result.difficulty = Number.parseInt(difficultyMatch[1], 10);
        continue;
      }

      const thresholdMatch = segment.match(/^Thresholds?\s*:\s*(\d+)\s*\/\s*(\d+)/i);
      if (thresholdMatch) {
        result.thresholds = {
          major: Number.parseInt(thresholdMatch[1], 10),
          severe: Number.parseInt(thresholdMatch[2], 10)
        };
        continue;
      }

      const hpMatch = segment.match(/^HP\s*:\s*(.*)$/i);
      if (hpMatch) {
        result.hitPoints = this._parseResourceValue(hpMatch[1]);
        continue;
      }

      const stressMatch = segment.match(/^Stress\s*:\s*(.*)$/i);
      if (stressMatch) {
        result.stress = this._parseResourceValue(stressMatch[1]);
      }
    }
  }

  _parseAttackLine(line) {
    const body = line.replace(/^ATK\s*:\s*/i, "");
    const segments = body.split("|").map(segment => segment.trim());
    const bonusText = segments[0] ?? "";
    const bonusMatch = bonusText.match(/^([+-]?\d+)/);
    const bonus = bonusMatch ? Number.parseInt(bonusMatch[1], 10) : null;

    let name = "";
    let range = "";
    if (segments[1]) {
      const separator = segments[1].indexOf(":");
      if (separator >= 0) {
        name = segments[1].slice(0, separator).trim();
        range = segments[1].slice(separator + 1).trim();
      } else {
        range = segments[1].trim();
      }
    }

    return {
      bonus,
      name,
      range,
      rangeId: this._normalizeRange(range),
      damage: this._parseDamage(segments[2] ?? "")
    };
  }

  _parseExperienceLine(line, result) {
    const value = line.replace(/^Experience\s*:\s*/i, "").trim();
    if (!value) return;

    for (const rawEntry of value.split(",")) {
      const entry = rawEntry.trim();
      const match = entry.match(/^(.+?)\s+([+-]\d+)$/);
      if (!match) continue;

      result.experiences.push({
        name: match[1].trim(),
        value: Number.parseInt(match[2], 10)
      });
    }
  }

  _parseFeatureHeader(line) {
    let match = line.match(
      /^(.+?)\s+[-\u2013\u2014]\s*(Passive|Action|Reaction)\s*:\s*(.*)$/i
    );
    let description = "";

    if (match) {
      description = match[3].trim();
    } else {
      match = line.match(/^(.+?)\s+[-\u2013\u2014]\s*(Passive|Action|Reaction)\s*$/i);
      if (!match) return null;
    }

    let name = match[1].trim();
    let value = "";
    const valueMatch = name.match(/^(.+?)\s*\((\d+)\)$/);
    if (valueMatch) {
      name = valueMatch[1].trim();
      value = valueMatch[2];
    }

    const type = match[2].toLowerCase();
    if (!FEATURE_TYPES.includes(type)) return null;

    return {
      name,
      type,
      value,
      description
    };
  }

  _parseDamage(value) {
    const text = value.trim();
    if (!text) return null;

    const match = text.match(
      /^(\d*)d(\d+)(?:\s*([+-])\s*(\d+))?\s*(phy|physical|mag|magical)$/i
    );
    if (!match) return null;

    const diceCount = Number.parseInt(match[1] || "1", 10);
    const diceSize = Number.parseInt(match[2], 10);
    const sign = match[3] === "-" ? -1 : 1;
    const bonus = match[4] ? sign * Number.parseInt(match[4], 10) : 0;
    const typeText = (match[5] ?? "").toLowerCase();
    const type = typeText.startsWith("phy") ? "physical" : "magical";
    const formula = `${diceCount}d${diceSize}${bonus > 0 ? `+${bonus}` : bonus < 0 ? bonus : ""}`;

    return {
      formula,
      diceCount,
      diceSize,
      bonus,
      type
    };
  }

  _parseResourceValue(value) {
    const numeric = String(value).match(/^\s*(\d+)\b/);
    if (numeric) return Number.parseInt(numeric[1], 10);

    const boxes = String(value).match(BOX_CHARACTERS);
    return boxes ? boxes.length : null;
  }

  _normalizeRole(role) {
    return role
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .trim();
  }

  _normalizeEnvironmentType(role) {
    const normalized = this._normalizeRole(role);
    return ENVIRONMENT_TYPE_IDS.includes(normalized) ? normalized : null;
  }

  _normalizeRange(range) {
    if (!range) return "";
    const normalized = range.toLowerCase().replace(/[^a-z]+/g, "");
    return RANGE_IDS[normalized] ?? "";
  }

  _getMissingFields(result) {
    const missing = [];
    if (result.difficulty === null) missing.push("difficulty");
    if (result.thresholds.major === null || result.thresholds.severe === null) {
      missing.push("thresholds");
    }
    if (result.hitPoints === null) missing.push("hitPoints");
    if (result.stress === null) missing.push("stress");
    if (result.attack === null) missing.push("attack");
    return missing;
  }

  _debug(message, data) {
    if (this.debug) console.debug(`DH Stats Importer | ${message}`, data);
  }
}

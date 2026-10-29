import test from "node:test";
import assert from "node:assert/strict";
import { StatblockParser } from "../scripts/parser.js";
import {
  AGARES,
  ALEMENTAL,
  SAURIAN_STABLEMASTER,
  OLD_FORMAT
} from "./fixtures.mjs";

const parser = new StatblockParser();

test("parses a partial statblock and reports missing stats", () => {
  const result = parser.parse(AGARES);

  assert.equal(result.name, "Agares");
  assert.equal(result.tier, 4);
  assert.equal(result.role, "Solo");
  assert.equal(result.roleId, "solo");
  assert.match(result.description, /^A gaunt old man/);
  assert.match(result.description, /monstrous hawk\.$/);
  assert.match(result.motivesAndTactics, /teach languages$/);
  assert.equal(result.difficulty, null);
  assert.deepEqual(result.thresholds, { major: null, severe: null });
  assert.equal(result.hitPoints, null);
  assert.equal(result.stress, null);
  assert.equal(result.attack, null);
  assert.deepEqual(result.experiences, []);
  assert.equal(result.features.length, 10);
  assert.deepEqual(result.missing, [
    "difficulty",
    "thresholds",
    "hitPoints",
    "stress",
    "attack"
  ]);

  assert.deepEqual(
    result.features.slice(0, 3).map(feature => feature.name),
    ["Fallen Rider", "Infernal Companions", "Hawk Pursuing"]
  );
  assert.equal(result.features[0].type, "passive");
  assert.equal(result.features[2].type, "action");
  assert.equal(result.features.at(-1).name, "Tail Whip");
  assert.equal(result.features.at(-1).type, "reaction");
});

test("parses a complete statblock", () => {
  const result = parser.parse(ALEMENTAL);

  assert.equal(result.name, "ALEMENTAL");
  assert.equal(result.tier, 1);
  assert.equal(result.role, "Support");
  assert.equal(result.roleId, "support");
  assert.equal(result.description, "A living pool of foamy beer, making enemies drunk.");
  assert.equal(result.motivesAndTactics, "Conceal, inebriate, drown");
  assert.equal(result.difficulty, 11);
  assert.deepEqual(result.thresholds, { major: 5, severe: 9 });
  assert.equal(result.hitPoints, 5);
  assert.equal(result.stress, 5);
  assert.deepEqual(result.attack, {
    bonus: 2,
    name: "Foamy Wave",
    range: "Very Close",
    rangeId: "veryClose",
    damage: {
      formula: "1d6+2",
      diceCount: 1,
      diceSize: 6,
      bonus: 2,
      type: "physical"
    }
  });
  assert.deepEqual(result.experiences, [{ name: "Be Ale", value: 3 }]);
  assert.equal(result.features.length, 4);
  assert.deepEqual(
    result.features.map(feature => feature.name),
    ["Just Beer", "Make Drunk", "Drowning Embrace", "Overwhelming Foam"]
  );
  assert.deepEqual(result.missing, []);
});

test("parses multi-line motives, multiple experiences, and checkbox resources", () => {
  const result = parser.parse(SAURIAN_STABLEMASTER);

  assert.equal(result.name, "SAURIAN STABLEMASTER");
  assert.equal(result.roleId, "social");
  assert.match(result.motivesAndTactics, /make some money$/);
  assert.equal(result.difficulty, 10);
  assert.deepEqual(result.thresholds, { major: 3, severe: 6 });
  assert.equal(result.hitPoints, 3);
  assert.equal(result.stress, 3);
  assert.equal(result.attack.bonus, -1);
  assert.equal(result.attack.name, "Bone Whistle");
  assert.equal(result.attack.rangeId, "close");
  assert.equal(result.attack.damage.formula, "1d4+1");
  assert.equal(result.attack.damage.type, "magical");
  assert.deepEqual(result.experiences, [
    { name: "Used Mount Salesman", value: 2 },
    { name: "Dino Handler", value: 2 }
  ]);
  assert.equal(result.features.length, 4);
  assert.deepEqual(result.missing, []);
});

test("parses a batch separated by ---", () => {
  const results = parser.parseAll(
    `${AGARES}\n---\n${ALEMENTAL}\n---\n${SAURIAN_STABLEMASTER}`
  );

  assert.equal(results.length, 3);
  assert.deepEqual(
    results.map(result => result.name),
    ["Agares", "ALEMENTAL", "SAURIAN STABLEMASTER"]
  );
});

test("rejects the old statblock format", () => {
  assert.throws(
    () => parser.parse(OLD_FORMAT),
    error =>
      error.code === "INVALID_FORMAT" && /Tier <number> <role>/.test(error.message)
  );
});

test("reports the invalid block index in a batch", () => {
  assert.throws(
    () => parser.parseAll(`${ALEMENTAL}\n---\nNot Valid\nT1 Solo`),
    error => error.code === "INVALID_FORMAT" && error.details.blockIndex === 2
  );
});

test("rejects empty input", () => {
  assert.throws(() => parser.parse("   \n\n"), error => error.code === "EMPTY");
});

test("supports feature headers using em dashes and optional values", () => {
  const result = parser.parse(`Test Creature
Tier 2 Bruiser
Test description.
Difficulty: 12 | Thresholds: 6/12 | HP: 4 | Stress: 2
ATK: +1 | Slam: Melee | 1d8 phy
Features
Slam (2) — Action: Make an attack within Melee range.`);

  assert.equal(result.features.length, 1);
  assert.equal(result.features[0].name, "Slam");
  assert.equal(result.features[0].value, "2");
  assert.equal(result.features[0].type, "action");
  assert.match(result.features[0].description, /^Make an attack/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { StatblockParser } from "../scripts/parser.js";
import { DaggerheartActorCreator } from "../scripts/actor-creator.js";
import { AGARES, ALEMENTAL, SAURIAN_STABLEMASTER } from "./fixtures.mjs";

let idCounter = 0;
globalThis.foundry = {
  utils: {
    randomID: () => `test-id-${++idCounter}`
  }
};
globalThis.CONFIG = {
  DH: {
    ACTOR: {
      allAdversaryTypes: () => ({
        bruiser: "Bruiser",
        horde: "Horde",
        leader: "Leader",
        minion: "Minion",
        ranged: "Ranged",
        skulk: "Skulk",
        social: "Social",
        solo: "Solo",
        standard: "Standard",
        support: "Support"
      })
    }
  }
};

const parser = new StatblockParser();
const creator = new DaggerheartActorCreator();

test("builds a complete Daggerheart adversary actor", () => {
  const actor = creator.buildActorData(parser.parse(ALEMENTAL));

  assert.equal(actor.name, "ALEMENTAL");
  assert.equal(actor.type, "adversary");
  assert.equal(actor.system.tier, 1);
  assert.equal(actor.system.type, "support");
  assert.equal(actor.system.difficulty, 11);
  assert.deepEqual(actor.system.damageThresholds, { major: 5, severe: 9 });
  assert.deepEqual(actor.system.resources, {
    hitPoints: { value: 0, max: 5 },
    stress: { value: 0, max: 5 }
  });
  assert.equal(actor.system.attack.roll.bonus, 2);
  assert.equal(actor.system.attack.range, "veryClose");
  assert.equal(actor.system.attack.damage.main.value.custom.formula, "1d6+2");
  assert.equal(actor.system.attack.damage.main.type[0], "physical");
  assert.equal(Object.keys(actor.system.experiences).length, 1);
  assert.equal(Object.values(actor.system.experiences)[0].name, "Be Ale");
  assert.equal(actor.items.length, 4);

  const drowning = actor.items.find(item => item.name === "Drowning Embrace");
  assert.equal(drowning.system.featureForm, "action");
  const action = Object.values(drowning.system.actions)[0];
  assert.equal(action.type, "attack");
  assert.equal(action.actionType, "action");
  assert.equal(action.range, "veryClose");
  assert.equal(action.target.amount, null);
  assert.deepEqual(action.cost, [
    {
      scalable: false,
      key: "fear",
      value: 1,
      step: null,
      consumeOnSuccess: false,
      itemId: null
    }
  ]);

  const passive = actor.items.find(item => item.name === "Just Beer");
  assert.equal(passive.system.featureForm, "passive");
  assert.deepEqual(passive.system.actions, {});
});

test("builds damage and costs for features", () => {
  const actor = creator.buildActorData(parser.parse(SAURIAN_STABLEMASTER));

  assert.equal(actor.system.attack.range, "close");
  assert.equal(actor.system.attack.damage.main.value.custom.formula, "1d4+1");
  assert.equal(actor.system.attack.damage.main.type[0], "magical");
  assert.deepEqual(actor.system.resources, {
    hitPoints: { value: 0, max: 3 },
    stress: { value: 0, max: 3 }
  });

  const selling = actor.items.find(item => item.name === "Selling a Lemon");
  const sellingAction = Object.values(selling.system.actions)[0];
  assert.equal(sellingAction.type, "effect");
  assert.equal(sellingAction.cost[0].key, "fear");
  assert.equal(sellingAction.cost[0].value, 1);

  const dontBlowIt = actor.items.find(item => item.name === "Don’t Blow It");
  const reaction = Object.values(dontBlowIt.system.actions)[0];
  assert.equal(reaction.actionType, "reaction");
  assert.equal(reaction.type, "effect");
});

test("omits fields that are missing from a partial statblock", () => {
  const actor = creator.buildActorData(parser.parse(AGARES));

  assert.equal(actor.system.difficulty, undefined);
  assert.equal(actor.system.damageThresholds, undefined);
  assert.equal(actor.system.resources, undefined);
  assert.equal(actor.system.attack, undefined);
  assert.equal(actor.items.length, 10);

  const companions = actor.items.find(item => item.name === "Infernal Companions");
  const companionAction = Object.values(companions.system.actions)[0];
  assert.equal(companionAction.type, "effect");
  assert.equal(companionAction.actionType, "passive");
  assert.equal(companionAction.cost[0].key, "fear");
  assert.equal(companionAction.cost[0].value, 2);

  const hawk = actor.items.find(item => item.name === "Hawk Pursuing");
  const hawkAction = Object.values(hawk.system.actions)[0];
  assert.equal(hawkAction.type, "attack");
  assert.equal(hawkAction.range, "veryFar");
  assert.equal(hawkAction.cost[0].value, 2);
  assert.equal(hawkAction.target.amount, 1);

  const tail = actor.items.find(item => item.name === "Tail Whip");
  const tailAction = Object.values(tail.system.actions)[0];
  assert.equal(tailAction.type, "attack");
  assert.equal(tailAction.damage.main.value.custom.formula, "1d20");
  assert.equal(tailAction.damage.main.type[0], "physical");
});

test("falls back to the standard role for unknown roles", () => {
  const actor = creator.buildActorData(
    parser.parse(`Odd Creature
Tier 1 Weird
A strange thing.`)
  );

  assert.equal(actor.system.type, "standard");
});

test("creates an actor through the Foundry Actor document class", async () => {
  globalThis.game = {
    system: { id: "daggerheart" },
    settings: { get: () => false }
  };
  const createdData = [];
  globalThis.Actor = {
    create: async data => {
      createdData.push(data);
      return { ...data, id: "created-actor" };
    }
  };

  const actor = await creator.createActor(parser.parse(ALEMENTAL));

  assert.equal(actor.id, "created-actor");
  assert.equal(createdData.length, 1);
  assert.equal(createdData[0].items.length, 4);

  delete globalThis.game;
  delete globalThis.Actor;
});

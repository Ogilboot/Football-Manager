import { test } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/game/data";
import { getPlayerState, happinessReasons, interactWithPlayer, moraleLabel, newCareer } from "../src/game/career";

const club = db.teams[0];

test("moraleLabel maps ranges correctly", () => {
  assert.equal(moraleLabel(18), "Superb");
  assert.equal(moraleLabel(14), "Good");
  assert.equal(moraleLabel(10), "Poor");
  assert.equal(moraleLabel(3), "Abysmal");
});

test("interactWithPlayer shifts morale", () => {
  let state = newCareer(club.id, "t");
  const id = state.squads[club.id][0];
  const before = getPlayerState(state, id).morale;
  const praised = interactWithPlayer(state, id, "praise");
  assert.ok(getPlayerState(praised.state, id).morale > before, "praise should raise morale");
  const criticized = interactWithPlayer(praised.state, id, "criticize");
  assert.ok(getPlayerState(criticized.state, id).morale < getPlayerState(praised.state, id).morale, "criticism should lower morale");
});

test("happinessReasons always returns at least one reason", () => {
  const state = newCareer(club.id, "t");
  const id = state.squads[club.id][0];
  assert.ok(happinessReasons(state, id).length > 0);
});

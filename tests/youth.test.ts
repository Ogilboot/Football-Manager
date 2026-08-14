import { test } from "node:test";
import assert from "node:assert/strict";
import { db, getPlayer } from "../src/game/data";
import { advanceWeek, finishSeason, newCareer, startNextSeason } from "../src/game/career";

const club = db.teams[0];

function advanceToNextSeason(state: ReturnType<typeof newCareer>) {
  while (!state.seasonOver) state = advanceWeek(state).state;
  return startNextSeason(finishSeason(state));
}

test("youth intake produces valid new players in the squad", () => {
  const state = advanceToNextSeason(newCareer(club.id, "t"));

  assert.equal(state.latestIntake.length, 3, "three youth prospects per season");
  for (const id of state.latestIntake) {
    assert.ok(state.generatedPlayers[id], "generated player should be stored");
    assert.ok(state.squads[state.userClubId].includes(id), "added to the squad");

    const p = getPlayer(id);
    assert.ok(p.age >= 15 && p.age <= 17, "youth age");
    assert.ok(p.ca >= 1 && p.ca <= 200);
    assert.ok(p.pa >= p.ca, "potential >= current ability");
    for (const v of Object.values(p.attrs)) {
      assert.ok(v >= 1 && v <= 20, "attribute in range");
    }
  }
});

test("youth intake is deterministic per season", () => {
  const a = advanceToNextSeason(newCareer(club.id, "t"));
  const b = advanceToNextSeason(newCareer(club.id, "t"));
  assert.deepEqual(a.latestIntake, b.latestIntake);
  assert.equal(getPlayer(a.latestIntake[0]).name, getPlayer(b.latestIntake[0]).name);
});

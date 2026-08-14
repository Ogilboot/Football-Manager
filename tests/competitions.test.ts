import { test } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/game/data";
import { advanceWeek, newCareer } from "../src/game/career";

const club = db.teams.find((t) => t.name === "Manchester City")!;
const leagueSize = db.leagueByTeam.get(club.id)!.teams.length;

test("newCareer creates cup and European competitions", () => {
  const state = newCareer(club.id, "t");
  assert.ok(state.competitions.cup, "domestic cup");
  assert.ok(state.competitions.ucl, "champions league");
  assert.ok(state.competitions.uel, "europa league");
  assert.equal(state.competitions.cup.teams.length, leagueSize);
  assert.equal(state.competitions.ucl.teams.length, 24);
  assert.equal(state.competitions.uel.teams.length, 24);
  assert.ok(state.competitions.cup.teams.includes(club.id), "user always enters the cup");
});

test("knockout rounds generate and complete with a champion", () => {
  let state = newCareer(club.id, "t");
  for (let i = 0; i < state.totalStages; i++) state = advanceWeek(state).state;

  for (const compId of ["cup", "ucl", "uel"] as const) {
    const comp = state.competitions[compId];
    assert.equal(comp.teams.length, 1, `${compId} should have a single champion`);
  }
});

test("league standings ignore cup and European fixtures", () => {
  let state = newCareer(club.id, "t");
  for (let i = 0; i < state.totalStages; i++) state = advanceWeek(state).state;

  const leagueFixtures = state.fixtures.filter((f) => f.competition === "league");
  assert.equal(leagueFixtures.length, (leagueSize - 1) * leagueSize);
  assert.ok(leagueFixtures.every((f) => state.results[f.id]));
});

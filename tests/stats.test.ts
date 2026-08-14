import { test } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/game/data";
import { advanceWeek, newCareer, playerOfSeason, topScorers } from "../src/game/career";

const club = db.teams[0];

test("advanceWeek accumulates season stats", () => {
  let state = newCareer(club.id, "t");
  state = advanceWeek(state).state;

  const stats = state.seasonStats;
  assert.ok(Object.keys(stats).length > 0, "season stats should be populated");

  const totalGoals = Object.values(state.results).reduce((s, r) => s + r.homeGoals + r.awayGoals, 0);
  const statGoals = Object.values(stats).reduce((s, v) => s + v.goals, 0);
  assert.equal(statGoals, totalGoals, "attributed goals should equal scored goals");

  for (const v of Object.values(stats)) {
    assert.ok(v.appearances >= 1);
    assert.ok(v.minutes > 0);
    assert.ok(v.ratingSum > 0);
  }
});

test("topScorers returns goal leaders in order", () => {
  let state = newCareer(club.id, "t");
  while (!state.seasonOver) state = advanceWeek(state).state;

  const scorers = topScorers(state, 10);
  assert.ok(scorers.length > 0, "a full season should produce goalscorers");
  for (let i = 1; i < scorers.length; i++) {
    assert.ok(scorers[i - 1].goals >= scorers[i].goals, "should be sorted by goals");
  }
});

test("playerOfSeason picks a player with sufficient appearances", () => {
  let state = newCareer(club.id, "t");
  while (!state.seasonOver) state = advanceWeek(state).state;

  const potS = playerOfSeason(state);
  assert.ok(potS, "a full season should yield a player of the season");
  assert.ok(potS.rating >= 3 && potS.rating <= 10);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/game/data";
import { advanceWeek, finishSeason, moveClub, newCareer } from "../src/game/career";

const club = db.teams[0];

test("manager profile starts fresh", () => {
  const state = newCareer(club.id, "t");
  assert.equal(state.manager.trophies, 0);
  assert.equal(state.manager.seasons, 0);
  assert.deepEqual(state.manager.clubs, [club.id]);
  assert.equal(state.sacked, false);
});

test("finishSeason accumulates the season record", () => {
  let state = newCareer(club.id, "t");
  while (!state.seasonOver) state = advanceWeek(state).state;
  const finished = finishSeason(state);
  assert.equal(finished.manager.seasons, 1);
  assert.ok(finished.manager.wins + finished.manager.draws + finished.manager.losses > 0);
});

test("moveClub switches club while preserving history", () => {
  let state = newCareer(club.id, "t");
  while (!state.seasonOver) state = advanceWeek(state).state;
  const finished = finishSeason(state);
  const target = db.teams[1].id;

  const moved = moveClub(finished, target);
  assert.equal(moved.userClubId, target);
  assert.equal(moved.reputation, finished.reputation);
  assert.equal(moved.manager.trophies, finished.manager.trophies);
  assert.ok(moved.manager.clubs.includes(club.id));
  assert.ok(moved.manager.clubs.includes(target));
  assert.equal(moved.sacked, false);
  assert.equal(moved.jobOffers.length, 0);
});

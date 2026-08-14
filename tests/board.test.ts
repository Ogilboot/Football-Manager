import { test } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/game/data";
import { advanceWeek, boardConfidence, finishSeason, newCareer } from "../src/game/career";

const club = db.teams[0];

test("newCareer sets a board objective and starting reputation", () => {
  const state = newCareer(club.id, "t");
  assert.equal(state.reputation, 50);
  assert.ok(state.boardObjective.description.length > 0);
  assert.equal(state.boardObjective.status, "pending");
});

test("finishSeason evaluates the objective and adjusts reputation", () => {
  let state = newCareer(club.id, "t");
  while (!state.seasonOver) state = advanceWeek(state).state;

  const finished = finishSeason(state);
  assert.notEqual(finished.boardObjective.status, "pending");
  const met = finished.boardObjective.status === "met";
  const expectedRep = Math.max(0, Math.min(100, 50 + (met ? 12 : -12)));
  assert.equal(finished.reputation, expectedRep, "reputation should move with the objective result");
});

test("boardConfidence returns a sensible label", () => {
  assert.ok(boardConfidence(90).length > 0);
  assert.notEqual(boardConfidence(90), boardConfidence(5));
});

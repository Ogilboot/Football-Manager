import { test } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/game/data";
import { advance, newCareer } from "../src/game/career";

const club = db.teams[0];

test("advance plays exactly one match per week", () => {
  let state = newCareer(club.id, "t");
  let matches = 0;
  for (let i = 0; i < 7; i++) {
    const r = advance(state);
    if (r.report) matches++;
    state = r.state;
  }
  assert.equal(matches, 1, "one match per 7 days");
});

test("advance generates news on non-match days", () => {
  let state = newCareer(club.id, "t");
  state = advance(state).state; // matchday
  const before = state.inbox.length;
  const filler = advance(state);
  assert.equal(filler.report, null, "no report on a filler day");
  assert.ok(filler.state.inbox.length > before, "filler day should add a news item");
});

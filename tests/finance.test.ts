import { test } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/game/data";
import { advance, getContract, newCareer, renewContract, weeklyIncome, weeklyWages } from "../src/game/career";

const club = db.teams[0];

test("renewContract extends the expiry and keeps a wage", () => {
  let state = newCareer(club.id, "t");
  const id = state.squads[club.id][0];
  const before = getContract(state, id);
  const out = renewContract(state, id);
  assert.ok(out.ok);
  const after = getContract(out.state, id);
  assert.ok(after.expirySeason > before.expirySeason);
  assert.ok(after.wage >= before.wage);
});

test("weekly income and wages are positive", () => {
  const state = newCareer(club.id, "t");
  assert.ok(weeklyIncome(state) > 0);
  assert.ok(weeklyWages(state) > 0);
});

test("advance applies weekly finance on matchday", () => {
  let state = newCareer(club.id, "t");
  const before = state.balance;
  state = advance(state).state; // first advance is matchday
  assert.notEqual(state.balance, before, "matchday should apply finance");
});

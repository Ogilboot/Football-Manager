import { test } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/game/data";
import { advance, contractDemand, getContract, negotiateContract, newCareer, weeklyIncome, weeklyWages } from "../src/game/career";

const club = db.teams[0];

test("negotiateContract extends the expiry and sets the offered wage", () => {
  let state = newCareer(club.id, "t");
  const id = state.squads[club.id][0];
  const before = getContract(state, id);
  const demand = contractDemand(state, id, 4);
  const out = negotiateContract(state, id, demand, 4);
  assert.ok(out.ok, out.message);
  const after = getContract(out.state, id);
  assert.ok(after.expirySeason > before.expirySeason);
  assert.ok(after.wage >= before.wage);
});

test("negotiateContract rejects a lowball offer", () => {
  const state = newCareer(club.id, "t");
  const id = state.squads[club.id][0];
  const demand = contractDemand(state, id, 3);
  const out = negotiateContract(state, id, Math.max(500, Math.round(demand * 0.5)), 3);
  assert.ok(!out.ok);
  assert.equal(out.state, state);
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

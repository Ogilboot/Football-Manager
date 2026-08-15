import { test } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/game/data";
import { advanceWeek, askingPriceFor, contractDemand, makeTransferBid, markAllNewsRead, newCareer } from "../src/game/career";

const club = db.teams[0];

test("newCareer creates a welcome news item", () => {
  const state = newCareer(club.id, "t");
  assert.ok(state.inbox.length >= 1, "should have a welcome message");
  assert.equal(state.inbox[0].kind, "info");
});

test("advanceWeek adds a match result news item", () => {
  let state = newCareer(club.id, "t");
  const before = state.inbox.length;
  state = advanceWeek(state).state;
  assert.ok(state.inbox.length > before, "news should be added after a match");
  assert.equal(state.inbox[0].kind, "result");
});

test("transfers add news items", () => {
  let state = newCareer(club.id, "t");
  const target = [...db.players.keys()]
    .filter((id) => !state.squads[state.userClubId].includes(id))
    .sort((a, b) => db.players.get(a)!.value - db.players.get(b)!.value)[0];
  assert.ok(target != null, "should find a player");
  const before = state.inbox.length;
  const out = makeTransferBid(state, target, askingPriceFor(state, target), contractDemand(state, target, 3), 3);
  assert.ok(out.ok, out.message);
  assert.ok(out.state.inbox.length > before, "transfer should add news");
  assert.equal(out.state.inbox[0].kind, "transfer");
});

test("markAllNewsRead marks everything read", () => {
  let state = newCareer(club.id, "t");
  state = advanceWeek(state).state;
  state = markAllNewsRead(state);
  assert.ok(state.inbox.every((n) => n.read));
});

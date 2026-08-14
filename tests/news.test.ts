import { test } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/game/data";
import { advanceWeek, buyPlayer, markAllNewsRead, newCareer } from "../src/game/career";

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
  const target = [...db.players.keys()].find((id) => !state.squads[state.userClubId].includes(id) && db.players.get(id)!.value <= state.balance);
  assert.ok(target != null, "should find an affordable player");
  const before = state.inbox.length;
  const out = buyPlayer(state, target);
  assert.ok(out.ok);
  assert.ok(out.state.inbox.length > before, "transfer should add news");
  assert.equal(out.state.inbox[0].kind, "transfer");
});

test("markAllNewsRead marks everything read", () => {
  let state = newCareer(club.id, "t");
  state = advanceWeek(state).state;
  state = markAllNewsRead(state);
  assert.ok(state.inbox.every((n) => n.read));
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/game/data";
import { advance, advanceUntilMatch, newCareer, nextUserFixture, oppositionReport } from "../src/game/career";

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

test("advanceUntilMatch stops on the eve of the next match and collects lead-up news", () => {
  const state = newCareer(club.id, "t");

  // A new career starts the day before the opening match: no filler days.
  const first = advanceUntilMatch(state);
  assert.equal(first.days, 0);
  assert.equal(first.news.length, 0, "no lead-up news on the eve of the match");

  // Advancing from the eve plays the match.
  const played = advance(first.state);
  assert.ok(played.report != null, "advancing from the eve plays the match");

  // Just after a match, continuing spans the week's filler days.
  const second = advanceUntilMatch(played.state);
  assert.equal(second.days, 6);
  assert.ok(second.news.length >= 6, "flavour/preview news collected along the way");
  assert.ok(second.news.every((n) => n.kind === "info"), "only lead-up news, not the result");
  assert.ok(advance(second.state).report != null, "the next advance plays the match");
});

test("oppositionReport describes the next opponent", () => {
  const state = newCareer(club.id, "t");
  const fixture = nextUserFixture(state)!;
  const report = oppositionReport(state, fixture);

  assert.notEqual(report.teamId, state.userClubId);
  assert.ok(report.teamName.length > 0);
  assert.ok(report.formationId.length > 0);
  assert.ok(report.keyPlayers.length >= 1);
  assert.ok(report.weakArea.length > 0);
  assert.ok(report.summary.length > 0);
});

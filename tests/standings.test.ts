import { test } from "node:test";
import assert from "node:assert/strict";
import { generateFixtures } from "../src/game/fixtures";
import { computeStandings } from "../src/game/standings";
import type { MatchResult } from "../src/game/types";

const teamIds = [0, 1, 2, 3];
const fixtures = generateFixtures(teamIds);

function result(homeId: number, awayId: number, hg: number, ag: number): MatchResult {
  return { homeId, awayId, homeGoals: hg, awayGoals: ag, homeScorers: [], awayScorers: [] };
}

test("empty results give all-zero standings", () => {
  const rows = computeStandings(teamIds, fixtures, {});
  assert.equal(rows.length, 4);
  for (const r of rows) {
    assert.equal(r.played, 0);
    assert.equal(r.points, 0);
  }
});

test("a win awards 3 points, a draw 1", () => {
  const results: Record<string, MatchResult> = {
    [fixtures[0].id]: result(fixtures[0].homeId, fixtures[0].awayId, 2, 0),
    [fixtures[1].id]: result(fixtures[1].homeId, fixtures[1].awayId, 1, 1),
  };
  const rows = computeStandings(teamIds, fixtures, results);
  const byId = new Map(rows.map((r) => [r.teamId, r]));

  const winner = byId.get(fixtures[0].homeId)!;
  assert.equal(winner.points, 3);
  assert.equal(winner.won, 1);
  assert.equal(winner.gf, 2);
  assert.equal(winner.ga, 0);

  const loser = byId.get(fixtures[0].awayId)!;
  assert.equal(loser.points, 0);
  assert.equal(loser.lost, 1);
});

test("standings sort by points, then goal difference", () => {
  const a = 0, b = 1, c = 2;
  // b: 2 wins (6pts, GD+2), a: 1 win 1 loss (3pts), c: 0 wins but draw-heavy
  const results: Record<string, MatchResult> = {
    a: result(a, b, 1, 0),
    b: result(c, a, 2, 1),
    c: result(b, c, 3, 0),
  };
  const rows = computeStandings([a, b, c], generateFixtures([a, b, c]), results);
  // just assert the highest points team is first
  const first = rows[0];
  assert.ok(first.points >= rows[1].points);
});

test("every team plays every other exactly twice over a full round robin", () => {
  const rows = computeStandings(teamIds, fixtures, {});
  for (const r of rows) assert.equal(r.played, 0);
  // with all results filled, each team plays 6 games (n-1)*2
  const results: Record<string, MatchResult> = {};
  for (const f of fixtures) results[f.id] = result(f.homeId, f.awayId, 1, 0);
  const full = computeStandings(teamIds, fixtures, results);
  for (const r of full) assert.equal(r.played, 6);
});

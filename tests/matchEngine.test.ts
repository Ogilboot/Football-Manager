import { test } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/game/data";
import { simulateMatch } from "../src/game/matchEngine";
import { mulberry32 } from "../src/game/rng";
import { teamStrength } from "../src/game/strength";
import { aiPickTactics, buildMatchSquad } from "../src/game/teamSelection";
import type { MatchContext } from "../src/game/matchTypes";

const caOf = (id: number) => db.players.get(id)!.ca;

function contextFor(homeId: number, awayId: number, seed: number): MatchContext {
  const homeSquad = db.squadOf.get(homeId) ?? [];
  const awaySquad = db.squadOf.get(awayId) ?? [];
  const ht = aiPickTactics(homeSquad, caOf, mulberry32(homeId + 1));
  const at = aiPickTactics(awaySquad, caOf, mulberry32(awayId + 1));
  return {
    id: `${homeId}-${awayId}`,
    seed,
    home: buildMatchSquad(homeId, homeSquad, ht, caOf),
    away: buildMatchSquad(awayId, awaySquad, at, caOf),
    competition: "Test",
    stage: 1,
  };
}

const teamsByStrength = db.teams
  .map((t) => ({ t, str: teamStrength(db.squadOf.get(t.id) ?? [], caOf) }))
  .sort((a, b) => b.str - a.str);
const strong = teamsByStrength[0].t;
const weak = teamsByStrength[teamsByStrength.length - 1].t;

test("simulateMatch is deterministic for a fixed seed", () => {
  const ctx = contextFor(strong.id, weak.id, 12345);
  const a = simulateMatch(ctx, caOf);
  const b = simulateMatch(ctx, caOf);
  assert.deepEqual(a, b);
});

test("score matches goal events and both are bounded", () => {
  const ctx = contextFor(strong.id, weak.id, 99);
  const log = simulateMatch(ctx, caOf);
  const homeGoals = log.events.filter((e) => e.type === "goal" && e.team === ctx.home.teamId).length;
  const awayGoals = log.events.filter((e) => e.type === "goal" && e.team === ctx.away.teamId).length;
  assert.equal(log.score.home, homeGoals);
  assert.equal(log.score.away, awayGoals);
  assert.ok(log.score.home >= 0 && log.score.home <= 9);
  assert.ok(log.score.away >= 0 && log.score.away <= 9);
});

test("a match has a sensible event timeline", () => {
  const log = simulateMatch(contextFor(strong.id, weak.id, 7), caOf);
  const types = log.events.map((e) => e.type);
  assert.equal(types[0], "kickoff");
  assert.ok(types.includes("halfTime"));
  assert.ok(types.includes("fullTime"));
  assert.ok(types.includes("pass"));
  assert.ok(types.includes("shot"));
  // events are chronologically ordered
  const minutes = log.events.map((e) => e.minute);
  const sorted = [...minutes].sort((a, b) => a - b);
  assert.deepEqual(minutes, sorted);
});

test("a far stronger team wins the large majority of matches", () => {
  let strongWins = 0;
  const n = 300;
  for (let i = 0; i < n; i++) {
    const log = simulateMatch(contextFor(strong.id, weak.id, i + 1), caOf);
    if (log.score.home > log.score.away) strongWins++;
  }
  assert.ok(strongWins / n > 0.7, `win rate ${strongWins / n}`);
});

test("average goals per match is realistic", () => {
  let total = 0;
  const n = 200;
  const a = teamsByStrength[10].t;
  const b = teamsByStrength[11].t;
  for (let i = 0; i < n; i++) {
    const log = simulateMatch(contextFor(a.id, b.id, i + 1), caOf);
    total += log.score.home + log.score.away;
  }
  const avg = total / n;
  assert.ok(avg > 2 && avg < 3.2, `avg goals ${avg}`);
});

test("possession percentages sum to 100", () => {
  const log = simulateMatch(contextFor(strong.id, weak.id, 42), caOf);
  assert.equal(log.home.possession + log.away.possession, 100);
});

test("team stats are internally consistent", () => {
  const log = simulateMatch(contextFor(strong.id, weak.id, 5), caOf);
  for (const stats of [log.home, log.away]) {
    assert.ok(stats.shotsOnTarget <= stats.shots);
    assert.ok(stats.passAccuracy >= 0 && stats.passAccuracy <= 100);
    assert.ok(stats.possession >= 0 && stats.possession <= 100);
    assert.ok(stats.xg >= 0);
  }
});

test("every starting player gets a rating in range", () => {
  const ctx = contextFor(strong.id, weak.id, 3);
  const log = simulateMatch(ctx, caOf);
  const starters = [...ctx.home.lineup.map((s) => s.playerId), ...ctx.away.lineup.map((s) => s.playerId)];
  for (const id of starters) {
    const ps = log.players[id];
    assert.ok(ps, `no stats for player ${id}`);
    assert.ok(ps.rating >= 3 && ps.rating <= 10, `rating ${ps.rating} for ${id}`);
    assert.ok(ps.passAccuracy >= 0 && ps.passAccuracy <= 100);
  }
});

test("scorers and assists are attributed to real players", () => {
  const ctx = contextFor(strong.id, weak.id, 11);
  const log = simulateMatch(ctx, caOf);
  const allIds = new Set([...db.players.keys()]);
  for (const e of log.events) {
    if (e.type === "goal") {
      assert.ok(allIds.has(e.playerId));
      if (e.assistPlayerId != null) assert.ok(allIds.has(e.assistPlayerId));
    }
  }
});

test("every save is attributed to a goalkeeper", () => {
  const ctx = contextFor(strong.id, weak.id, 21);
  const log = simulateMatch(ctx, caOf);
  const savedEvents = log.events.filter((e) => e.type === "shot" && e.outcome === "saved").length;
  const credited = Object.values(log.players).reduce((n, ps) => n + ps.saves, 0);
  assert.equal(savedEvents, credited);
});

test("minutes played are tracked for every player", () => {
  const ctx = contextFor(strong.id, weak.id, 31);
  const log = simulateMatch(ctx, caOf);
  for (const side of [log.context.home, log.context.away]) {
    const ids = [...side.lineup.map((s) => s.playerId), ...side.bench];
    let teamMinutes = 0;
    for (const id of ids) {
      const ps = log.players[id];
      if (!ps) continue;
      assert.ok(ps.minutes > 0 && ps.minutes <= 100, `minutes ${ps.minutes} for ${id}`);
      teamMinutes += ps.minutes;
    }
    assert.ok(teamMinutes >= 800 && teamMinutes <= 1040, `team minutes ${teamMinutes}`);
  }
});

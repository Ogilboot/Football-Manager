import { test } from "node:test";
import assert from "node:assert/strict";
import { generateFixtures, roundRobinPairs } from "../src/game/fixtures";

test("roundRobinPairs produces n-1 rounds for n teams", () => {
  for (const n of [4, 6, 8, 20]) {
    const ids = Array.from({ length: n }, (_, i) => i);
    const rounds = roundRobinPairs(ids);
    assert.equal(rounds.length, n - 1);
    for (const round of rounds) assert.equal(round.length, n / 2);
  }
});

test("generateFixtures: each pair meets exactly twice (home and away)", () => {
  const n = 20;
  const ids = Array.from({ length: n }, (_, i) => i);
  const fixtures = generateFixtures(ids);
  assert.equal(fixtures.length, n * (n - 1));

  const meetings = new Map<string, number>();
  for (const f of fixtures) {
    assert.notEqual(f.homeId, f.awayId, "team cannot play itself");
    const key = [f.homeId, f.awayId].sort((a, b) => a - b).join("-");
    meetings.set(key, (meetings.get(key) ?? 0) + 1);
  }
  for (const [, count] of meetings) assert.equal(count, 2);
});

test("generateFixtures: each team plays 19 home and 19 away", () => {
  const ids = Array.from({ length: 20 }, (_, i) => i);
  const fixtures = generateFixtures(ids);
  for (let id = 0; id < 20; id++) {
    const home = fixtures.filter((f) => f.homeId === id).length;
    const away = fixtures.filter((f) => f.awayId === id).length;
    assert.equal(home, 19);
    assert.equal(away, 19);
  }
});

test("generateFixtures: 38 stages of 10 matches for 20 teams", () => {
  const ids = Array.from({ length: 20 }, (_, i) => i);
  const fixtures = generateFixtures(ids);
  const stages = new Map<number, number>();
  for (const f of fixtures) stages.set(f.stage, (stages.get(f.stage) ?? 0) + 1);
  assert.equal(stages.size, 38);
  for (const [, count] of stages) assert.equal(count, 10);
});

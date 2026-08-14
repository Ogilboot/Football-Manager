import { test } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/game/data";
import { getFormation } from "../src/game/formations";
import { mulberry32 } from "../src/game/rng";
import { aiPickTactics, assignPlayer, buildMatchSquad, pickLineup } from "../src/game/teamSelection";
import type { TeamTactics } from "../src/game/types";

const city = db.teams.find((t) => t.name === "Manchester City")!;
const squad = db.squadOf.get(city.id) ?? [];
const caOf = (id: number) => db.players.get(id)!.ca;
const formation = getFormation("4-4-2");

test("pickLineup returns 11 unique starters and 7 unique bench players", () => {
  const { lineup, bench } = pickLineup(squad, formation, caOf);
  assert.equal(lineup.length, 11);
  assert.equal(bench.length, 7);
  assert.equal(new Set(lineup).size, 11);
  assert.equal(new Set(bench).size, 7);
  const all = new Set([...lineup, ...bench]);
  assert.equal(all.size, 18);
  for (const id of [...lineup, ...bench]) assert.ok(squad.includes(id));
});

test("pickLineup is deterministic", () => {
  const a = pickLineup(squad, formation, caOf);
  const b = pickLineup(squad, formation, caOf);
  assert.deepEqual(a, b);
});

test("pickLineup assigns a goalkeeper to the goalkeeper slot", () => {
  const { lineup } = pickLineup(squad, formation, caOf);
  const gkId = lineup[0];
  assert.equal(db.players.get(gkId)!.category, "GK");
});

test("pickLineup respects role categories where possible", () => {
  const { lineup } = pickLineup(squad, formation, caOf);
  // 4-4-2 slot order: GK, DF x4, MF x4, FW x2
  const categories = lineup.map((id) => db.players.get(id)!.category);
  assert.equal(categories[0], "GK");
  assert.deepEqual(categories.slice(1, 5), ["DF", "DF", "DF", "DF"]);
  assert.deepEqual(categories.slice(5, 9), ["MF", "MF", "MF", "MF"]);
  assert.deepEqual(categories.slice(9, 11), ["FW", "FW"]);
});

test("buildMatchSquad produces a valid MatchSquad", () => {
  const tactics = aiPickTactics(squad, caOf, mulberry32(1));
  const ms = buildMatchSquad(city.id, squad, tactics, caOf);
  assert.equal(ms.teamId, city.id);
  assert.equal(ms.formationId, tactics.formationId);
  assert.equal(ms.lineup.length, 11);
  assert.equal(ms.bench.length, 7);
  assert.deepEqual(ms.instructions, tactics.instructions);
  const shirts = ms.lineup.map((s) => s.shirtNumber);
  assert.deepEqual(shirts, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  for (const slot of ms.lineup) {
    assert.ok(slot.x >= 0 && slot.x <= 100);
    assert.ok(slot.y >= 0 && slot.y <= 100);
    assert.doesNotThrow(() => slot.roleId);
  }
});

test("aiPickTactics is deterministic for a seed", () => {
  const a = aiPickTactics(squad, caOf, mulberry32(7));
  const b = aiPickTactics(squad, caOf, mulberry32(7));
  assert.deepEqual(a, b);
});

test("aiPickTactics produces valid tactics", () => {
  const t = aiPickTactics(squad, caOf, mulberry32(42));
  assert.doesNotThrow(() => getFormation(t.formationId));
  assert.equal(t.lineup.length, 11);
  assert.equal(t.bench.length, 7);
  assert.equal(new Set([...t.lineup, ...t.bench]).size, 18);
});

const sampleTactics: TeamTactics = {
  formationId: "4-4-2",
  instructions: { mentality: "balanced", passingStyle: "mixed", tempo: "normal", pressing: "medium", defensiveLine: "normal", width: "normal" },
  lineup: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  bench: [12, 13, 14, 15, 16, 17, 18],
};

test("assignPlayer swaps two lineup players", () => {
  const out = assignPlayer(sampleTactics, "lineup", 0, 5);
  assert.equal(out.lineup[0], 5);
  assert.equal(out.lineup[4], 1);
  assert.equal(out.bench[0], 12);
});

test("assignPlayer swaps a bench player into the lineup", () => {
  const out = assignPlayer(sampleTactics, "lineup", 0, 13);
  assert.equal(out.lineup[0], 13);
  assert.equal(out.bench[1], 1);
});

test("assignPlayer swaps a lineup player onto the bench", () => {
  const out = assignPlayer(sampleTactics, "bench", 0, 5);
  assert.equal(out.bench[0], 5);
  assert.equal(out.lineup[4], 12);
});

test("assignPlayer is a no-op when the player is already there", () => {
  const out = assignPlayer(sampleTactics, "lineup", 0, 1);
  assert.deepEqual(out, sampleTactics);
});

test("assignPlayer keeps 18 unique selections", () => {
  const out = assignPlayer(sampleTactics, "bench", 3, 9);
  assert.equal(new Set([...out.lineup, ...out.bench]).size, 18);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/game/data";

test("database has the expected number of players", () => {
  assert.ok(db.players.size > 3000);
});

test("every player has valid ability and attribute ranges", () => {
  for (const [, p] of db.players) {
    assert.ok(p.ca >= 1 && p.ca <= 200, `${p.name} ca ${p.ca}`);
    assert.ok(p.pa >= 1 && p.pa <= 200, `${p.name} pa ${p.pa}`);
    assert.ok(p.pa >= p.ca, `${p.name} pa ${p.pa} < ca ${p.ca}`);
    assert.ok(p.age >= 15 && p.age <= 45, `${p.name} age ${p.age}`);
    assert.ok(p.value >= 0, `${p.name} value ${p.value}`);
    assert.ok(p.wage >= 0, `${p.name} wage ${p.wage}`);
    for (const [k, v] of Object.entries(p.attrs)) {
      assert.ok(v >= 1 && v <= 20, `${p.name}.${k} = ${v}`);
    }
    for (const [k, v] of Object.entries(p.personality)) {
      assert.ok(v >= 1 && v <= 20, `${p.name}.personality.${k} = ${v}`);
    }
  }
});

test("every team has a non-empty squad of valid players", () => {
  for (const t of db.teams) {
    const squad = db.squadOf.get(t.id) ?? [];
    assert.ok(squad.length >= 11, `${t.name} squad too small (${squad.length})`);
    for (const id of squad) assert.ok(db.players.has(id), `${t.name} references unknown player ${id}`);
  }
});

test("team ids are unique", () => {
  const ids = db.teams.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("every team belongs to a league with a country", () => {
  for (const t of db.teams) {
    const league = db.leagueByTeam.get(t.id);
    assert.ok(league, `${t.name} has no league`);
    assert.ok(league.country.length > 0);
  }
});

test("player positions map to a valid category", () => {
  for (const [, p] of db.players) {
    assert.ok(["GK", "DF", "MF", "FW"].includes(p.category), `${p.name} category ${p.category}`);
  }
});

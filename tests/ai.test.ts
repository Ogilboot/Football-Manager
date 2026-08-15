import { test } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/game/data";
import { advanceWeek, newCareer, startNextSeason } from "../src/game/career";
import { aiBudgetFor, runAiContracts, runAiManagerChanges, runAiTransfers } from "../src/game/ai";
import { teamStrength } from "../src/game/strength";

const club = db.teams[0];

test("aiBudgetFor is positive for every club", () => {
  for (const t of db.teams) {
    assert.ok(aiBudgetFor(t.id) > 0, `budget for ${t.name}`);
  }
});

test("runAiTransfers keeps every player in exactly one place", () => {
  const state = newCareer(club.id, "t");
  const result = runAiTransfers(state.squads, state.freeAgents, club.id, 2026);

  const seen = new Set<number>();
  for (const squad of Object.values(result.squads)) {
    for (const id of squad) {
      assert.ok(!seen.has(id), `player ${id} is in multiple squads`);
      seen.add(id);
    }
  }
  for (const id of result.freeAgents) {
    assert.ok(!seen.has(id), `free agent ${id} is still in a squad`);
  }
});

test("AI clubs refresh squads and youth at season start", () => {
  let state = newCareer(club.id, "t");
  while (!state.seasonOver) state = advanceWeek(state).state;
  const next = startNextSeason(state);

  const league = db.leagueByTeam.get(club.id)!;
  for (const teamId of league.teams) {
    if (teamId === club.id) continue;
    assert.ok((next.squads[teamId] ?? []).length >= 11, `AI club ${teamId} should have a full squad`);
  }
});

test("runAiContracts renews contracts and keeps squads valid", () => {
  const state = newCareer(club.id, "t");
  const result = runAiContracts(state.squads, state.freeAgents, state.contracts, club.id, 2026);

  const inSquad = new Set(Object.values(result.squads).flat());
  for (const id of result.freeAgents) {
    assert.ok(!inSquad.has(id), `free agent ${id} is still in a squad`);
  }
  for (const [teamId, squad] of Object.entries(result.squads)) {
    if (Number(teamId) === club.id) continue;
    assert.ok(squad.length >= 11, `squad ${teamId} still has enough players`);
    for (const id of squad) {
      assert.equal(result.contracts[id]?.expirySeason, 2029, `contract renewed for ${id}`);
    }
  }
});

test("runAiManagerChanges flags a strong club that finished low", () => {
  const league = db.leagueByTeam.get(club.id)!;
  const strength = (id: number) => teamStrength(db.squadOf.get(id) ?? [], (pid) => db.players.get(pid)!.ca);
  const sorted = [...league.teams].sort((a, b) => strength(b) - strength(a));
  const reversed = [...sorted].reverse();
  const changed = runAiManagerChanges(reversed);
  assert.ok(changed.includes(sorted[0]), "strongest club finishing last should change manager");
});

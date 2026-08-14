import { getPlayer } from "./data";
import { getFormation } from "./formations";
import { instructionPreset } from "./instructions";
import { getRole } from "./roles";
import type { Rng } from "./rng";
import type { Formation, MatchSquad, Mentality, Player, PlayerRole, TeamTactics } from "./types";

export type CaResolver = (playerId: number) => number;

export const BENCH_SIZE = 7;

function positionMatch(player: Player, role: PlayerRole): boolean {
  if (role.positions.includes(player.position)) return true;
  return player.altPositions.some((p) => role.positions.includes(p));
}

function bestFit(pool: number[], role: PlayerRole, caOf: CaResolver): number {
  let best = pool[0];
  let bestScore = -Infinity;
  for (const id of pool) {
    const score = caOf(id) + (positionMatch(getPlayer(id), role) ? 25 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }
  return best;
}

export function pickLineup(squad: number[], formation: Formation, caOf: CaResolver): { lineup: number[]; bench: number[] } {
  const available = [...squad];
  const lineup: number[] = [];
  for (const slot of formation.slots) {
    const role = getRole(slot.roleId);
    let pool = available.filter((id) => getPlayer(id).category === role.category);
    if (pool.length === 0) pool = available;
    const chosen = bestFit(pool, role, caOf);
    lineup.push(chosen);
    available.splice(available.indexOf(chosen), 1);
  }
  const bench = available.sort((a, b) => caOf(b) - caOf(a)).slice(0, BENCH_SIZE);
  return { lineup, bench };
}

export function buildMatchSquad(teamId: number, squad: number[], tactics: TeamTactics, caOf: CaResolver): MatchSquad {
  const formation = getFormation(tactics.formationId);
  const slots = formation.slots.length;

  const used = new Set<number>();
  const lineup: (number | null)[] = tactics.lineup.map((id) => {
    if (squad.includes(id) && !used.has(id)) {
      used.add(id);
      return id;
    }
    return null;
  });

  const pool = squad.filter((id) => !used.has(id));
  for (let i = 0; i < lineup.length; i++) {
    if (lineup[i] != null) continue;
    const role = getRole(formation.slots[i].roleId);
    const candidates = pool.filter((id) => getPlayer(id).category === role.category);
    const use = candidates.length ? candidates : pool;
    if (!use.length) continue;
    const chosen = bestFit(use, role, caOf);
    lineup[i] = chosen;
    used.add(chosen);
    pool.splice(pool.indexOf(chosen), 1);
  }

  let finalLineup = lineup.filter((id): id is number => id != null);
  if (finalLineup.length !== slots) {
    const picked = pickLineup(squad, formation, caOf);
    finalLineup = picked.lineup;
    return {
      teamId,
      formationId: tactics.formationId,
      lineup: finalLineup.map((playerId, i) => ({
        playerId,
        roleId: formation.slots[i].roleId,
        x: formation.slots[i].x,
        y: formation.slots[i].y,
        shirtNumber: i + 1,
      })),
      bench: picked.bench,
      instructions: tactics.instructions,
    };
  }

  let bench = tactics.bench.filter((id) => squad.includes(id) && !used.has(id));
  const remaining = squad.filter((id) => !used.has(id) && !bench.includes(id)).sort((a, b) => caOf(b) - caOf(a));
  while (bench.length < BENCH_SIZE && remaining.length) bench.push(remaining.shift()!);

  return {
    teamId,
    formationId: tactics.formationId,
    lineup: finalLineup.map((playerId, i) => ({
      playerId,
      roleId: formation.slots[i].roleId,
      x: formation.slots[i].x,
      y: formation.slots[i].y,
      shirtNumber: i + 1,
    })),
    bench,
    instructions: tactics.instructions,
  };
}

function teamStrengthEstimate(squad: number[], caOf: CaResolver): number {
  const top = [...squad].sort((a, b) => caOf(b) - caOf(a)).slice(0, 11);
  if (!top.length) return 0;
  return top.reduce((s, id) => s + caOf(id), 0) / top.length;
}

function mentalityFor(strength: number): Mentality {
  if (strength >= 165) return "attacking";
  if (strength >= 150) return "control";
  if (strength >= 135) return "balanced";
  if (strength >= 120) return "counter";
  return "defensive";
}

function formationFor(squad: number[], caOf: CaResolver, rng: Rng): string {
  const counts = { GK: 0, DF: 0, MF: 0, FW: 0 };
  const top = [...squad].sort((a, b) => caOf(b) - caOf(a)).slice(0, 16);
  for (const id of top) counts[getPlayer(id).category]++;

  const options: string[] = [];
  if (counts.FW >= 5) options.push("4-3-3", "4-2-3-1");
  if (counts.MF >= 7) options.push("4-2-3-1", "3-5-2");
  if (counts.DF >= 7) options.push("5-3-2", "3-5-2");
  options.push("4-4-2");
  if (counts.FW >= 4 && counts.MF >= 6) options.push("4-1-2-1-2", "3-4-3");

  const unique = [...new Set(options)];
  return unique[Math.floor(rng() * unique.length)];
}

export function aiPickTactics(squad: number[], caOf: CaResolver, rng: Rng): TeamTactics {
  const formationId = formationFor(squad, caOf, rng);
  const formation = getFormation(formationId);
  const strength = teamStrengthEstimate(squad, caOf);
  const instructions = instructionPreset(mentalityFor(strength));
  const { lineup, bench } = pickLineup(squad, formation, caOf);
  return { formationId, instructions, lineup, bench };
}

export function assignPlayer(tactics: TeamTactics, area: "lineup" | "bench", index: number, playerId: number): TeamTactics {
  const lineup = [...tactics.lineup];
  const bench = [...tactics.bench];
  const current = area === "lineup" ? lineup[index] : bench[index];
  if (current === playerId) return tactics;

  const lineupIndex = lineup.indexOf(playerId);
  const benchIndex = bench.indexOf(playerId);

  if (area === "lineup") {
    if (lineupIndex !== -1) {
      [lineup[index], lineup[lineupIndex]] = [lineup[lineupIndex], lineup[index]];
    } else if (benchIndex !== -1) {
      [lineup[index], bench[benchIndex]] = [bench[benchIndex], lineup[index]];
    } else {
      lineup[index] = playerId;
    }
  } else if (benchIndex !== -1) {
    [bench[index], bench[benchIndex]] = [bench[benchIndex], bench[index]];
  } else if (lineupIndex !== -1) {
    [bench[index], lineup[lineupIndex]] = [lineup[lineupIndex], bench[index]];
  } else {
    bench[index] = playerId;
  }

  return { ...tactics, lineup, bench };
}

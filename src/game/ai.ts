import { db, getPlayer } from "./data";
import { hashString, mulberry32, type Rng } from "./rng";
import { teamStrength } from "./strength";
import type { Category, Contract } from "./types";

// ---- tunable squad composition ---------------------------------------------
// Ideal squad size per position group (drives buying when below).
export const SQUAD_TARGETS: Record<Category, number> = { GK: 3, DF: 8, MF: 8, FW: 6 };
// Above this size the club looks to offload surplus players.
export const SQUAD_MAX: Record<Category, number> = { GK: 4, DF: 10, MF: 10, FW: 8 };

export interface AiTransfer {
  playerId: number;
  fromTeamId: number | null; // null = free agent
  toTeamId: number | null; // null = released (becomes free agent)
  fee: number;
}

export interface AiResult {
  squads: Record<number, number[]>;
  freeAgents: number[];
  transfers: AiTransfer[];
}

// A club's transfer budget for a season, derived from its playing strength.
export function aiBudgetFor(teamId: number): number {
  const str = teamStrength(db.squadOf.get(teamId) ?? [], (id) => getPlayer(id).ca);
  return Math.max(2_000_000, Math.min(200_000_000, Math.round(((str - 110) * 1_250_000) / 100_000) * 100_000));
}

// Which league club (in the active league) owns a player, if any.
function leagueClubOf(squads: Record<number, number[]>, id: number): number | null {
  for (const [clubId, squad] of Object.entries(squads)) {
    if (squad.includes(id)) return Number(clubId);
  }
  return null;
}

function categoryCounts(squad: number[]): Record<Category, number> {
  const counts: Record<Category, number> = { GK: 0, DF: 0, MF: 0, FW: 0 };
  for (const id of squad) counts[getPlayer(id).category]++;
  return counts;
}

// Best affordable transfer target for a category (from another league club or a free agent).
function findTarget(
  squads: Record<number, number[]>,
  freeAgents: number[],
  squad: number[],
  category: Category,
  budget: number,
  rng: Rng,
): { id: number; fee: number; from: number | null } | null {
  const owned = new Set(squad);
  const free = new Set(freeAgents);
  const candidates: { id: number; fee: number; from: number | null }[] = [];

  for (const [id, p] of db.players) {
    if (owned.has(id) || p.category !== category) continue;

    let from: number | null = null;
    let fee = p.value;
    if (free.has(id)) {
      fee = 0;
    } else {
      from = leagueClubOf(squads, id);
      if (from == null) continue; // foreign club player — out of scope
    }
    if (fee <= budget) candidates.push({ id, fee, from });
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => getPlayer(b.id).ca - getPlayer(a.id).ca);
  // Pick among the top few affordable options for variety (still deterministic via seed).
  const top = candidates.slice(0, 3);
  return top[Math.floor(rng() * top.length)];
}

// Run one transfer window for every AI club in the user's league.
export function runAiTransfers(
  squads: Record<number, number[]>,
  freeAgents: number[],
  userClubId: number,
  seasonStartYear: number,
): AiResult {
  const league = db.leagueByTeam.get(userClubId);
  if (!league) return { squads, freeAgents, transfers: [] };

  const nextSquads: Record<number, number[]> = { ...squads };
  const nextFree = [...freeAgents];
  const transfers: AiTransfer[] = [];
  const caOf = (id: number) => getPlayer(id).ca;

  for (const teamId of league.teams) {
    if (teamId === userClubId) continue;
    const rng = mulberry32(hashString(`ai-${seasonStartYear}-${teamId}`));
    const squad = [...(nextSquads[teamId] ?? db.squadOf.get(teamId) ?? [])];
    const budget = aiBudgetFor(teamId);
    const counts = categoryCounts(squad);

    // 1) Buy into the most under-staffed group.
    const need = (Object.keys(SQUAD_TARGETS) as Category[])
      .map((c) => ({ c, d: SQUAD_TARGETS[c] - counts[c] }))
      .sort((a, b) => b.d - a.d)[0];

    if (need.d > 0) {
      const target = findTarget(nextSquads, nextFree, squad, need.c, budget, rng);
      if (target) {
        if (target.from != null && nextSquads[target.from]) {
          nextSquads[target.from] = nextSquads[target.from].filter((x) => x !== target.id);
        }
        const idx = nextFree.indexOf(target.id);
        if (idx !== -1) nextFree.splice(idx, 1);
        nextSquads[teamId] = [...squad, target.id];
        transfers.push({ playerId: target.id, fromTeamId: target.from, toTeamId: teamId, fee: target.fee });
      }
    }

    // 2) Offload surplus from the most over-staffed group.
    const surplus = (Object.keys(SQUAD_MAX) as Category[])
      .map((c) => ({ c, s: counts[c] - SQUAD_MAX[c] }))
      .sort((a, b) => b.s - a.s)[0];

    if (surplus.s > 0) {
      const weakest = squad.filter((id) => getPlayer(id).category === surplus.c).sort((a, b) => caOf(a) - caOf(b))[0];
      if (weakest != null) {
        nextSquads[teamId] = nextSquads[teamId].filter((x) => x !== weakest);
        if (!nextFree.includes(weakest)) nextFree.push(weakest);
        transfers.push({ playerId: weakest, fromTeamId: teamId, toTeamId: null, fee: 0 });
      }
    }
  }

  return { squads: nextSquads, freeAgents: nextFree, transfers };
}

// ---- AI contract renewals --------------------------------------------------

export interface AiContractResult {
  contracts: Record<number, Contract>;
  freeAgents: number[];
  squads: Record<number, number[]>;
  released: { playerId: number; teamId: number }[];
}

// AI clubs auto-renew every player's contract, but let veterans (33+) leave.
export function runAiContracts(
  squads: Record<number, number[]>,
  freeAgents: number[],
  contracts: Record<number, Contract>,
  userClubId: number,
  year: number,
): AiContractResult {
  const league = db.leagueByTeam.get(userClubId);
  if (!league) return { contracts, freeAgents, squads, released: [] };

  const nextContracts = { ...contracts };
  const nextFree = [...freeAgents];
  const nextSquads = { ...squads };
  const released: { playerId: number; teamId: number }[] = [];

  for (const teamId of league.teams) {
    if (teamId === userClubId) continue;
    const squad = nextSquads[teamId] ?? [...(db.squadOf.get(teamId) ?? [])];
    const kept: number[] = [];
    for (const id of squad) {
      const p = getPlayer(id);
      if (p.age >= 33) {
        if (!nextFree.includes(id)) nextFree.push(id);
        released.push({ playerId: id, teamId });
      } else {
        kept.push(id);
        nextContracts[id] = { expirySeason: year + 3, wage: p.wage };
      }
    }
    nextSquads[teamId] = kept;
  }

  return { contracts: nextContracts, freeAgents: nextFree, squads: nextSquads, released };
}

// ---- AI manager changes ----------------------------------------------------

// Clubs that badly underperformed their playing strength change manager.
export function runAiManagerChanges(standings: number[]): number[] {
  const strength = (id: number) => teamStrength(db.squadOf.get(id) ?? [], (pid) => getPlayer(pid).ca);
  const expected = [...standings].sort((a, b) => strength(b) - strength(a));
  const expectedRank = new Map(expected.map((id, i) => [id, i + 1]));

  const changed: number[] = [];
  standings.forEach((id, i) => {
    const actual = i + 1;
    const exp = expectedRank.get(id) ?? actual;
    if (actual - exp >= 8) changed.push(id);
  });
  return changed;
}

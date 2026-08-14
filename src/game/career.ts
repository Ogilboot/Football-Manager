import { db, getPlayer } from "./data";
import { generateFixtures } from "./fixtures";
import { addDays } from "./format";
import { simulateMatch, teamStrength } from "./matchEngine";
import { computeStandings } from "./standings";
import type { CareerState, Fixture, MatchResult, MatchdayReport, Player } from "./types";

export const GAME_VERSION = 1;
const START_DATE = "2025-08-16";
const SAVE_KEY = "fm25_career";

// ---- player access with per-career overrides -----------------------------

export function getPlayerCurrent(state: CareerState, id: number): Player {
  const base = getPlayer(id);
  const o = state.playerOverrides[id];
  if (!o) return base;
  return { ...base, age: o.age, ca: o.ca };
}

function caOf(state: CareerState) {
  return (id: number) => getPlayerCurrent(state, id).ca;
}

// ---- finances -------------------------------------------------------------

export function squadWages(squads: Record<number, number[]>, teamId: number): number {
  return (squads[teamId] ?? []).reduce((s, id) => s + getPlayer(id).wage, 0);
}

function startingBudget(teamId: number): number {
  const str = teamStrength(db.squadOf.get(teamId) ?? [], (id) => getPlayer(id).ca);
  const budget = Math.round((str - 55) * 2_500_000 / 100_000) * 100_000;
  return Math.max(2_000_000, Math.min(200_000_000, budget));
}

function prizeMoney(position: number, teamCount: number): number {
  return Math.round((teamCount - position + 1) * 2_400_000);
}

// ---- new career -----------------------------------------------------------

export function newCareer(clubId: number, saveName: string): CareerState {
  const league = db.leagueByTeam.get(clubId);
  if (!league) throw new Error("Club has no league");
  const teamIds = league.teams;
  const fixtures = generateFixtures(teamIds);

  const squads: Record<number, number[]> = {};
  for (const id of teamIds) squads[id] = [...(db.squadOf.get(id) ?? [])];

  return {
    version: GAME_VERSION,
    saveName,
    startedAt: new Date().toISOString(),
    date: START_DATE,
    seasonStartYear: 2025,
    userClubId: clubId,
    balance: startingBudget(clubId),
    wageBudget: Math.round(squadWages(squads, clubId) * 1.1),
    squads,
    fixtures,
    results: {},
    nextStage: 1,
    totalStages: fixtures[fixtures.length - 1]?.stage ?? 1,
    seasonOver: false,
    seasonEndPrizeAwarded: false,
    transfers: [],
    playerOverrides: {},
  };
}

// ---- standings ------------------------------------------------------------

export function leagueStandings(state: CareerState) {
  const league = db.leagueByTeam.get(state.userClubId);
  if (!league) return [];
  return computeStandings(league.teams, state.fixtures, state.results);
}

export function userPosition(state: CareerState): number {
  const standings = leagueStandings(state);
  const idx = standings.findIndex((r) => r.teamId === state.userClubId);
  return idx + 1;
}

// ---- fixtures -------------------------------------------------------------

export function fixturesFor(state: CareerState, teamId: number): Fixture[] {
  return state.fixtures.filter((f) => f.homeId === teamId || f.awayId === teamId);
}

export function nextUserFixture(state: CareerState): Fixture | null {
  const upcoming = fixturesFor(state, state.userClubId).filter((f) => !state.results[f.id]);
  return upcoming.sort((a, b) => a.stage - b.stage)[0] ?? null;
}

// ---- matchday simulation --------------------------------------------------

export function advanceWeek(state: CareerState, rng: () => number = Math.random): { state: CareerState; report: MatchdayReport } {
  if (state.seasonOver) return { state, report: { stage: state.nextStage, date: state.date, results: [], userResult: null } };

  const stage = state.nextStage;
  const matches = state.fixtures.filter((f) => f.stage === stage);
  const results = { ...state.results };
  const played: MatchResult[] = [];
  let userResult: MatchResult | null = null;

  for (const f of matches) {
    const res = simulateMatch(
      f.homeId,
      f.awayId,
      state.squads[f.homeId] ?? [],
      state.squads[f.awayId] ?? [],
      caOf(state),
      rng,
    );
    results[f.id] = res;
    played.push(res);
    if (f.homeId === state.userClubId || f.awayId === state.userClubId) userResult = res;
  }

  const newBalance = state.balance;

  return {
    state: {
      ...state,
      results,
      nextStage: stage + 1,
      date: addDays(state.date, 7),
      balance: newBalance,
      seasonOver: stage + 1 > state.totalStages,
    },
    report: { stage, date: state.date, results: played, userResult },
  };
}

// ---- transfers ------------------------------------------------------------

export function playerClub(state: CareerState, playerId: number): number | null {
  for (const [clubId, squad] of Object.entries(state.squads)) {
    if (squad.includes(playerId)) return Number(clubId);
  }
  return null;
}

export function buildPlayerClubMap(state: CareerState): Map<number, number | null> {
  const map = new Map<number, number | null>();
  for (const [clubId, squad] of Object.entries(state.squads)) {
    for (const pid of squad) map.set(pid, Number(clubId));
  }
  return map;
}

export interface TransferOutcome {
  ok: boolean;
  message: string;
  state: CareerState;
}

export function buyPlayer(state: CareerState, playerId: number): TransferOutcome {
  if (state.squads[state.userClubId]?.includes(playerId)) {
    return { ok: false, message: "Already in your squad", state };
  }
  const player = getPlayer(playerId);
  const fee = player.value;
  if (state.balance < fee) {
    return { ok: false, message: `Insufficient funds (need ${fee.toLocaleString("en-GB")})`, state };
  }

  const seller = playerClub(state, playerId);
  const squads = { ...state.squads };
  if (seller != null) {
    squads[seller] = squads[seller].filter((id) => id !== playerId);
  }
  squads[state.userClubId] = [...(squads[state.userClubId] ?? []), playerId];

  const transfer = {
    playerId,
    playerName: player.name,
    fromTeamId: seller,
    toTeamId: state.userClubId,
    fee,
    date: state.date,
    kind: "in" as const,
  };

  return {
    ok: true,
    message: `Signed ${player.name} for ${fee.toLocaleString("en-GB")}`,
    state: { ...state, squads, balance: state.balance - fee, transfers: [...state.transfers, transfer] },
  };
}

export function sellPlayer(state: CareerState, playerId: number): TransferOutcome {
  if (!state.squads[state.userClubId]?.includes(playerId)) {
    return { ok: false, message: "Not in your squad", state };
  }
  const player = getPlayer(playerId);
  const fee = Math.round(player.value * 0.85);

  const candidates = db.teams.filter((t) => t.id !== state.userClubId);
  const buyer = candidates[Math.floor(Math.random() * candidates.length)];

  const squads = { ...state.squads };
  squads[state.userClubId] = squads[state.userClubId].filter((id) => id !== playerId);
  squads[buyer.id] = [...(squads[buyer.id] ?? []), playerId];

  const transfer = {
    playerId,
    playerName: player.name,
    fromTeamId: state.userClubId,
    toTeamId: buyer.id,
    fee,
    date: state.date,
    kind: "out" as const,
  };

  return {
    ok: true,
    message: `Sold ${player.name} to ${buyer.name} for ${fee.toLocaleString("en-GB")}`,
    state: { ...state, squads, balance: state.balance + fee, transfers: [...state.transfers, transfer] },
  };
}

export function releasePlayer(state: CareerState, playerId: number): TransferOutcome {
  if (!state.squads[state.userClubId]?.includes(playerId)) {
    return { ok: false, message: "Not in your squad", state };
  }
  const player = getPlayer(playerId);
  const squads = { ...state.squads };
  squads[state.userClubId] = squads[state.userClubId].filter((id) => id !== playerId);

  const transfer = {
    playerId,
    playerName: player.name,
    fromTeamId: state.userClubId,
    toTeamId: null,
    fee: 0,
    date: state.date,
    kind: "release" as const,
  };

  return {
    ok: true,
    message: `Released ${player.name}`,
    state: { ...state, squads, transfers: [...state.transfers, transfer] },
  };
}

// ---- season rollover ------------------------------------------------------

export function finishSeason(state: CareerState): CareerState {
  if (state.seasonEndPrizeAwarded || !state.seasonOver) return state;

  const league = db.leagueByTeam.get(state.userClubId);
  const position = userPosition(state);
  const prize = league ? prizeMoney(position, league.teams.length) : 0;

  // age + develop every player
  const overrides: Record<number, { age: number; ca: number }> = {};
  for (const pid of db.players.keys()) {
    const cur = getPlayerCurrent(state, pid);
    let age = cur.age + 1;
    let ca = cur.ca;
    const gap = cur.pa - cur.ca;
    if (age <= 20) ca = Math.min(cur.pa, ca + Math.min(6, gap));
    else if (age <= 23) ca = Math.min(cur.pa, ca + Math.min(3, gap));
    else if (age <= 26) ca = Math.min(cur.pa, ca + Math.min(2, gap));
    else if (age <= 29) ca = Math.min(cur.pa, ca + Math.min(1, gap));
    else if (age >= 33) ca = Math.max(40, ca - 2);
    else if (age >= 31) ca = Math.max(40, ca - 1);
    overrides[pid] = { age, ca };
  }

  return {
    ...state,
    balance: state.balance + prize,
    seasonEndPrizeAwarded: true,
    playerOverrides: overrides,
  };
}

export function startNextSeason(state: CareerState): CareerState {
  const finished = finishSeason(state);
  const league = db.leagueByTeam.get(finished.userClubId);
  if (!league) return finished;
  const fixtures = generateFixtures(league.teams);

  return {
    ...finished,
    seasonStartYear: finished.seasonStartYear + 1,
    date: START_DATE,
    fixtures,
    results: {},
    nextStage: 1,
    totalStages: fixtures[fixtures.length - 1]?.stage ?? 1,
    seasonOver: false,
    seasonEndPrizeAwarded: false,
  };
}

// ---- persistence ----------------------------------------------------------

export function saveCareer(state: CareerState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

export function loadCareer(): CareerState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CareerState;
    if (parsed.version !== GAME_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY);
}

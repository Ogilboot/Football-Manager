import { hashString } from "./rng";
import { clamp } from "./scales";
import type { MatchLog } from "./matchTypes";
import type { CareerState, PlayerState } from "./types";

export function defaultPlayerState(): PlayerState {
  return {
    condition: 95,
    fitness: 100,
    morale: 12,
    matchSharpness: 80,
    form: [],
    injured: false,
    injuryDaysLeft: 0,
    suspended: 0,
    yellowCards: 0,
    training: null,
    seasonMinutes: 0,
    wantsTransfer: false,
  };
}

export function getPlayerState(state: CareerState, id: number): PlayerState {
  return state.playerStates[id] ?? defaultPlayerState();
}

// A single multiplier (0.4–1.4) capturing how "on it" a player is right now.
export function matchPerformance(ps: PlayerState): number {
  const condF = 0.5 + 0.5 * (clamp(ps.condition, 0, 100) / 100);
  const sharpF = 0.85 + 0.25 * (clamp(ps.matchSharpness, 0, 100) / 100);
  const fitnessF = 0.9 + 0.1 * (clamp(ps.fitness, 0, 100) / 100);
  const moraleF = 1 + (clamp(ps.morale, 1, 20) - 12) / 40;
  const formAvg = ps.form.length ? ps.form.reduce((a, b) => a + b, 0) / ps.form.length : 6.0;
  const formF = 1 + (formAvg - 6.2) / 12;
  return clamp(condF * sharpF * fitnessF * moraleF * formF, 0.4, 1.4);
}

export function isAvailable(state: CareerState, id: number): boolean {
  const ps = getPlayerState(state, id);
  return ps.injuryDaysLeft <= 0 && ps.suspended <= 0;
}

function applyMatchEffects(prev: Record<number, PlayerState>, log: MatchLog, seasonStartYear: number): Record<number, PlayerState> {
  const next = { ...prev };
  const sides = [
    { squad: log.context.home, for: log.score.home, against: log.score.away },
    { squad: log.context.away, for: log.score.away, against: log.score.home },
  ];

  for (const { squad, for: gf, against: ga } of sides) {
    const result = gf > ga ? "win" : gf < ga ? "loss" : "draw";
    const ids = [...squad.lineup.map((s) => s.playerId), ...squad.bench];
    for (const id of ids) {
      const stats = log.players[id];
      if (!stats) continue;
      const ps = { ...(prev[id] ?? defaultPlayerState()) };

      ps.condition = clamp(ps.condition - (stats.minutes / 90) * 14, 0, 100);
      ps.fitness = clamp(ps.fitness - (stats.minutes / 90) * 1.2, 0, 100);
      ps.matchSharpness = clamp(ps.matchSharpness + (stats.minutes / 90) * 8, 0, 100);
      ps.seasonMinutes = (ps.seasonMinutes ?? 0) + stats.minutes;

      const base = result === "win" ? 2 : result === "loss" ? -2 : 0;
      const rating = stats.rating;
      const perf = rating >= 7.5 ? 1 : rating >= 6.8 ? 0.4 : rating < 5.5 ? -1 : rating < 6.2 ? -0.4 : 0;
      ps.morale = clamp(Math.round(ps.morale + base + perf), 1, 20);

      ps.form = [...ps.form, rating].slice(-5);

      ps.yellowCards += stats.yellowCards;
      let suspended = ps.suspended + stats.redCards;
      while (ps.yellowCards >= 5) {
        ps.yellowCards -= 5;
        suspended += 1;
      }
      ps.suspended = suspended;

      next[id] = ps;
    }
  }

  for (const e of log.events) {
    if (e.type !== "injury") continue;
    const seed = hashString(`${e.playerId}-${seasonStartYear}`);
    const days = e.severity === "minor" ? 10 + (seed % 11) : 28 + (seed % 60);
    const ps = { ...(next[e.playerId] ?? prev[e.playerId] ?? defaultPlayerState()) };
    ps.injuryDaysLeft = Math.max(ps.injuryDaysLeft, days);
    ps.injured = ps.injuryDaysLeft > 0;
    next[e.playerId] = ps;
  }

  return next;
}

function applyWeeklyRecovery(after: Record<number, PlayerState>, ids: number[], pre: Record<number, PlayerState>): Record<number, PlayerState> {
  const next = { ...after };
  for (const id of ids) {
    const ps = { ...(after[id] ?? defaultPlayerState()) };
    ps.condition = clamp(ps.condition + 22, 0, 100);
    ps.fitness = clamp(ps.fitness + 0.5, 0, 100);
    ps.matchSharpness = clamp(ps.matchSharpness - 5, 0, 100);
    ps.injuryDaysLeft = Math.max(0, ps.injuryDaysLeft - 7);
    ps.injured = ps.injuryDaysLeft > 0;
    ps.morale = clamp(ps.morale + (ps.morale < 12 ? 1 : ps.morale > 12 ? -1 : 0), 1, 20);
    if ((pre[id]?.suspended ?? 0) > 0) ps.suspended = Math.max(0, ps.suspended - 1);
    next[id] = ps;
  }
  return next;
}

export function resolveWeekStates(
  preStates: Record<number, PlayerState>,
  logs: MatchLog[],
  allIds: number[],
  seasonStartYear: number,
): Record<number, PlayerState> {
  let states = { ...preStates };
  for (const log of logs) states = applyMatchEffects(states, log, seasonStartYear);
  return applyWeeklyRecovery(states, allIds, preStates);
}

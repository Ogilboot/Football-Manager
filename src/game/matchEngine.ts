import { getPlayer } from "./data";
import { mulberry32, pickWeighted, type Rng } from "./rng";
import { clamp } from "./scales";
import type { MatchContext, MatchEvent, MatchLog, PlayerMatchStats, PositionFrame, TeamMatchStats } from "./matchTypes";
import type { Player } from "./types";

type Side = "home" | "away";

interface TeamCaps {
  attack: number;
  midfield: number;
  defence: number;
  keeper: number;
  pressing: number;
  possession: number;
  creativity: number;
  aggression: number;
}

interface LiveTeam {
  id: number;
  lineup: number[];
  bench: number[];
  appeared: number[];
  caps: TeamCaps;
  redCards: number;
  passAttempted: number;
  passCompleted: number;
  shots: number;
  shotsOnTarget: number;
  corners: number;
  fouls: number;
  yellowCards: number;
  tackles: number;
  possessionTime: number;
  xg: number;
  minutes: Map<number, number>;
  playerStats: Map<number, PlayerMatchStats>;
}

interface MatchState {
  rng: Rng;
  minute: number;
  possession: Side;
  ballX: number;
  ballY: number;
  score: { home: number; away: number };
  events: MatchEvent[];
  perfOf: (id: number) => number;
  readinessOf: (id: number) => number;
  slots: Map<number, { x: number; y: number }>;
  playerPos: Map<number, { x: number; y: number }>;
  carrier: number;
  roster: number[];
  frames: PositionFrame[];
  teams: { home: LiveTeam; away: LiveTeam };
}

function other(side: Side): Side {
  return side === "home" ? "away" : "home";
}

function attrAvg(ids: number[], f: (p: Player) => number, perfOf: (id: number) => number): number {
  return ids.length ? ids.reduce((s, id) => s + f(getPlayer(id)) * perfOf(id), 0) / ids.length : 10;
}

function analyzeSquad(lineup: number[], instructions: MatchContext["home"]["instructions"], perfOf: (id: number) => number): TeamCaps {
  const byCat = (c: string) => lineup.filter((id) => getPlayer(id).category === c);
  const fw = byCat("FW");
  const mf = byCat("MF");
  const df = byCat("DF");
  const gk = byCat("GK");

  const attack = attrAvg(fw.length ? fw : lineup, (p) => (p.attrs.finishing + p.attrs.offTheBall + p.attrs.composure) / 3, perfOf);
  const creativity = attrAvg([...fw, ...mf], (p) => (p.attrs.vision + p.attrs.passing) / 2, perfOf);
  const midfield = attrAvg(mf.length ? mf : lineup, (p) => (p.attrs.passing + p.attrs.vision + p.attrs.firstTouch) / 3, perfOf);
  const defence = attrAvg(df.length ? df : lineup, (p) => (p.attrs.tackling + p.attrs.marking + p.attrs.positioning) / 3, perfOf);
  const keeper = attrAvg(gk.length ? gk : lineup, (p) => (p.attrs.reflexes + p.attrs.command + p.attrs.handling) / 3, perfOf);
  const possession = attrAvg(lineup, (p) => (p.attrs.passing + p.attrs.firstTouch + p.attrs.composure) / 3, perfOf);
  const aggression = attrAvg(lineup, (p) => p.attrs.aggression, perfOf);

  const pressBase = instructions.pressing === "high" ? 16 : instructions.pressing === "medium" ? 12 : 8;
  let pressing = (pressBase + aggression) / 2;

  let a = attack;
  let d = defence;
  let poss = possession;
  let press = pressing;
  const m = instructions.mentality;

  if (m === "attacking") { a += 1.5; press += 1.5; poss -= 0.5; }
  if (m === "control") { a += 0.5; poss += 0.5; press += 0.5; }
  if (m === "counter") { a += 0.5; d += 0.5; poss -= 1; }
  if (m === "defensive") { d += 1.5; a -= 1; poss -= 0.5; press -= 0.5; }

  if (instructions.passingStyle === "short") poss += 0.5;
  if (instructions.passingStyle === "direct") poss -= 0.5;
  if (instructions.defensiveLine === "high") { press += 0.5; d -= 0.3; }
  if (instructions.defensiveLine === "deep") { d += 0.3; press -= 0.5; }
  if (instructions.tempo === "high") poss -= 0.3;
  if (instructions.tempo === "low") poss += 0.3;

  return { attack: a, midfield, defence: d, keeper, pressing: press, possession: poss, creativity, aggression };
}

function newLiveTeam(id: number, lineup: number[], bench: number[], caps: TeamCaps): LiveTeam {
  return {
    id,
    lineup: [...lineup],
    bench: [...bench],
    appeared: [...lineup],
    caps,
    redCards: 0,
    passAttempted: 0,
    passCompleted: 0,
    shots: 0,
    shotsOnTarget: 0,
    corners: 0,
    fouls: 0,
    yellowCards: 0,
    tackles: 0,
    possessionTime: 0,
    xg: 0,
    minutes: new Map(),
    playerStats: new Map(),
  };
}

function pstat(team: LiveTeam, id: number): PlayerMatchStats {
  let s = team.playerStats.get(id);
  if (!s) {
    s = { rating: 0, minutes: 0, passes: 0, passCompleted: 0, passAccuracy: 0, shots: 0, shotsOnTarget: 0, saves: 0, goals: 0, assists: 0, tackles: 0, fouls: 0, yellowCards: 0, redCards: 0 };
    team.playerStats.set(id, s);
  }
  return s;
}

function keeperOf(lineup: number[]): number | null {
  return lineup.find((id) => getPlayer(id).category === "GK") ?? null;
}

function kickoffTaker(lineup: number[]): number {
  const fw = lineup.find((id) => getPlayer(id).category === "FW");
  if (fw != null) return fw;
  const out = lineup.find((id) => getPlayer(id).category !== "GK");
  return out ?? lineup[0];
}

function setCarrier(state: MatchState, id: number): void {
  state.carrier = id;
  const pos = state.playerPos.get(id);
  if (pos) {
    pos.x = state.ballX;
    pos.y = state.ballY;
  }
}

function nearestToBall(state: MatchState, lineup: number[]): number | null {
  let best: number | null = null;
  let bestD = Infinity;
  for (const id of lineup) {
    const p = state.playerPos.get(id);
    if (!p) continue;
    const d = (p.x - state.ballX) * (p.x - state.ballX) + (p.y - state.ballY) * (p.y - state.ballY);
    if (d < bestD) {
      bestD = d;
      best = id;
    }
  }
  return best;
}

function swapIn(state: MatchState, offId: number, onId: number): void {
  const slot = state.slots.get(offId);
  const pos = state.playerPos.get(offId);
  if (slot) state.slots.set(onId, slot);
  state.slots.delete(offId);
  if (pos) state.playerPos.set(onId, pos);
  state.playerPos.delete(offId);
  if (state.carrier === offId) state.carrier = onId;
  if (!state.roster.includes(onId)) state.roster.push(onId);
}

function moveToward(pos: { x: number; y: number }, target: { x: number; y: number }, maxStep: number): void {
  const dx = target.x - pos.x;
  const dy = target.y - pos.y;
  const d = Math.hypot(dx, dy);
  if (d <= 0.01) return;
  const step = Math.min(maxStep, d);
  pos.x += (dx / d) * step;
  pos.y += (dy / d) * step;
}

function moveAndRecord(state: MatchState, minute: number): void {
  for (const [sideKey, team] of [["home", state.teams.home], ["away", state.teams.away]] as [Side, LiveTeam][]) {
    const hasBall = state.possession === sideKey;
    for (const id of team.lineup) {
      const pos = state.playerPos.get(id);
      if (!pos) continue;
      if (id === state.carrier) {
        moveToward(pos, { x: state.ballX, y: state.ballY }, 6);
        continue;
      }
      const slot = state.slots.get(id);
      if (!slot) continue;
      let tx = slot.x + (state.ballX - 50) * 0.25;
      let ty = slot.y + (state.ballY - 50) * 0.1;
      if (!hasBall) {
        const d = Math.hypot(state.ballX - pos.x, state.ballY - pos.y);
        if (d < 25) {
          const pull = (1 - d / 25) * 0.6;
          tx += (state.ballX - tx) * pull;
          ty += (state.ballY - ty) * pull;
        }
      }
      moveToward(pos, { x: tx, y: ty }, 2.5);
    }
  }
  const p: number[] = [];
  for (const id of state.roster) {
    const pos = state.playerPos.get(id);
    if (pos) {
      p.push(Math.round(pos.x), Math.round(pos.y));
    } else {
      p.push(-1, -1);
    }
  }
  state.frames.push({ minute, p });
}

function scaled(caps: TeamCaps, redCards: number): TeamCaps {
  const scale = 1 - 0.08 * redCards;
  return {
    attack: caps.attack * scale,
    midfield: caps.midfield * scale,
    defence: caps.defence * scale,
    keeper: caps.keeper * scale,
    pressing: caps.pressing * scale,
    possession: caps.possession * scale,
    creativity: caps.creativity * scale,
    aggression: caps.aggression,
  };
}

function distanceToGoal(side: Side, ballX: number): number {
  return side === "home" ? 100 - ballX : ballX;
}

function pickShooter(lineup: number[], rng: Rng, perfOf: (id: number) => number): number {
  const pool = lineup.filter((id) => getPlayer(id).category !== "GK");
  const use = pool.length ? pool : lineup;
  return pickWeighted(use, (id) => {
    const p = getPlayer(id);
    const boost = p.category === "FW" ? 6 : p.category === "MF" ? 2 : 0;
    return (p.attrs.finishing + p.attrs.offTheBall + boost) * perfOf(id);
  }, rng);
}

function pickDefender(lineup: number[], rng: Rng, perfOf: (id: number) => number): number {
  const pool = lineup.filter((id) => getPlayer(id).category === "DF" || getPlayer(id).category === "MF");
  const use = pool.length ? pool : lineup;
  return pickWeighted(use, (id) => (getPlayer(id).attrs.tackling + getPlayer(id).attrs.marking) * perfOf(id), rng);
}

function advanceBall(state: MatchState, side: Side): void {
  const dir = side === "home" ? 1 : -1;
  state.ballX = clamp(state.ballX + dir * (6 + state.rng() * 9), 3, 97);
  state.ballY = clamp(state.ballY + (state.rng() - 0.5) * 14, 5, 95);
}

function takeShot(state: MatchState, side: Side, baseOverride?: number): void {
  const atk = state.teams[side];
  const def = state.teams[other(side)];
  const defCaps = scaled(def.caps, def.redCards);

  const shooter = state.carrier;
  const sp = getPlayer(shooter);
  const dist = distanceToGoal(side, state.ballX);

  const base = baseOverride ?? (dist < 10 ? 0.15 : dist < 18 ? 0.1 : dist < 28 ? 0.05 : 0.03);
  const shooterSkill = clamp((sp.attrs.finishing + sp.attrs.composure) / 2 / 10 * state.perfOf(shooter), 0.6, 1.35);
  const defSkill = clamp((defCaps.keeper + defCaps.defence) / 2 / 10, 0.75, 1.3);
  const xg = clamp(base * shooterSkill / defSkill, 0.01, 0.6);

  atk.shots++;
  atk.xg += xg;
  pstat(atk, shooter).shots++;

  const r = state.rng();
  const onTarget = 0.33;
  const blocked = 0.12;
  let outcome: "goal" | "saved" | "blocked" | "missed";

  if (r < xg) {
    outcome = "goal";
  } else if (r < xg + onTarget * (1 - xg)) {
    outcome = "saved";
  } else if (r < xg + onTarget * (1 - xg) + blocked) {
    outcome = "blocked";
  } else {
    outcome = "missed";
  }

  if (outcome === "goal" || outcome === "saved") {
    atk.shotsOnTarget++;
    pstat(atk, shooter).shotsOnTarget++;
  }

  state.events.push({
    type: "shot",
    minute: Math.round(state.minute),
    playerId: shooter,
    team: atk.id,
    xg: Math.round(xg * 100) / 100,
    outcome,
    from: { x: state.ballX, y: state.ballY },
  });

  if (outcome === "goal") {
    state.score[side]++;
    pstat(atk, shooter).goals++;

    let assistId: number | null = null;
    if (state.rng() < 0.7) {
      const candidates = atk.lineup.filter((id) => id !== shooter && getPlayer(id).category !== "GK");
      if (candidates.length) {
        assistId = pickWeighted(candidates, (id) => (getPlayer(id).attrs.vision + getPlayer(id).attrs.passing) * state.perfOf(id), state.rng);
        pstat(atk, assistId).assists++;
      }
    }

    state.events.push({
      type: "goal",
      minute: Math.round(state.minute),
      playerId: shooter,
      team: atk.id,
      assistPlayerId: assistId,
      from: { x: state.ballX, y: state.ballY },
    });

    // kickoff
    state.possession = other(side);
    state.ballX = 50;
    state.ballY = 50;
    setCarrier(state, kickoffTaker(state.teams[other(side)].lineup));
  } else if (outcome === "saved") {
    const keeper = keeperOf(def.lineup);
    if (keeper != null) pstat(def, keeper).saves++;
    state.possession = other(side);
    state.ballX = other(side) === "home" ? 8 : 92;
    state.ballY = 20 + state.rng() * 60;
    if (keeper != null) setCarrier(state, keeper);
    state.events.push({ type: "setPiece", minute: Math.round(state.minute), team: other(side) === "home" ? state.teams.home.id : state.teams.away.id, kind: "goalKick", position: { x: state.ballX, y: state.ballY } });
  } else if (outcome === "blocked") {
    if (state.rng() < 0.8) {
      atk.corners++;
      state.possession = side;
      state.ballX = side === "home" ? 96 : 4;
      state.ballY = state.rng() < 0.5 ? 4 : 96;
      setCarrier(state, shooter);
      state.events.push({ type: "setPiece", minute: Math.round(state.minute), team: atk.id, kind: "corner", position: { x: state.ballX, y: state.ballY } });
    } else {
      state.possession = other(side);
      state.ballX = other(side) === "home" ? 8 : 92;
      state.ballY = 20 + state.rng() * 60;
      const gk = keeperOf(def.lineup);
      if (gk != null) setCarrier(state, gk);
      state.events.push({ type: "setPiece", minute: Math.round(state.minute), team: def.id, kind: "goalKick", position: { x: state.ballX, y: state.ballY } });
    }
  } else if (state.rng() < 0.12) {
    atk.corners++;
    state.possession = side;
    state.ballX = side === "home" ? 96 : 4;
    state.ballY = state.rng() < 0.5 ? 4 : 96;
    setCarrier(state, shooter);
    state.events.push({ type: "setPiece", minute: Math.round(state.minute), team: atk.id, kind: "corner", position: { x: state.ballX, y: state.ballY } });
  } else {
    state.possession = other(side);
    state.ballX = other(side) === "home" ? 8 : 92;
    state.ballY = 20 + state.rng() * 60;
    const gk = keeperOf(def.lineup);
    if (gk != null) setCarrier(state, gk);
    state.events.push({ type: "setPiece", minute: Math.round(state.minute), team: def.id, kind: "goalKick", position: { x: state.ballX, y: state.ballY } });
  }
}

function attemptCross(state: MatchState, side: Side): void {
  const atk = state.teams[side];
  const def = state.teams[other(side)];
  const crosser = state.carrier;

  const r = state.rng();
  if (r < 0.28) {
    atk.corners++;
    state.possession = side;
    state.ballX = side === "home" ? 96 : 4;
    state.ballY = state.rng() < 0.5 ? 4 : 96;
    setCarrier(state, crosser);
    state.events.push({ type: "setPiece", minute: Math.round(state.minute), team: atk.id, kind: "corner", position: { x: state.ballX, y: state.ballY } });
  } else if (r < 0.55) {
    state.ballX = side === "home" ? Math.min(97, state.ballX + 14) : Math.max(3, state.ballX - 14);
    state.ballY = 50 + (state.rng() - 0.5) * 20;
    const taker = nearestToBall(state, atk.lineup.filter((id) => id !== crosser)) ?? crosser;
    setCarrier(state, taker);
    state.events.push({ type: "pass", minute: Math.round(state.minute), playerId: crosser, team: atk.id, success: true, from: { x: state.ballX, y: state.ballY }, to: { x: state.ballX, y: state.ballY } });
    takeShot(state, side, 0.09);
  } else if (r < 0.78) {
    state.possession = other(side);
    state.ballX = other(side) === "home" ? 8 : 92;
    state.ballY = 20 + state.rng() * 60;
    const gk = keeperOf(def.lineup);
    if (gk != null) setCarrier(state, gk);
    state.events.push({ type: "setPiece", minute: Math.round(state.minute), team: def.id, kind: "goalKick", position: { x: state.ballX, y: state.ballY } });
  } else {
    const tackler = nearestToBall(state, def.lineup) ?? pickDefender(def.lineup, state.rng, state.perfOf);
    def.tackles++;
    pstat(def, tackler).tackles++;
    setCarrier(state, tackler);
    state.events.push({ type: "tackle", minute: Math.round(state.minute), playerId: tackler, team: def.id, success: true, position: { x: state.ballX, y: state.ballY } });
    state.possession = other(side);
  }
}

function playPossession(state: MatchState, side: Side): void {
  const atk = state.teams[side];
  const def = state.teams[other(side)];
  const atkCaps = scaled(atk.caps, atk.redCards);
  const defCaps = scaled(def.caps, def.redCards);

  let passes = 0;
  const maxPasses = 4 + Math.floor(state.rng() * 5);

  while (passes < maxPasses) {
    const dist = distanceToGoal(side, state.ballX);
    const zone = dist < 12 ? 3 : dist < 30 ? 2 : dist < 55 ? 1 : 0;

    if (zone === 2 && Math.abs(state.ballY - 50) > 22 && state.rng() < 0.28) {
      attemptCross(state, side);
      return;
    }

    const shootChance = zone === 3 ? 0.5 : zone === 2 ? 0.18 : 0;
    const shootBoost = clamp(0.75 + atkCaps.attack / 40, 0.75, 1.2);
    if (zone >= 2 && state.rng() < shootChance * shootBoost) {
      takeShot(state, side);
      return;
    }

    const passer = state.carrier;
    const from = { x: state.ballX, y: state.ballY };
    atk.passAttempted++;
    pstat(atk, passer).passes++;

    let passSuccess = 0.74 + (atkCaps.possession - 12) * 0.02 - (defCaps.pressing - 12) * 0.015;
    if (zone >= 2) passSuccess -= 0.07;
    passSuccess = clamp(passSuccess, 0.3, 0.95);

    if (state.rng() < passSuccess) {
      const dir = side === "home" ? 1 : -1;
      const cp = state.playerPos.get(passer);
      const options = atk.lineup.filter((id) => {
        if (id === passer || getPlayer(id).category === "GK") return false;
        const p = state.playerPos.get(id);
        if (p == null || cp == null) return false;
        const ahead = (p.x - cp.x) * dir;
        return ahead > 2 && ahead <= 16;
      });
      let to: { x: number; y: number };
      if (options.length) {
        const receiver = pickWeighted(options, (id) => {
          const p = getPlayer(id);
          return (p.attrs.passing + p.attrs.vision + p.attrs.firstTouch) * state.perfOf(id);
        }, state.rng);
        const rp = state.playerPos.get(receiver)!;
        to = { x: rp.x, y: rp.y };
        state.ballX = rp.x;
        state.ballY = rp.y;
        state.carrier = receiver;
      } else {
        advanceBall(state, side);
        to = { x: state.ballX, y: state.ballY };
        const cpos = state.playerPos.get(passer);
        if (cpos) {
          cpos.x = state.ballX;
          cpos.y = state.ballY;
        }
      }
      atk.passCompleted++;
      pstat(atk, passer).passCompleted++;
      state.events.push({ type: "pass", minute: Math.round(state.minute), playerId: passer, team: atk.id, success: true, from, to });
      passes++;

      if (zone >= 1 && state.rng() < 0.04 + (atkCaps.attack - defCaps.defence) * 0.002) {
        const off = pickShooter(atk.lineup, state.rng, state.perfOf);
        state.events.push({ type: "offside", minute: Math.round(state.minute), playerId: off, team: atk.id });
        state.possession = other(side);
        state.ballX = clamp(state.ballX, 3, 97);
        const df = nearestToBall(state, def.lineup);
        if (df != null) setCarrier(state, df);
        return;
      }
    } else {
      // turnover
      if (state.rng() < 0.18 + (defCaps.aggression - 10) * 0.01) {
        // foul
        const fouler = nearestToBall(state, def.lineup) ?? pickDefender(def.lineup, state.rng, state.perfOf);
        def.fouls++;
        pstat(def, fouler).fouls++;
        state.events.push({ type: "foul", minute: Math.round(state.minute), playerId: fouler, team: def.id, position: { x: state.ballX, y: state.ballY } });
        state.events.push({ type: "setPiece", minute: Math.round(state.minute), team: atk.id, kind: "freeKick", position: { x: state.ballX, y: state.ballY } });
        // card?
        if (state.rng() < 0.18 + (defCaps.aggression - 10) * 0.01) {
          def.yellowCards++;
          pstat(def, fouler).yellowCards++;
          state.events.push({ type: "card", minute: Math.round(state.minute), playerId: fouler, team: def.id, card: "yellow" });
          // second yellow check
          if (pstat(def, fouler).yellowCards >= 2) {
            def.redCards++;
            pstat(def, fouler).redCards++;
            def.lineup = def.lineup.filter((id) => id !== fouler);
            state.playerPos.delete(fouler);
            state.events.push({ type: "card", minute: Math.round(state.minute), playerId: fouler, team: def.id, card: "red" });
          }
        }
        state.possession = side;
        return;
      } else {
        const tackler = nearestToBall(state, def.lineup) ?? pickDefender(def.lineup, state.rng, state.perfOf);
        def.tackles++;
        pstat(def, tackler).tackles++;
        state.events.push({ type: "tackle", minute: Math.round(state.minute), playerId: tackler, team: def.id, success: true, position: { x: state.ballX, y: state.ballY } });
        state.events.push({ type: "pass", minute: Math.round(state.minute), playerId: passer, team: atk.id, success: false, from, to: { x: state.ballX, y: state.ballY } });
        setCarrier(state, tackler);
        state.possession = other(side);
        return;
      }
    }
  }

  // stalled possession: turnover
  state.possession = other(side);
  const df = nearestToBall(state, state.teams[other(side)].lineup);
  if (df != null) setCarrier(state, df);
}

function maybeSub(state: MatchState, side: Side, caOf: (id: number) => number): void {
  const team = state.teams[side];
  if (team.bench.length === 0 || team.lineup.length < 10) return;
  // replace the weakest outfield starter with the best bench player (positional category match preferred)
  const outfield = team.lineup.filter((id) => getPlayer(id).category !== "GK");
  if (!outfield.length) return;
  const weakest = [...outfield].sort((a, b) => caOf(a) - caOf(b))[0];
  const bestBench = [...team.bench].sort((a, b) => caOf(b) - caOf(a))[0];
  if (caOf(bestBench) <= caOf(weakest)) return;

  const idx = team.lineup.indexOf(weakest);
  team.lineup[idx] = bestBench;
  team.bench = team.bench.filter((id) => id !== bestBench);
  team.appeared.push(bestBench);
  swapIn(state, weakest, bestBench);

  state.events.push({ type: "substitution", minute: Math.round(state.minute), team: team.id, onPlayerId: bestBench, offPlayerId: weakest });
}

function maybeInjury(state: MatchState, caOf: (id: number) => number): void {
  if (state.rng() >= 0.005) return;
  const pool = [...state.teams.home.lineup, ...state.teams.away.lineup];
  const id = pool[Math.floor(state.rng() * pool.length)];
  const proneness = getPlayer(id).personality.injuryProneness;
  let risk = clamp(0.4 + (proneness - 8) * 0.06, 0.1, 0.9);
  if (state.readinessOf(id) < 70) risk *= 1.6;
  if (state.rng() > risk) return;

  const serious = state.rng() < 0.15;
  const side: Side = state.teams.home.lineup.includes(id) ? "home" : "away";
  state.events.push({
    type: "injury",
    minute: Math.round(state.minute),
    playerId: id,
    team: state.teams[side].id,
    severity: serious ? "serious" : "minor",
  });

  const team = state.teams[side];
  if (team.bench.length) {
    const bestBench = [...team.bench].sort((a, b) => caOf(b) - caOf(a))[0];
    const idx = team.lineup.indexOf(id);
    team.lineup[idx] = bestBench;
    team.bench = team.bench.filter((b) => b !== bestBench);
    team.appeared.push(bestBench);
    swapIn(state, id, bestBench);
    state.events.push({ type: "substitution", minute: Math.round(state.minute), team: team.id, onPlayerId: bestBench, offPlayerId: id });
  } else {
    team.lineup = team.lineup.filter((x) => x !== id);
    state.playerPos.delete(id);
    state.slots.delete(id);
    if (state.carrier === id) {
      const alt = nearestToBall(state, team.lineup);
      if (alt != null) setCarrier(state, alt);
    }
  }
}

function ratingFor(stats: PlayerMatchStats, category: string, oppGoals: number, minutes: number, passAcc: number): number {
  const mins = clamp(minutes / 90, 0, 1);
  let r = 6.0;
  if (category === "GK") {
    r += stats.saves * 0.22;
    r += oppGoals === 0 ? 0.9 : 0;
    r -= oppGoals * 0.18;
    r += stats.goals * 0.3;
    r -= stats.passes ? Math.max(0, 80 - passAcc) * 0.01 : 0;
  } else if (category === "FW") {
    r += stats.goals * (0.4 + 0.6 * mins) + stats.assists * 0.5;
    r += stats.shotsOnTarget * 0.06;
    r -= Math.max(0, stats.shots - stats.goals - stats.shotsOnTarget) * 0.045;
    r += stats.tackles * 0.04;
  } else if (category === "MF") {
    r += stats.goals * 0.5 + stats.assists * 0.55;
    r += clamp(stats.passes / 45, 0, 1) * 0.25;
    r += (passAcc - 78) * 0.03;
    r += stats.tackles * 0.05 + stats.shotsOnTarget * 0.05;
  } else {
    r += stats.tackles * 0.1;
    r += oppGoals === 0 ? 0.45 : 0;
    r -= oppGoals * 0.12;
    r += stats.goals * 0.5 + stats.assists * 0.45;
    r -= stats.fouls * 0.06;
  }
  r += stats.yellowCards * -0.15;
  r += stats.redCards * -1.8;
  r += stats.fouls * -0.05;
  r += stats.shotsOnTarget * 0.02;
  return Math.round(clamp(r, 3, 10) * 10) / 10;
}

function buildTeamStats(team: LiveTeam, totalTime: number): TeamMatchStats {
  return {
    possession: totalTime ? Math.round((team.possessionTime / totalTime) * 100) : 50,
    shots: team.shots,
    shotsOnTarget: team.shotsOnTarget,
    corners: team.corners,
    fouls: team.fouls,
    yellowCards: team.yellowCards,
    redCards: team.redCards,
    passes: team.passAttempted,
    passAccuracy: team.passAttempted ? Math.round((team.passCompleted / team.passAttempted) * 100) : 0,
    xg: Math.round(team.xg * 100) / 100,
  };
}

export function simulateMatch(
  context: MatchContext,
  caOf: (id: number) => number,
  perfOf: (id: number) => number = () => 1,
  readinessOf: (id: number) => number = () => 90,
): MatchLog {
  const rng = mulberry32(context.seed);

  const homeCaps = analyzeSquad(context.home.lineup.map((s) => s.playerId), context.home.instructions, perfOf);
  const awayCaps = analyzeSquad(context.away.lineup.map((s) => s.playerId), context.away.instructions, perfOf);

  const slots = new Map<number, { x: number; y: number }>();
  const playerPos = new Map<number, { x: number; y: number }>();
  for (const s of context.home.lineup) {
    slots.set(s.playerId, { x: s.x, y: s.y });
    playerPos.set(s.playerId, { x: s.x, y: s.y });
  }
  for (const s of context.away.lineup) {
    slots.set(s.playerId, { x: 100 - s.x, y: s.y });
    playerPos.set(s.playerId, { x: 100 - s.x, y: s.y });
  }

  const homeLineup = context.home.lineup.map((s) => s.playerId);
  const awayLineup = context.away.lineup.map((s) => s.playerId);
  const roster = [...homeLineup, ...awayLineup];
  const carrier = kickoffTaker(homeLineup);
  const cp = playerPos.get(carrier);
  if (cp) {
    cp.x = 50;
    cp.y = 50;
  }

  const state: MatchState = {
    rng,
    minute: 0,
    possession: "home",
    ballX: 50,
    ballY: 50,
    score: { home: 0, away: 0 },
    events: [{ type: "kickoff", minute: 0 }],
    perfOf,
    readinessOf,
    slots,
    playerPos,
    carrier,
    roster,
    frames: [],
    teams: {
      home: newLiveTeam(context.home.teamId, homeLineup, context.home.bench, homeCaps),
      away: newLiveTeam(context.away.teamId, awayLineup, context.away.bench, awayCaps),
    },
  };

  for (const half of [1, 2]) {
    const end = half === 1 ? 45 : 90;
    while (state.minute < end) {
      const step = 0.5 + rng() * 0.9;
      const fromMinute = state.minute;
      state.minute = Math.min(end, state.minute + step);
      if (state.minute >= end) break;
      const side = state.possession;
      state.teams[side].possessionTime += step;
      for (const s of ["home", "away"] as Side[]) {
        for (const id of state.teams[s].lineup) {
          state.teams[s].minutes.set(id, (state.teams[s].minutes.get(id) ?? 0) + step);
        }
      }
      playPossession(state, side);
      for (let k = 1; k <= 2; k++) {
        moveAndRecord(state, fromMinute + (state.minute - fromMinute) * (k / 2));
      }
      maybeInjury(state, caOf);
      if (state.minute >= 60 && state.minute < 62) { maybeSub(state, "home", caOf); maybeSub(state, "away", caOf); }
      if (state.minute >= 75 && state.minute < 77) { maybeSub(state, "home", caOf); maybeSub(state, "away", caOf); }
    }
    state.events.push({ type: half === 1 ? "halfTime" : "fullTime", minute: half === 1 ? 45 : 90 });
  }

  const totalTime = state.teams.home.possessionTime + state.teams.away.possessionTime;
  const players: Record<number, PlayerMatchStats> = {};
  for (const side of ["home", "away"] as Side[]) {
    const team = state.teams[side];
    const oppGoals = state.score[other(side)];
    for (const id of team.appeared) {
      const stats = team.playerStats.get(id) ?? { rating: 0, minutes: 0, passes: 0, passCompleted: 0, passAccuracy: 0, shots: 0, shotsOnTarget: 0, saves: 0, goals: 0, assists: 0, tackles: 0, fouls: 0, yellowCards: 0, redCards: 0 };
      const p = getPlayer(id);
      const acc = stats.passes ? Math.round((stats.passCompleted / stats.passes) * 100) : 0;
      players[id] = { ...stats, minutes: Math.round(team.minutes.get(id) ?? 0), passAccuracy: acc, rating: ratingFor(stats, p.category, oppGoals, team.minutes.get(id) ?? 0, acc) };
    }
  }

  return {
    context,
    events: state.events,
    roster: state.roster,
    frames: state.frames,
    home: buildTeamStats(state.teams.home, totalTime),
    away: buildTeamStats(state.teams.away, totalTime),
    players,
    score: { home: state.score.home, away: state.score.away },
  };
}

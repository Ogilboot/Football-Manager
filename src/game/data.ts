import raw from "../data/gameData.json";
import { generatePersonality } from "./personality";
import { hashString, mulberry32, sampleNormal } from "./rng";
import { toFmAbility, toFmAttr } from "./scales";
import type { FcAttrs, GameMeta, League, Player, PlayerAttrs, RawGameData, RawPlayer, Team } from "./types";

const data = raw as RawGameData;

export interface Database {
  meta: GameMeta;
  leagues: League[];
  teams: Team[];
  players: Map<number, Player>;
  squadOf: Map<number, number[]>;
  teamById: Map<number, Team>;
  teamsByLeague: Map<string, Team[]>;
  leagueByTeam: Map<number, League>;
  clubOfPlayer: Map<number, number>;
}

function convertAttrs(fc: FcAttrs, id: number, name: string, skillMoves: number): PlayerAttrs {
  const rng = mulberry32(hashString(`attr-${id}-${name}`));
  const roll = (center: number, spread: number) => Math.max(1, Math.min(20, Math.round(center + sampleNormal(rng) * spread)));
  const avg = (a: number, b: number) => (a + b) / 2;
  const f = toFmAttr;

  return {
    corners: f(avg(fc.crossing, fc.curve)),
    crossing: f(fc.crossing),
    dribbling: f(fc.dribbling),
    finishing: f(fc.finishing),
    firstTouch: f(fc.ballControl),
    freeKicks: f(fc.freeKick),
    heading: f(fc.heading),
    longShots: f(fc.longShots),
    marking: f(fc.marking),
    passing: f(avg(fc.shortPassing, fc.longPassing)),
    penalties: f(fc.penalties),
    tackling: f(avg(fc.standingTackle, fc.slidingTackle)),
    technique: f((fc.ballControl + fc.curve + fc.volleys) / 3),

    aggression: f(fc.aggression),
    anticipation: f(avg(fc.interceptions, fc.reactions)),
    bravery: roll(f(avg(fc.aggression, fc.strength)), 3),
    composure: f(fc.composure),
    concentration: f(avg(fc.composure, fc.reactions)),
    creativity: f(avg(fc.vision, fc.dribbling)),
    decisions: f(avg(fc.reactions, fc.composure)),
    flair: Math.max(1, Math.min(20, f(fc.dribbling) + skillMoves - 3)),
    offTheBall: f(fc.positioning),
    positioning: f(avg(fc.marking, fc.interceptions)),
    teamwork: roll(12, 4),
    vision: f(fc.vision),
    workRate: roll(12, 4),

    acceleration: f(fc.acceleration),
    agility: f(fc.agility),
    balance: f(fc.balance),
    jumping: f(fc.jumping),
    naturalFitness: f(fc.stamina),
    pace: f(fc.sprintSpeed),
    stamina: f(fc.stamina),
    strength: f(fc.strength),

    aerialReach: f(avg(fc.gkDiving, fc.jumping)),
    command: f(fc.gkPositioning),
    communication: roll(11, 4),
    handling: f(fc.gkHandling),
    kicking: f(fc.gkKicking),
    oneOnOnes: f(fc.gkDiving),
    reflexes: f(fc.gkReflexes),
    throwing: roll(11, 4),
  };
}

function normalizePlayer(id: number, rawPlayer: RawPlayer): Player {
  return {
    ...rawPlayer,
    ca: toFmAbility(rawPlayer.ca),
    pa: toFmAbility(rawPlayer.pa),
    wage: Math.max(500, Math.round(rawPlayer.wage / 20)),
    attrs: convertAttrs(rawPlayer.attrs, id, rawPlayer.name, rawPlayer.skillMoves),
    personality: generatePersonality(id, rawPlayer.name),
  };
}

function build(): Database {
  const players = new Map<number, Player>();
  for (const [k, v] of Object.entries(data.players)) players.set(Number(k), normalizePlayer(Number(k), v));

  const squadOf = new Map<number, number[]>();
  for (const [k, v] of Object.entries(data.squads)) squadOf.set(Number(k), v);

  const teamById = new Map<number, Team>();
  for (const t of data.teams) teamById.set(t.id, t);

  const teamsByLeague = new Map<string, Team[]>();
  for (const t of data.teams) {
    const list = teamsByLeague.get(t.league) ?? [];
    list.push(t);
    teamsByLeague.set(t.league, list);
  }

  const leagueByTeam = new Map<number, League>();
  for (const l of data.leagues) {
    for (const id of l.teams) leagueByTeam.set(id, l);
  }

  const clubOfPlayer = new Map<number, number>();
  for (const [teamId, squad] of squadOf) {
    for (const pid of squad) clubOfPlayer.set(pid, Number(teamId));
  }

  return {
    meta: data.meta,
    leagues: data.leagues,
    teams: data.teams,
    players,
    squadOf,
    teamById,
    teamsByLeague,
    leagueByTeam,
    clubOfPlayer,
  };
}

export const db: Database = build();

export function getPlayer(id: number): Player {
  const p = db.players.get(id);
  if (!p) throw new Error(`Unknown player ${id}`);
  return p;
}

export const GENERATED_ID_START = 900000;

export function addGeneratedPlayer(id: number, player: Player): void {
  db.players.set(id, player);
}

export function removeGeneratedPlayers(): void {
  for (const id of db.players.keys()) {
    if (id >= GENERATED_ID_START) db.players.delete(id);
  }
}

export function syncGeneratedPlayers(record: Record<number, Player>): void {
  removeGeneratedPlayers();
  for (const [k, p] of Object.entries(record)) db.players.set(Number(k), p);
}

export function getTeam(id: number): Team {
  const t = db.teamById.get(id);
  if (!t) throw new Error(`Unknown team ${id}`);
  return t;
}

export function squadOf(teamId: number): number[] {
  return db.squadOf.get(teamId) ?? [];
}

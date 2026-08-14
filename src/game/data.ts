import raw from "../data/gameData.json";
import type { GameMeta, League, Player, RawGameData, Team } from "./types";

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
}

function build(): Database {
  const players = new Map<number, Player>();
  for (const [k, v] of Object.entries(data.players)) players.set(Number(k), v);

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

  return {
    meta: data.meta,
    leagues: data.leagues,
    teams: data.teams,
    players,
    squadOf,
    teamById,
    teamsByLeague,
    leagueByTeam,
  };
}

export const db: Database = build();

export function getPlayer(id: number): Player {
  const p = db.players.get(id);
  if (!p) throw new Error(`Unknown player ${id}`);
  return p;
}

export function getTeam(id: number): Team {
  const t = db.teamById.get(id);
  if (!t) throw new Error(`Unknown team ${id}`);
  return t;
}

export function squadOf(teamId: number): number[] {
  return db.squadOf.get(teamId) ?? [];
}

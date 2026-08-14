export type Category = "GK" | "DF" | "MF" | "FW";

export interface PlayerAttrs {
  crossing: number;
  finishing: number;
  heading: number;
  shortPassing: number;
  volleys: number;
  dribbling: number;
  curve: number;
  freeKick: number;
  longPassing: number;
  ballControl: number;
  acceleration: number;
  sprintSpeed: number;
  agility: number;
  reactions: number;
  balance: number;
  shotPower: number;
  jumping: number;
  stamina: number;
  strength: number;
  longShots: number;
  aggression: number;
  interceptions: number;
  positioning: number;
  vision: number;
  penalties: number;
  marking: number;
  standingTackle: number;
  slidingTackle: number;
  composure: number;
  gkDiving: number;
  gkHandling: number;
  gkKicking: number;
  gkPositioning: number;
  gkReflexes: number;
}

export interface Player {
  name: string;
  age: number;
  nation: string | null;
  position: string;
  altPositions: string[];
  category: Category;
  height: number | null;
  weight: number | null;
  foot: "left" | "right" | null;
  weakFoot: number;
  skillMoves: number;
  ca: number;
  pa: number;
  value: number;
  wage: number;
  attrs: PlayerAttrs;
}

export interface Team {
  id: number;
  name: string;
  shortName: string;
  league: string;
  country: string;
}

export interface League {
  name: string;
  country: string;
  teams: number[];
}

export interface GameMeta {
  game: string;
  season: string;
  source: string;
  generatedAt: string;
}

export interface RawGameData {
  meta: GameMeta;
  leagues: League[];
  teams: Team[];
  squads: Record<string, number[]>;
  players: Record<string, Player>;
}

// ---- Runtime state -------------------------------------------------------

export interface Fixture {
  id: string;
  stage: number;
  homeId: number;
  awayId: number;
}

export interface Scorer {
  playerId: number;
  minute: number;
}

export interface MatchResult {
  homeId: number;
  awayId: number;
  homeGoals: number;
  awayGoals: number;
  homeScorers: Scorer[];
  awayScorers: Scorer[];
}

export interface StandingRow {
  teamId: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  points: number;
}

export interface TransferRecord {
  playerId: number;
  playerName: string;
  fromTeamId: number | null;
  toTeamId: number | null;
  fee: number;
  date: string;
  kind: "in" | "out" | "release";
}

export interface CareerState {
  version: number;
  saveName: string;
  startedAt: string;
  date: string;
  seasonStartYear: number;
  userClubId: number;
  balance: number;
  wageBudget: number;
  squads: Record<number, number[]>;
  fixtures: Fixture[];
  results: Record<string, MatchResult>;
  nextStage: number;
  totalStages: number;
  seasonOver: boolean;
  seasonEndPrizeAwarded: boolean;
  transfers: TransferRecord[];
  playerOverrides: Record<number, { age: number; ca: number }>;
}

export interface MatchdayReport {
  stage: number;
  date: string;
  results: MatchResult[];
  userResult: MatchResult | null;
}

import type { MatchLog } from "./matchTypes";

export type Category = "GK" | "DF" | "MF" | "FW";

export interface FcAttrs {
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

export interface PlayerAttrs {
  corners: number;
  crossing: number;
  dribbling: number;
  finishing: number;
  firstTouch: number;
  freeKicks: number;
  heading: number;
  longShots: number;
  marking: number;
  passing: number;
  penalties: number;
  tackling: number;
  technique: number;
  aggression: number;
  anticipation: number;
  bravery: number;
  composure: number;
  concentration: number;
  creativity: number;
  decisions: number;
  flair: number;
  offTheBall: number;
  positioning: number;
  teamwork: number;
  vision: number;
  workRate: number;
  acceleration: number;
  agility: number;
  balance: number;
  jumping: number;
  naturalFitness: number;
  pace: number;
  stamina: number;
  strength: number;
  aerialReach: number;
  command: number;
  communication: number;
  handling: number;
  kicking: number;
  oneOnOnes: number;
  reflexes: number;
  throwing: number;
}

export interface Personality {
  consistency: number;
  ambition: number;
  professionalism: number;
  determination: number;
  pressure: number;
  bigMatches: number;
  injuryProneness: number;
  adaptability: number;
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
  personality: Personality;
}

export type RawPlayer = Omit<Player, "personality" | "attrs"> & { attrs: FcAttrs };

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
  players: Record<string, RawPlayer>;
}

// ---- Tactics --------------------------------------------------------------

export type Mentality = "defensive" | "counter" | "balanced" | "control" | "attacking";
export type PassingStyle = "short" | "mixed" | "direct";
export type Tempo = "low" | "normal" | "high";
export type Pressing = "low" | "medium" | "high";
export type DefensiveLine = "deep" | "normal" | "high";
export type Width = "narrow" | "normal" | "wide";

export interface TeamInstructions {
  mentality: Mentality;
  passingStyle: PassingStyle;
  tempo: Tempo;
  pressing: Pressing;
  defensiveLine: DefensiveLine;
  width: Width;
}

export interface PlayerRole {
  id: string;
  name: string;
  category: Category;
  positions: string[];
  instructions: Record<string, number>;
}

export interface FormationSlot {
  roleId: string;
  x: number;
  y: number;
}

export interface Formation {
  id: string;
  name: string;
  slots: FormationSlot[];
}

export interface PitchPoint {
  x: number;
  y: number;
}

export interface LineupSlot {
  playerId: number;
  roleId: string;
  x: number;
  y: number;
  shirtNumber: number;
}

export interface MatchSquad {
  teamId: number;
  formationId: string;
  lineup: LineupSlot[];
  bench: number[];
  instructions: TeamInstructions;
}

export interface TeamTactics {
  formationId: string;
  instructions: TeamInstructions;
  lineup: number[];
  bench: number[];
}

// ---- Dynamic (per-career) player state ------------------------------------

export interface PlayerState {
  condition: number;
  fitness: number;
  morale: number;
  matchSharpness: number;
  form: number[];
  injured: boolean;
  injuryDaysLeft: number;
  suspended: number;
  yellowCards: number;
  training: keyof PlayerAttrs | null;
  seasonMinutes: number;
  wantsTransfer: boolean;
}

export interface PlayerOverrides {
  age: number;
  ca: number;
  attrs: Partial<PlayerAttrs>;
}

export interface SeasonStats {
  appearances: number;
  minutes: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  ratingSum: number;
}

export interface NewsItem {
  id: string;
  date: string;
  kind: "result" | "injury" | "suspension" | "transfer" | "award" | "intake" | "info";
  headline: string;
  body: string;
  read: boolean;
}

export interface BoardObjective {
  targetPos: number;
  description: string;
  status: "pending" | "met" | "failed";
}

export interface Contract {
  expirySeason: number;
  wage: number;
}

export interface ManagerProfile {
  trophies: number;
  wins: number;
  draws: number;
  losses: number;
  seasons: number;
  clubs: number[];
}

// ---- Runtime state -------------------------------------------------------

export interface Fixture {
  id: string;
  stage: number;
  homeId: number;
  awayId: number;
  competition: string;
}

export interface CompetitionInfo {
  id: string;
  name: string;
  round: number;
  teams: number[];
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
  dayOfWeek: number;
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
  playerOverrides: Record<number, PlayerOverrides>;
  playerStates: Record<number, PlayerState>;
  seasonStats: Record<number, SeasonStats>;
  generatedPlayers: Record<number, Player>;
  nextPlayerId: number;
  latestIntake: number[];
  inbox: NewsItem[];
  competitions: Record<string, CompetitionInfo>;
  reputation: number;
  boardObjective: BoardObjective;
  contracts: Record<number, Contract>;
  manager: ManagerProfile;
  sacked: boolean;
  jobOffers: number[];
  tactics: TeamTactics;
  matchLogs: Record<string, MatchLog>;
}

export interface MatchdayReport {
  stage: number;
  date: string;
  results: MatchResult[];
  userResult: MatchResult | null;
  userLog: MatchLog | null;
}

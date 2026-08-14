import type { MatchSquad, PitchPoint } from "./types";

export interface MatchContext {
  id: string;
  seed: number;
  home: MatchSquad;
  away: MatchSquad;
  competition: string;
  stage: number;
}

export type MatchEvent =
  | { type: "kickoff"; minute: number }
  | { type: "halfTime"; minute: number }
  | { type: "fullTime"; minute: number }
  | { type: "pass"; minute: number; playerId: number; team: number; success: boolean; from: PitchPoint; to: PitchPoint }
  | { type: "shot"; minute: number; playerId: number; team: number; xg: number; outcome: "goal" | "saved" | "blocked" | "missed"; from: PitchPoint }
  | { type: "goal"; minute: number; playerId: number; team: number; assistPlayerId: number | null; from: PitchPoint }
  | { type: "tackle"; minute: number; playerId: number; team: number; success: boolean; position: PitchPoint }
  | { type: "foul"; minute: number; playerId: number; team: number; position: PitchPoint }
  | { type: "card"; minute: number; playerId: number; team: number; card: "yellow" | "red" }
  | { type: "offside"; minute: number; playerId: number; team: number }
  | { type: "setPiece"; minute: number; team: number; kind: "corner" | "freeKick" | "throwIn" | "goalKick"; position: PitchPoint }
  | { type: "substitution"; minute: number; team: number; onPlayerId: number; offPlayerId: number }
  | { type: "injury"; minute: number; playerId: number; team: number; severity: "minor" | "serious" };

export interface TeamMatchStats {
  possession: number;
  shots: number;
  shotsOnTarget: number;
  corners: number;
  fouls: number;
  yellowCards: number;
  redCards: number;
  passes: number;
  passAccuracy: number;
  xg: number;
}

export interface PlayerMatchStats {
  rating: number;
  minutes: number;
  passes: number;
  passCompleted: number;
  passAccuracy: number;
  shots: number;
  shotsOnTarget: number;
  saves: number;
  goals: number;
  assists: number;
  tackles: number;
  fouls: number;
  yellowCards: number;
  redCards: number;
}

export interface PositionFrame {
  minute: number;
  p: number[]; // [x0, y0, x1, y1, ...] in roster order (-1 = off pitch)
}

export interface MatchLog {
  context: MatchContext;
  events: MatchEvent[];
  roster: number[];
  frames: PositionFrame[];
  home: TeamMatchStats;
  away: TeamMatchStats;
  players: Record<number, PlayerMatchStats>;
  score: { home: number; away: number };
}

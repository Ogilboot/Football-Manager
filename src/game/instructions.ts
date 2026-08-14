import type { DefensiveLine, Mentality, PassingStyle, Pressing, TeamInstructions, Tempo, Width } from "./types";

export const MENTALITIES: Mentality[] = ["defensive", "counter", "balanced", "control", "attacking"];
export const PASSING_STYLES: PassingStyle[] = ["short", "mixed", "direct"];
export const TEMPOS: Tempo[] = ["low", "normal", "high"];
export const PRESSING_LEVELS: Pressing[] = ["low", "medium", "high"];
export const DEFENSIVE_LINES: DefensiveLine[] = ["deep", "normal", "high"];
export const WIDTHS: Width[] = ["narrow", "normal", "wide"];

export const DEFAULT_INSTRUCTIONS: TeamInstructions = {
  mentality: "balanced",
  passingStyle: "mixed",
  tempo: "normal",
  pressing: "medium",
  defensiveLine: "normal",
  width: "normal",
};

export function instructionPreset(mentality: Mentality): TeamInstructions {
  switch (mentality) {
    case "defensive":
      return { mentality, passingStyle: "direct", tempo: "low", pressing: "low", defensiveLine: "deep", width: "narrow" };
    case "counter":
      return { mentality, passingStyle: "direct", tempo: "normal", pressing: "low", defensiveLine: "normal", width: "narrow" };
    case "balanced":
      return { mentality, passingStyle: "mixed", tempo: "normal", pressing: "medium", defensiveLine: "normal", width: "normal" };
    case "control":
      return { mentality, passingStyle: "short", tempo: "normal", pressing: "medium", defensiveLine: "normal", width: "normal" };
    case "attacking":
      return { mentality, passingStyle: "short", tempo: "high", pressing: "high", defensiveLine: "high", width: "wide" };
  }
}

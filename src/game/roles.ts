import type { PlayerRole } from "./types";

export const ROLES: PlayerRole[] = [
  { id: "gk", name: "Goalkeeper", category: "GK", positions: ["GK"], instructions: {} },
  { id: "sweeperKeeper", name: "Sweeper Keeper", category: "GK", positions: ["GK"], instructions: {} },
  { id: "cb", name: "Centre Back", category: "DF", positions: ["CB"], instructions: {} },
  { id: "bpd", name: "Ball-Playing Defender", category: "DF", positions: ["CB"], instructions: {} },
  { id: "fb", name: "Full Back", category: "DF", positions: ["LB", "RB", "LWB", "RWB"], instructions: {} },
  { id: "wb", name: "Wing Back", category: "DF", positions: ["LWB", "RWB", "LB", "RB"], instructions: {} },
  { id: "dm", name: "Defensive Midfielder", category: "MF", positions: ["CDM", "CM"], instructions: {} },
  { id: "cm", name: "Central Midfielder", category: "MF", positions: ["CM", "CDM"], instructions: {} },
  { id: "dlp", name: "Deep-Lying Playmaker", category: "MF", positions: ["CDM", "CM"], instructions: {} },
  { id: "am", name: "Attacking Midfielder", category: "MF", positions: ["CAM"], instructions: {} },
  { id: "ap", name: "Advanced Playmaker", category: "MF", positions: ["CAM", "CM"], instructions: {} },
  { id: "wm", name: "Wide Midfielder", category: "MF", positions: ["LM", "RM", "LW", "RW"], instructions: {} },
  { id: "winger", name: "Winger", category: "FW", positions: ["LW", "RW"], instructions: {} },
  { id: "if", name: "Inside Forward", category: "FW", positions: ["LW", "RW"], instructions: {} },
  { id: "st", name: "Advanced Forward", category: "FW", positions: ["ST", "CF"], instructions: {} },
  { id: "poacher", name: "Poacher", category: "FW", positions: ["ST"], instructions: {} },
  { id: "target", name: "Target Man", category: "FW", positions: ["ST"], instructions: {} },
  { id: "dlf", name: "Deep-Lying Forward", category: "FW", positions: ["ST", "CF", "CAM"], instructions: {} },
];

const roleMap = new Map(ROLES.map((r) => [r.id, r]));

export function getRole(id: string): PlayerRole {
  const role = roleMap.get(id);
  if (!role) throw new Error(`Unknown role ${id}`);
  return role;
}

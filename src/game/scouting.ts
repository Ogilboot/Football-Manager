export type KnowledgeLevel = "unknown" | "partial" | "full";

export function knowledgeLevel(k: number): KnowledgeLevel {
  if (k >= 70) return "full";
  if (k >= 30) return "partial";
  return "unknown";
}

export function revealAttr(value: number, level: KnowledgeLevel): number | null {
  if (level === "full") return value;
  if (level === "partial") return Math.round(value / 5) * 5;
  return null;
}

export function revealCa(ca: number, level: KnowledgeLevel): number | null {
  if (level === "full") return ca;
  if (level === "partial") return Math.round(ca / 10) * 10;
  return null;
}

export function displayAttr(value: number, level: KnowledgeLevel): string {
  if (level === "unknown") return "?";
  if (level === "partial") return `~${Math.round(value / 5) * 5}`;
  return String(value);
}

export const REPUTATION_TIERS = ["World class", "Top player", "Good player", "Decent player", "Average", "Below average"] as const;

export function reputationTier(ca: number): string {
  if (ca >= 180) return "World class";
  if (ca >= 160) return "Top player";
  if (ca >= 140) return "Good player";
  if (ca >= 120) return "Decent player";
  if (ca >= 100) return "Average";
  return "Below average";
}

const REPUTATION_MIN_CA: Record<string, number> = {
  "World class": 180,
  "Top player": 160,
  "Good player": 140,
  "Decent player": 120,
  "Average": 100,
};

export function reputationMinCa(tier: string): number | null {
  return REPUTATION_MIN_CA[tier] ?? null;
}

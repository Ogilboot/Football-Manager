const TEAM_COLORS: Record<string, string> = {
  "Manchester City": "#6CABDD",
  "Man Utd": "#DA291C",
  "Arsenal": "#EF0107",
  "Liverpool": "#C8102E",
  "Chelsea": "#034694",
  "Spurs": "#132257",
  "Newcastle Utd": "#241F20",
  "Aston Villa": "#670E36",
  "West Ham": "#7A263A",
  "Everton": "#003399",
  "Fulham": "#FFFFFF",
  "Brighton": "#0057B8",
  "Real Madrid": "#FEBE10",
  "Barcelona": "#A50044",
  "Atletico Madrid": "#CB3524",
  "Sevilla": "#F43333",
  "Bayern Munich": "#DC052D",
  "Borussia Dortmund": "#FDE100",
  "PSG": "#004170",
  "Juventus": "#1A1A1A",
  "Inter": "#0068A8",
  "Milan": "#FB090B",
  "Napoli": "#12A0D7",
  "Roma": "#8E1F2F",
  "Lyon": "#DA001A",
  "Marseille": "#2FAEE0",
  "Monaco": "#CC0000",
};

export function teamColor(name: string): string | null {
  return TEAM_COLORS[name] ?? null;
}

import type { Fixture, MatchResult, StandingRow } from "./types";

export function computeStandings(teamIds: number[], fixtures: Fixture[], results: Record<string, MatchResult>): StandingRow[] {
  const rows = new Map<number, StandingRow>();
  for (const id of teamIds) {
    rows.set(id, { teamId: id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 });
  }

  for (const f of fixtures) {
    const res = results[f.id];
    if (!res) continue;
    const home = rows.get(f.homeId);
    const away = rows.get(f.awayId);
    if (!home || !away) continue;

    home.played++; away.played++;
    home.gf += res.homeGoals; home.ga += res.awayGoals;
    away.gf += res.awayGoals; away.ga += res.homeGoals;

    if (res.homeGoals > res.awayGoals) { home.won++; away.lost++; home.points += 3; }
    else if (res.homeGoals < res.awayGoals) { away.won++; home.lost++; away.points += 3; }
    else { home.drawn++; away.drawn++; home.points += 1; away.points += 1; }
  }

  return [...rows.values()].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gd = (b.gf - b.ga) - (a.gf - a.ga);
    if (gd !== 0) return gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return 0;
  });
}

import { getPlayer } from "./data";

export type CaResolver = (playerId: number) => number;

export function pickBestXI(squad: number[], caOf: CaResolver): number[] {
  const players = squad.map((id) => ({ id, p: getPlayer(id), ca: caOf(id) }));
  const by = (cat: string, count: number): number[] =>
    players
      .filter((x) => x.p.category === cat)
      .sort((a, b) => b.ca - a.ca)
      .slice(0, count)
      .map((x) => x.id);

  let xi = [...by("GK", 1), ...by("DF", 4), ...by("MF", 3), ...by("FW", 3)];
  if (xi.length < 11) {
    const used = new Set(xi);
    const fill = players
      .filter((x) => !used.has(x.id))
      .sort((a, b) => b.ca - a.ca)
      .map((x) => x.id);
    xi = [...xi, ...fill].slice(0, 11);
  }
  return xi;
}

export function teamStrength(squad: number[], caOf: CaResolver): number {
  if (!squad.length) return 110;
  const xi = pickBestXI(squad, caOf);
  const sum = xi.reduce((s, id) => s + caOf(id), 0);
  return sum / xi.length;
}

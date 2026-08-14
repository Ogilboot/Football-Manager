import type { Fixture } from "./types";

export function roundRobinPairs(ids: number[]): [number, number][][] {
  const n = ids.length;
  const fixed = ids[0];
  const rest = ids.slice(1);
  const rounds: [number, number][][] = [];

  for (let round = 0; round < n - 1; round++) {
    const arr = [fixed, ...rest];
    const pairs: [number, number][] = [];
    for (let i = 0; i < n / 2; i++) {
      pairs.push([arr[i], arr[n - 1 - i]]);
    }
    rounds.push(pairs);
    rest.push(rest.shift() as number);
  }
  return rounds;
}

export function generateFixtures(teamIds: number[]): Fixture[] {
  const ids = [...teamIds];
  const firstHalf = roundRobinPairs(ids);
  const fixtures: Fixture[] = [];

  const add = (round: number, home: number, away: number) => {
    fixtures.push({ id: `league-${round}-${home}-${away}`, stage: round, homeId: home, awayId: away, competition: "league" });
  };

  const half = firstHalf.length;
  firstHalf.forEach((round, i) => {
    for (const [a, b] of round) add(i + 1, a, b);
  });
  firstHalf.forEach((round, i) => {
    for (const [a, b] of round) add(half + i + 1, b, a);
  });

  return fixtures;
}

export function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pairKnockout(teams: number[], rng: () => number): { matches: [number, number][]; byes: number[] } {
  const shuffled = shuffle(teams, rng);
  const matches: [number, number][] = [];
  while (shuffled.length >= 2) {
    matches.push([shuffled.pop()!, shuffled.pop()!]);
  }
  return { matches, byes: shuffled };
}

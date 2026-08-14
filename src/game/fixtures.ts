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
    fixtures.push({ id: `${round}-${home}-${away}`, stage: round, homeId: home, awayId: away });
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

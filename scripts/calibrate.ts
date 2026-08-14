import { db } from "../src/game/data";
import { simulateMatch } from "../src/game/matchEngine";
import { mulberry32 } from "../src/game/rng";
import { teamStrength } from "../src/game/strength";
import { aiPickTactics, buildMatchSquad } from "../src/game/teamSelection";

const caOf = (id: number) => db.players.get(id)!.ca;
const teams = db.teams
  .map((t) => ({ t, str: teamStrength(db.squadOf.get(t.id) ?? [], caOf) }))
  .sort((a, b) => b.str - a.str);

function ctx(homeId: number, awayId: number, seed: number) {
  const hs = db.squadOf.get(homeId) ?? [];
  const as = db.squadOf.get(awayId) ?? [];
  return {
    id: `${homeId}-${awayId}`,
    seed,
    home: buildMatchSquad(homeId, hs, aiPickTactics(hs, caOf, mulberry32(homeId + 1)), caOf),
    away: buildMatchSquad(awayId, as, aiPickTactics(as, caOf, mulberry32(awayId + 1)), caOf),
    competition: "T",
    stage: 1,
  };
}

const a = teams[10].t;
const b = teams[11].t;
let goals = 0, shots = 0, onTarget = 0, corners = 0, fouls = 0, yellows = 0;
const n = 500;
for (let i = 0; i < n; i++) {
  const log = simulateMatch(ctx(a.id, b.id, i + 1), caOf);
  goals += log.score.home + log.score.away;
  shots += log.home.shots + log.away.shots;
  onTarget += log.home.shotsOnTarget + log.away.shotsOnTarget;
  corners += log.home.corners + log.away.corners;
  fouls += log.home.fouls + log.away.fouls;
  yellows += log.home.yellowCards + log.away.yellowCards;
}
console.log(`per match (n=${n})`);
console.log(`goals ${(goals / n).toFixed(2)} | shots ${(shots / n).toFixed(1)} | onTarget ${(onTarget / n).toFixed(1)} | corners ${(corners / n).toFixed(1)} | fouls ${(fouls / n).toFixed(1)} | yellows ${(yellows / n).toFixed(1)}`);

// strong vs weak
const s = teams[0].t, w = teams[teams.length - 1].t;
let sWins = 0, g = 0;
for (let i = 0; i < 300; i++) {
  const log = simulateMatch(ctx(s.id, w.id, i + 1), caOf);
  if (log.score.home > log.score.away) sWins++;
  g += log.score.home + log.score.away;
}
console.log(`strong home win rate ${(sWins / 300).toFixed(2)}, avg goals ${(g / 300).toFixed(2)}`);

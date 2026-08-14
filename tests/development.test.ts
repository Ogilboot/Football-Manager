import { test } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/game/data";
import { finishSeason, getPlayerCurrent, getPlayerState, newCareer, setTraining } from "../src/game/career";

const club = db.teams[0];

function youngId(category: string, minGap: number): number | null {
  const found = [...db.players.entries()].find(([, p]) => p.category === category && p.age <= 21 && p.pa - p.ca >= minGap);
  return found ? found[0] : null;
}

const attrSum = (p: ReturnType<typeof getPlayerCurrent>) => Object.values(p.attrs).reduce((a, b) => a + b, 0);

test("young players grow CA and attributes over a season", () => {
  let state = newCareer(club.id, "t");
  const pid = youngId("FW", 5);
  assert.ok(pid != null, "no young forward with a CA/PA gap found");
  const before = getPlayerCurrent(state, pid);

  state = setTraining(state, pid, "finishing");
  state = {
    ...state,
    seasonOver: true,
    playerStates: { ...state.playerStates, [pid]: { ...getPlayerState(state, pid), seasonMinutes: 3000 } },
  };

  const finished = finishSeason(state);
  const after = getPlayerCurrent(finished, pid);

  assert.ok(after.ca > before.ca, `CA should grow: ${before.ca} -> ${after.ca}`);
  assert.ok(after.ca <= db.players.get(pid)!.pa, "CA must not exceed PA");
  assert.ok(attrSum(after) > attrSum(before), "attribute sum should grow");
});

test("training focus boosts the focused attribute", () => {
  let state = newCareer(club.id, "t");
  const pid = youngId("FW", 8);
  assert.ok(pid != null, "no young forward with a large gap found");
  const base = getPlayerCurrent(state, pid);
  if (base.attrs.finishing >= 20) return;

  state = setTraining(state, pid, "finishing");
  state = { ...state, seasonOver: true, playerStates: { ...state.playerStates, [pid]: { ...getPlayerState(state, pid), seasonMinutes: 3000 } } };
  const finished = finishSeason(state);
  const after = getPlayerCurrent(finished, pid);
  assert.ok(after.attrs.finishing > base.attrs.finishing, `finishing should grow: ${base.attrs.finishing} -> ${after.attrs.finishing}`);
});

test("a player at their potential does not grow", () => {
  let state = newCareer(club.id, "t");
  const [pid, p] = [...db.players.entries()][0];
  state = { ...state, seasonOver: true, playerOverrides: { [pid]: { age: p.age, ca: p.pa, attrs: {} } } };
  const after = getPlayerCurrent(finishSeason(state), pid);
  assert.equal(after.ca, p.pa, "player already at potential should not grow");
});

test("older players decline with age", () => {
  let state = newCareer(club.id, "t");
  const old = [...db.players.entries()].find(([, p]) => p.age >= 33 && p.ca > 82);
  assert.ok(old, "no old player found");
  const before = getPlayerCurrent(state, old[0]);
  state = { ...state, seasonOver: true };
  const after = getPlayerCurrent(finishSeason(state), old[0]);
  assert.ok(after.ca < before.ca, `older player should decline: ${before.ca} -> ${after.ca}`);
});

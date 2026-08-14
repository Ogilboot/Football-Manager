import { test } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/game/data";
import { advanceWeek, getPlayerState, newCareer } from "../src/game/career";
import { defaultPlayerState, isAvailable, matchPerformance, resolveWeekStates } from "../src/game/playerState";
import { DEFAULT_INSTRUCTIONS } from "../src/game/instructions";
import type { MatchLog } from "../src/game/matchTypes";
import type { PlayerState } from "../src/game/types";

const userClub = db.teams[0];

function stateWith(overrides: Partial<PlayerState>): PlayerState {
  return { ...defaultPlayerState(), ...overrides };
}

test("matchPerformance rewards freshness and form, punishes tiredness", () => {
  const fresh = matchPerformance(stateWith({}));
  assert.ok(fresh > 0.9 && fresh < 1.15, `fresh ${fresh}`);

  const tired = matchPerformance(stateWith({ condition: 40, matchSharpness: 50, morale: 3, form: [5, 5, 5, 5, 5] }));
  assert.ok(tired < 0.8, `tired ${tired}`);

  const inForm = matchPerformance(stateWith({ condition: 100, matchSharpness: 100, morale: 20, form: [8, 8, 8, 8, 8] }));
  assert.ok(inForm > 1.2, `inForm ${inForm}`);

  assert.ok(fresh > tired);
});

test("isAvailable blocks injured and suspended players", () => {
  let state = newCareer(userClub.id, "t");
  const pid = state.squads[state.userClubId]![0];
  assert.ok(isAvailable(state, pid));

  state = { ...state, playerStates: { ...state.playerStates, [pid]: stateWith({ injured: true, injuryDaysLeft: 12 }) } };
  assert.ok(!isAvailable(state, pid));

  state = { ...state, playerStates: { ...state.playerStates, [pid]: stateWith({ suspended: 1 }) } };
  assert.ok(!isAvailable(state, pid));
});

test("advanceWeek tracks form and keeps states within bounds", () => {
  let state = newCareer(userClub.id, "t");
  const starters = state.tactics.lineup;
  state = advanceWeek(state).state;

  for (const id of starters) {
    const ps = getPlayerState(state, id);
    assert.ok(ps.form.length >= 1, `no form entry for starter ${id}`);
    assert.ok(ps.form.every((r) => r >= 3 && r <= 10));
    assert.ok(ps.condition >= 60 && ps.condition <= 100, `condition ${ps.condition}`);
    assert.ok(ps.fitness >= 80 && ps.fitness <= 100, `fitness ${ps.fitness}`);
    assert.ok(ps.matchSharpness >= 50 && ps.matchSharpness <= 100, `sharpness ${ps.matchSharpness}`);
    assert.ok(ps.morale >= 1 && ps.morale <= 20, `morale ${ps.morale}`);
  }
});

test("resolveWeekStates applies red cards and five-yellow suspensions", () => {
  const teamA = userClub.id;
  const teamB = db.teams[1].id;
  const redId = 1001;
  const yellowId = 1002;
  const cleanId = 1003;

  const log: MatchLog = {
    context: {
      id: "t",
      seed: 1,
      home: { teamId: teamA, formationId: "4-4-2", lineup: [{ playerId: redId, roleId: "cb", x: 30, y: 40, shirtNumber: 1 }, { playerId: yellowId, roleId: "cm", x: 40, y: 50, shirtNumber: 2 }, { playerId: cleanId, roleId: "st", x: 40, y: 60, shirtNumber: 3 }], bench: [], instructions: DEFAULT_INSTRUCTIONS },
      away: { teamId: teamB, formationId: "4-4-2", lineup: [], bench: [], instructions: DEFAULT_INSTRUCTIONS },
      competition: "T",
      stage: 1,
    },
    events: [{ type: "injury", minute: 30, playerId: cleanId, team: teamA, severity: "serious" }],
    roster: [redId, yellowId, cleanId],
    frames: [],
    home: { possession: 50, shots: 0, shotsOnTarget: 0, corners: 0, fouls: 0, yellowCards: 0, redCards: 0, passes: 0, passAccuracy: 0, xg: 0 },
    away: { possession: 50, shots: 0, shotsOnTarget: 0, corners: 0, fouls: 0, yellowCards: 0, redCards: 0, passes: 0, passAccuracy: 0, xg: 0 },
    players: {
      [redId]: { rating: 4, minutes: 45, passes: 0, passCompleted: 0, passAccuracy: 0, shots: 0, shotsOnTarget: 0, saves: 0, goals: 0, assists: 0, tackles: 0, fouls: 1, yellowCards: 0, redCards: 1 },
      [yellowId]: { rating: 6, minutes: 90, passes: 0, passCompleted: 0, passAccuracy: 0, shots: 0, shotsOnTarget: 0, saves: 0, goals: 0, assists: 0, tackles: 0, fouls: 0, yellowCards: 5, redCards: 0 },
      [cleanId]: { rating: 7, minutes: 90, passes: 0, passCompleted: 0, passAccuracy: 0, shots: 0, shotsOnTarget: 0, saves: 0, goals: 0, assists: 0, tackles: 0, fouls: 0, yellowCards: 0, redCards: 0 },
    },
    score: { home: 0, away: 0 },
  };

  const after = resolveWeekStates({}, [log], [redId, yellowId, cleanId], 2025);

  assert.equal(after[redId].suspended, 1, `red card suspension ${after[redId].suspended}`);
  assert.equal(after[yellowId].suspended, 1, `five-yellow suspension ${after[yellowId].suspended}`);
  assert.ok(after[cleanId].injuryDaysLeft > 0, `injury days ${after[cleanId].injuryDaysLeft}`);
});

test("suspension is served after one match week", () => {
  const pre = { [999]: stateWith({ suspended: 1 }) };
  const after = resolveWeekStates(pre, [], [999], 2025);
  assert.equal(after[999].suspended, 0);
});

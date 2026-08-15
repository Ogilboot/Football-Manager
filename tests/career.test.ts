import { test } from "node:test";
import assert from "node:assert/strict";
import {
  advanceWeek,
  askingPriceFor,
  contractDemand,
  finishSeason,
  getPlayerCurrent,
  leagueStandings,
  makeTransferBid,
  newCareer,
  playerClub,
  releasePlayer,
  sellToClub,
  startNextSeason,
  transferOffers,
} from "../src/game/career";
import { db } from "../src/game/data";

const city = db.teams.find((t) => t.name === "Manchester City")!;

test("newCareer creates a valid league season", () => {
  const state = newCareer(city.id, "t");
  assert.equal(state.userClubId, city.id);
  assert.ok(state.balance >= 2_000_000);
  assert.equal(state.totalStages, 38);
  assert.equal(state.fixtures.filter((f) => f.competition === "league").length, 380);
  assert.ok(state.fixtures.length > 380, "should include cup and European fixtures");
  assert.ok((state.squads[city.id] ?? []).length >= 11);
  assert.equal(state.nextStage, 1);
  assert.equal(state.seasonOver, false);
});

test("advanceWeek plays one full round of fixtures", () => {
  let state = newCareer(city.id, "t");
  const { state: next, report } = advanceWeek(state);
  assert.equal(report.results.length, 10); // 20 teams = 10 matches per round
  assert.equal(next.nextStage, 2);
  assert.equal(Object.keys(next.results).length, 10);
  assert.equal(report.userResult != null, true);
  // date advanced by 7 days
  const diff = new Date(next.date).getTime() - new Date(state.date).getTime();
  assert.equal(diff, 7 * 24 * 60 * 60 * 1000);
});

test("a full season ends correctly with consistent standings", () => {
  let state = newCareer(city.id, "t");
  for (let i = 0; i < state.totalStages; i++) state = advanceWeek(state).state;

  assert.equal(state.seasonOver, true);
  const standings = leagueStandings(state);
  assert.equal(standings.length, 20);

  let totalWins = 0;
  let totalLosses = 0;
  let totalDraws = 0;
  for (const r of standings) {
    assert.equal(r.played, 38);
    assert.equal(r.points, r.won * 3 + r.drawn);
    assert.equal(r.won + r.drawn + r.lost, 38);
    totalWins += r.won;
    totalLosses += r.lost;
    totalDraws += r.drawn;
  }
  assert.equal(totalWins, totalLosses);
  assert.equal(totalDraws % 2, 0);
});

test("makeTransferBid signs a player when bid and wages are accepted", () => {
  let state = newCareer(city.id, "t");
  const target = [...db.players.entries()]
    .map(([id, p]) => ({ id, value: p.value }))
    .filter((x) => playerClub(state, x.id) !== city.id && x.value < 20_000_000)
    .sort((a, b) => a.value - b.value)[0];
  assert.ok(target, "no cheap transfer target found");

  const ask = askingPriceFor(state, target.id);
  const demand = contractDemand(state, target.id, 3);
  const before = state.balance;
  const out = makeTransferBid(state, target.id, ask, demand, 3);
  assert.equal(out.ok, true, out.message);
  assert.equal(out.state.balance, before - ask);
  assert.ok((out.state.squads[city.id] ?? []).includes(target.id));
  assert.equal(playerClub(out.state, target.id), city.id);
});

test("makeTransferBid rejects when funds are insufficient", () => {
  const state = newCareer(city.id, "t");
  const mbappe = [...db.players.keys()].find((id) => db.players.get(id)!.name.includes("Mbapp"))!;
  const ask = askingPriceFor(state, mbappe);
  const demand = contractDemand(state, mbappe, 3);
  const out = makeTransferBid(state, mbappe, ask, demand, 3);
  assert.equal(out.ok, false);
  assert.equal(out.state, state);
});

test("makeTransferBid rejects a player already in the squad", () => {
  const state = newCareer(city.id, "t");
  const existing = state.squads[city.id][0];
  const out = makeTransferBid(state, existing, 1_000_000, 5000, 3);
  assert.equal(out.ok, false);
});

test("transferOffers and sellToClub sell a player to an interested club", () => {
  let state = newCareer(city.id, "t");
  let target: number | null = null;
  let offer: { clubId: number; fee: number } | null = null;
  for (const id of [...state.squads[city.id]].sort((a, b) => db.players.get(a)!.ca - db.players.get(b)!.ca)) {
    const o = transferOffers(state, id);
    if (o.length) { target = id; offer = o[0]; break; }
  }
  assert.ok(target != null && offer != null, "at least one squad player should attract interest");

  const before = state.balance;
  const out = sellToClub(state, target, offer.clubId, offer.fee);
  assert.equal(out.ok, true, out.message);
  assert.ok(!(out.state.squads[city.id] ?? []).includes(target));
  assert.ok(out.state.balance > before);
  assert.equal(playerClub(out.state, target), offer.clubId);
});

test("releasePlayer frees the player without changing balance", () => {
  let state = newCareer(city.id, "t");
  const id = state.squads[city.id][0];
  const before = state.balance;
  const out = releasePlayer(state, id);
  assert.equal(out.ok, true);
  assert.equal(out.state.balance, before);
  assert.equal(playerClub(out.state, id), null);
});

test("finishSeason ages players and awards prize once", () => {
  let state = newCareer(city.id, "t");
  for (let i = 0; i < state.totalStages; i++) state = advanceWeek(state).state;

  const sampleId = state.squads[city.id][0];
  const originalAge = db.players.get(sampleId)!.age;
  const before = state.balance;

  const finished = finishSeason(state);
  assert.equal(finished.seasonEndPrizeAwarded, true);
  assert.ok(finished.balance > before, "prize money should be added");
  assert.equal(getPlayerCurrent(finished, sampleId).age, originalAge + 1);

  // calling again does nothing
  assert.equal(finishSeason(finished), finished);
});

test("startNextSeason resets the season and increments the year", () => {
  let state = newCareer(city.id, "t");
  for (let i = 0; i < state.totalStages; i++) state = advanceWeek(state).state;

  const next = startNextSeason(state);
  assert.equal(next.seasonStartYear, state.seasonStartYear + 1);
  assert.equal(next.nextStage, 1);
  assert.equal(next.seasonOver, false);
  assert.equal(Object.keys(next.results).length, 0);
  assert.equal(next.fixtures.filter((f) => f.competition === "league").length, 380);
});

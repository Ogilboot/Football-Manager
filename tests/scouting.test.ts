import { test } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/game/data";
import {
  addToShortlist,
  advance,
  applyScoutingProgress,
  comfortablePositions,
  isShortlisted,
  newCareer,
  removeFromShortlist,
  scoutKnowledgeOf,
} from "../src/game/career";
import { displayAttr, knowledgeLevel, reputationMinCa, reputationTier, revealAttr, revealCa } from "../src/game/scouting";

const club = db.teams[0];
const userLeague = db.leagueByTeam.get(club.id)!;

function foreignPlayer(): number {
  for (const id of db.players.keys()) {
    const cid = db.clubOfPlayer.get(id);
    if (cid == null) continue;
    if (db.leagueByTeam.get(cid)?.name !== userLeague.name) return id;
  }
  throw new Error("no foreign player found");
}

function leagueRival(): number {
  const mySquad = new Set(db.squadOf.get(club.id) ?? []);
  for (const id of db.players.keys()) {
    const cid = db.clubOfPlayer.get(id);
    if (cid == null || cid === club.id) continue;
    if (db.leagueByTeam.get(cid)?.name === userLeague.name && !mySquad.has(id)) return id;
  }
  throw new Error("no league rival found");
}

test("knowledgeLevel splits unknown/partial/full", () => {
  assert.equal(knowledgeLevel(0), "unknown");
  assert.equal(knowledgeLevel(29), "unknown");
  assert.equal(knowledgeLevel(30), "partial");
  assert.equal(knowledgeLevel(69), "partial");
  assert.equal(knowledgeLevel(70), "full");
  assert.equal(knowledgeLevel(100), "full");
});

test("revealAttr masks by knowledge level", () => {
  assert.equal(revealAttr(13, "full"), 13);
  assert.equal(revealAttr(13, "partial"), 15);
  assert.equal(revealAttr(12, "partial"), 10);
  assert.equal(revealAttr(13, "unknown"), null);
});

test("revealCa masks by knowledge level", () => {
  assert.equal(revealCa(174, "full"), 174);
  assert.equal(revealCa(174, "partial"), 170);
  assert.equal(revealCa(174, "unknown"), null);
});

test("displayAttr renders masked strings", () => {
  assert.equal(displayAttr(13, "unknown"), "?");
  assert.equal(displayAttr(13, "partial"), "~15");
  assert.equal(displayAttr(13, "full"), "13");
});

test("reputation tiers and min CA", () => {
  assert.equal(reputationTier(185), "World class");
  assert.equal(reputationTier(165), "Top player");
  assert.equal(reputationTier(145), "Good player");
  assert.equal(reputationTier(99), "Below average");
  assert.equal(reputationMinCa("Good player"), 140);
  assert.equal(reputationMinCa("Any"), null);
});

test("comfortablePositions includes natural, accomplished and competent", () => {
  const cb = [...db.players.values()].find((p) => p.position === "CB")!;
  const comfy = comfortablePositions(cb);
  assert.ok(comfy.includes("CB"));
  assert.ok(comfy.includes("LB"), "a CB is competent at LB");
});

test("scoutKnowledgeOf defaults: squad full, league rival partial, foreign unknown", () => {
  const state = newCareer(club.id, "t");
  const mine = state.squads[club.id][0];
  const rival = leagueRival();
  const foreign = foreignPlayer();

  assert.equal(scoutKnowledgeOf(state, mine), 100);
  const rivalK = scoutKnowledgeOf(state, rival);
  assert.ok(rivalK >= 30 && rivalK < 70, `league rival should be partially known, got ${rivalK}`);
  assert.ok(scoutKnowledgeOf(state, foreign) < 30, `foreign player should be unknown, got ${scoutKnowledgeOf(state, foreign)}`);
});

test("shortlist add/remove/isShortlisted", () => {
  const state = newCareer(club.id, "t");
  const foreign = foreignPlayer();

  const added = addToShortlist(state, foreign);
  assert.ok(isShortlisted(added, foreign));
  assert.equal(addToShortlist(added, foreign), added, "adding twice is a no-op");

  const removed = removeFromShortlist(added, foreign);
  assert.ok(!isShortlisted(removed, foreign));
});

test("applyScoutingProgress increases knowledge toward full", () => {
  const state = addToShortlist(newCareer(club.id, "t"), foreignPlayer());
  const id = state.shortlist[0];
  assert.ok(scoutKnowledgeOf(state, id) < 30);

  const p1 = applyScoutingProgress(state);
  const k1 = scoutKnowledgeOf(p1, id);
  assert.ok(k1 > scoutKnowledgeOf(state, id), "knowledge should increase");

  let cur = state;
  for (let i = 0; i < 6 && scoutKnowledgeOf(cur, id) < 70; i++) cur = applyScoutingProgress(cur);
  assert.ok(scoutKnowledgeOf(cur, id) >= 70, "eventually fully scouted");
});

test("advance applies scouting progress on matchday", () => {
  const base = newCareer(club.id, "t");
  const foreign = foreignPlayer();
  const state = addToShortlist(base, foreign);
  const before = scoutKnowledgeOf(state, foreign);

  const after = advance(state).state;
  assert.ok(scoutKnowledgeOf(after, foreign) > before, "first advance is a matchday and should progress scouting");
});

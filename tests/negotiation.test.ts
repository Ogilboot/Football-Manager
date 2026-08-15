import { test } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/game/data";
import { askingPrice, evaluateContractOffer, reputationFromStrength, wageDemand, willJoin } from "../src/game/negotiation";
import { defaultPlayerState } from "../src/game/playerState";
import type { Contract, Player } from "../src/game/types";

function findPlayer(pred: (p: Player) => boolean): Player {
  for (const p of db.players.values()) if (pred(p)) return p;
  throw new Error("no player found");
}

const contract = (wage: number, yearsLeft = 3): Contract => ({ expirySeason: 2025 + yearsLeft, wage });

test("reputationFromStrength maps strength to a 0-100 scale", () => {
  assert.equal(reputationFromStrength(115), 0);
  assert.equal(reputationFromStrength(165), 100);
  assert.ok(reputationFromStrength(140) > reputationFromStrength(120));
});

test("wageDemand scales with morale, age and length", () => {
  const p = findPlayer((x) => x.age >= 20 && x.age <= 26 && x.ca >= 130);
  const base = defaultPlayerState();
  const c = contract(p.wage);

  const normal = wageDemand(p, base, c, 2025, 3);
  assert.ok(normal >= p.wage, "demand should never be below current wage");

  const happy = wageDemand(p, { ...base, morale: 17 }, c, 2025, 3);
  assert.ok(happy > normal, "happy players ask for more");

  const longer = wageDemand(p, base, c, 2025, 5);
  assert.ok(longer > normal, "longer deals cost more");
});

test("wageDemand refuses when the player wants a transfer", () => {
  const p = findPlayer((x) => x.ca >= 140);
  const c = contract(p.wage);
  const demand = wageDemand(p, { ...defaultPlayerState(), wantsTransfer: true }, c, 2025, 3);
  assert.equal(demand, Infinity);
});

test("evaluateContractOffer accepts near-demand and rejects lowballs", () => {
  const accepted = evaluateContractOffer(1000, 1000);
  assert.ok(accepted.accepted);

  const near = evaluateContractOffer(1000, 920);
  assert.ok(near.accepted, "90%+ should be accepted");

  const rejected = evaluateContractOffer(1000, 500);
  assert.ok(!rejected.accepted);
  assert.ok(rejected.counter > 1000, "a rejected player counters above their demand");
});

test("askingPrice rises for a star and drops for an expiring contract", () => {
  const p = findPlayer((x) => x.ca >= 160);
  const base = askingPrice(p, contract(p.wage, 3), 130, 2025);
  const expiring = askingPrice(p, contract(p.wage, 1), 130, 2025);
  assert.ok(expiring < base, "expiring contracts are cheaper");
  assert.ok(base >= p.value, "a star should not be cheaper than market value");
});

test("willJoin refuses a happy player at a comparable club", () => {
  const p = findPlayer((x) => x.ca >= 150);
  const res = willJoin({
    player: p,
    morale: 16,
    wantsTransfer: false,
    currentWage: p.wage,
    currentClubStrength: 150,
    targetClubStrength: 155,
    targetReputation: 60,
    offeredWage: p.wage,
  });
  assert.ok(!res.willing, "a happy player should stay put");
});

test("willJoin refuses a top player joining a far weaker club", () => {
  const p = findPlayer((x) => x.ca >= 175);
  const res = willJoin({
    player: p,
    morale: 12,
    wantsTransfer: false,
    currentWage: p.wage,
    currentClubStrength: 170,
    targetClubStrength: 120,
    targetReputation: 20,
    offeredWage: p.wage,
  });
  assert.ok(!res.willing, "a world-class player should reject a small club");
});

test("willJoin welcomes a player stepping up a level", () => {
  const p = findPlayer((x) => x.ca >= 120 && x.ca <= 140);
  const res = willJoin({
    player: p,
    morale: 12,
    wantsTransfer: false,
    currentWage: p.wage,
    currentClubStrength: 120,
    targetClubStrength: 160,
    targetReputation: 80,
    offeredWage: p.wage,
  });
  assert.ok(res.willing, "a step up should be welcome");
});

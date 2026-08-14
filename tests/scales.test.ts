import { test } from "node:test";
import assert from "node:assert/strict";
import { clamp, toFmAbility, toFmAttr } from "../src/game/scales";

test("toFmAttr converts 1-99 to 1-20", () => {
  assert.equal(toFmAttr(99), 20);
  assert.equal(toFmAttr(95), 19);
  assert.equal(toFmAttr(90), 18);
  assert.equal(toFmAttr(75), 15);
  assert.equal(toFmAttr(50), 10);
  assert.equal(toFmAttr(1), 1);
});

test("toFmAttr clamps to [1,20]", () => {
  assert.equal(toFmAttr(0), 1);
  assert.equal(toFmAttr(100), 20);
  assert.equal(toFmAttr(-5), 1);
});

test("toFmAbility converts 1-99 to 1-200", () => {
  assert.equal(toFmAbility(99), 198);
  assert.equal(toFmAbility(91), 182);
  assert.equal(toFmAbility(50), 100);
});

test("toFmAbility clamps to [1,200]", () => {
  assert.equal(toFmAbility(0), 1);
  assert.equal(toFmAbility(120), 200);
});

test("clamp works", () => {
  assert.equal(clamp(5, 1, 10), 5);
  assert.equal(clamp(0, 1, 10), 1);
  assert.equal(clamp(11, 1, 10), 10);
});

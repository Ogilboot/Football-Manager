import { test } from "node:test";
import assert from "node:assert/strict";
import { cyrb128, hashString, mulberry32, sampleNormal, samplePoisson } from "../src/game/rng";

test("mulberry32 is deterministic for a seed", () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 100; i++) assert.equal(a(), b());
});

test("mulberry32 returns values in [0,1)", () => {
  const rng = mulberry32(7);
  for (let i = 0; i < 1000; i++) {
    const v = rng();
    assert.ok(v >= 0 && v < 1);
  }
});

test("different seeds produce different sequences", () => {
  const a = mulberry32(1);
  const b = mulberry32(2);
  const seqA = [a(), a(), a()];
  const seqB = [b(), b(), b()];
  assert.notDeepEqual(seqA, seqB);
});

test("samplePoisson mean approximates lambda", () => {
  const rng = mulberry32(123);
  const lambda = 2.5;
  const n = 20000;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += samplePoisson(lambda, rng);
  const mean = sum / n;
  assert.ok(Math.abs(mean - lambda) < 0.15, `mean ${mean} not near ${lambda}`);
});

test("sampleNormal has mean 0 and std 1", () => {
  const rng = mulberry32(999);
  const n = 20000;
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    const v = sampleNormal(rng);
    sum += v;
    sumSq += v * v;
  }
  const mean = sum / n;
  const std = Math.sqrt(sumSq / n - mean * mean);
  assert.ok(Math.abs(mean) < 0.05, `mean ${mean}`);
  assert.ok(Math.abs(std - 1) < 0.05, `std ${std}`);
});

test("hashString is deterministic and 32-bit", () => {
  assert.equal(hashString("abc"), hashString("abc"));
  const h = hashString("some string");
  assert.ok(Number.isInteger(h) && h >= 0 && h < 2 ** 32);
});

test("hashString differs for different inputs", () => {
  assert.notEqual(hashString("player a"), hashString("player b"));
});

test("cyrb128 returns four 32-bit ints", () => {
  const [a, b, c, d] = cyrb128("seed-me");
  for (const v of [a, b, c, d]) {
    assert.ok(Number.isInteger(v) && v >= 0 && v < 2 ** 32);
  }
});

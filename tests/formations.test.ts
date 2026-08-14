import { test } from "node:test";
import assert from "node:assert/strict";
import { FORMATIONS, getFormation } from "../src/game/formations";
import { getRole } from "../src/game/roles";

test("formation ids and names are unique", () => {
  const ids = FORMATIONS.map((f) => f.id);
  const names = FORMATIONS.map((f) => f.name);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(names).size, names.length);
});

test("every formation has exactly 11 slots", () => {
  for (const f of FORMATIONS) assert.equal(f.slots.length, 11, `${f.id} has ${f.slots.length} slots`);
});

test("every formation has exactly one goalkeeper slot", () => {
  for (const f of FORMATIONS) {
    const gks = f.slots.filter((s) => getRole(s.roleId).category === "GK");
    assert.equal(gks.length, 1, `${f.id} has ${gks.length} keepers`);
  }
});

test("every formation slot references a known role and lies within the pitch", () => {
  for (const f of FORMATIONS) {
    for (const s of f.slots) {
      assert.doesNotThrow(() => getRole(s.roleId), `${f.id} role ${s.roleId}`);
      assert.ok(s.x >= 0 && s.x <= 100, `${f.id} x=${s.x}`);
      assert.ok(s.y >= 0 && s.y <= 100, `${f.id} y=${s.y}`);
    }
  }
});

test("getFormation returns the right formation and throws on unknown", () => {
  assert.equal(getFormation("4-4-2").id, "4-4-2");
  assert.throws(() => getFormation("9-9-9"));
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { roleFor, roundStatus } from "../src/domain.js";
test("roles follow exact normalized names", () => {
  assert.equal(roleFor("admin"), "admin");
  assert.equal(roleFor("Никита"), "nikita");
  assert.equal(roleFor("Admin"), "survivor");
  assert.equal(roleFor("Иван"), "survivor");
});
test("round interval is [start, end)", () => {
  const start = new Date("2026-01-01T00:00:00Z"),
    end = new Date("2026-01-01T00:01:00Z");
  assert.equal(roundStatus(start, end, new Date(+start - 1)), "scheduled");
  assert.equal(roundStatus(start, end, start), "active");
  assert.equal(roundStatus(start, end, new Date(+end - 1)), "active");
  assert.equal(roundStatus(start, end, end), "finished");
});

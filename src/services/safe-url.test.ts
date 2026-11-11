import { expect, it } from "vitest";
import { safeHttpUrl } from "./safe-url";

it.each([
  ["https://archidekt.com/u/me", "https://archidekt.com/u/me"],
  ["archidekt.com/u/me", "https://archidekt.com/u/me"],
  ["//moxfield.com/users/me", "https://moxfield.com/users/me"],
  ["  http://example.com  ", "http://example.com/"],
  ["javascript:alert(1)", ""],
  ["java\tscript:alert(1)", ""],
  ["data:text/html,hi", ""],
  ["", ""],
  [null, ""],
  ["https://", ""],
])("safeHttpUrl(%j) is %j", (raw, expected) => {
  expect(safeHttpUrl(raw)).toBe(expected);
});

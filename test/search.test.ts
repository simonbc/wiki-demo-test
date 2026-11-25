import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import search, { searchUsage } from "../src/commands/search";
import { match } from "../src/highlight";
import { writePage } from "../src/pages";

let dir: string;
let oldCwd: string;
let oldNoColor: string | undefined;
let oldIsTTY: boolean;
let log: ReturnType<typeof spyOn>;
let error: ReturnType<typeof spyOn>;

beforeEach(() => {
  oldCwd = process.cwd();
  dir = mkdtempSync(join(tmpdir(), "wiki-search-"));
  process.chdir(dir);
  oldNoColor = process.env.NO_COLOR;
  oldIsTTY = process.stdout.isTTY;
  withColor(false);
  log = spyOn(console, "log").mockImplementation(() => {});
  error = spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  log.mockRestore();
  error.mockRestore();
  if (oldNoColor === undefined) delete process.env.NO_COLOR;
  else process.env.NO_COLOR = oldNoColor;
  process.stdout.isTTY = oldIsTTY;
  process.chdir(oldCwd);
  rmSync(dir, { recursive: true, force: true });
});

function withColor(on: boolean) {
  if (on) delete process.env.NO_COLOR;
  else process.env.NO_COLOR = "1";
  process.stdout.isTTY = on;
}

const printed = () => log.mock.calls.map((c: unknown[]) => c.join(" "));
const hl = (s: string) => match(s, true);

test("prints matching pages in title order, then their matching lines with the word highlighted", () => {
  withColor(true);
  writePage("Zebra", "# Zebra\nStripes and a cat.\nNothing here.\n");
  writePage("Apple", "# Apple\nA cat sat.\nNo.\nThe cat again.\n");
  writePage("Middle", "# Middle\nDogs only.\n");
  expect(search(["cat"])).toBe(0);
  expect(printed()).toEqual([
    "Apple",
    `  A ${hl("cat")} sat.`,
    `  The ${hl("cat")} again.`,
    "Zebra",
    `  Stripes and a ${hl("cat")}.`,
  ]);
});

test("with NO_COLOR set on a terminal, prints the lines unstyled", () => {
  process.env.NO_COLOR = "1";
  process.stdout.isTTY = true;
  writePage("Home", "A cat sat.\n");
  expect(search(["cat"])).toBe(0);
  expect(printed()).toEqual(["Home", "  A cat sat."]);
});

test("when stdout isn't a terminal, prints the lines unstyled", () => {
  delete process.env.NO_COLOR;
  process.stdout.isTTY = false;
  writePage("Home", "A cat sat.\n");
  expect(search(["cat"])).toBe(0);
  expect(printed()).toEqual(["Home", "  A cat sat."]);
});

test("keeps spaces around a word as part of it", () => {
  writePage("Home", "a catapult\nthe cat sat\n");
  expect(search([" cat "])).toBe(0);
  expect(printed()).toEqual(["Home", "  the cat sat"]);
});

test("reports a page that can't be read and still searches the others", () => {
  writePage("Apple", "a cat\n");
  writePage("Zebra", "a cat\n");
  // `listPages()` lists this file, but its blank title makes `readPage()` throw.
  writeFileSync(join(dir, "pages", " .md"), "a cat\n");
  expect(search(["cat"])).toBe(1);
  expect(printed()).toEqual(["Apple", "  a cat", "Zebra", "  a cat"]);
  expect(error).toHaveBeenCalledTimes(1);
});

test("ignores case and highlights the text in its own case", () => {
  withColor(true);
  writePage("Home", "Cat and CAT and cat.\n");
  expect(search(["cAt"])).toBe(0);
  expect(printed()).toEqual(["Home", `  ${hl("Cat")} and ${hl("CAT")} and ${hl("cat")}.`]);
});

test("highlights every match in a line", () => {
  withColor(true);
  writePage("Home", "ab ab ab\n");
  expect(search(["ab"])).toBe(0);
  expect(printed()).toEqual(["Home", `  ${hl("ab")} ${hl("ab")} ${hl("ab")}`]);
});

test("joins the arguments with spaces", () => {
  writePage("Home", "foo bar\nfoo\nbar\n");
  expect(search(["foo", "bar"])).toBe(0);
  expect(printed()).toEqual(["Home", "  foo bar"]);
});

test("no matches prints a message and succeeds", () => {
  writePage("Home", "Nothing to see.\n");
  expect(search(["zzz"])).toBe(0);
  expect(printed()).toEqual(['No pages match "zzz".']);
});

test("without a pages/ folder prints the no-match message", () => {
  expect(search(["cat"])).toBe(0);
  expect(printed()).toEqual(['No pages match "cat".']);
});

test("a missing word prints the usage and fails", () => {
  expect(search([])).toBe(1);
  expect(search(["  "])).toBe(1);
  expect(error).toHaveBeenCalledWith(searchUsage);
  expect(log).not.toHaveBeenCalled();
});

test("treats regex special characters as plain text", () => {
  withColor(true);
  writePage("Home", "call f(x) here\nfxx and f-x\nprice is $5.00 or 5x00\n[a] a\n");
  expect(search(["f(x)"])).toBe(0);
  expect(search(["$5.00"])).toBe(0);
  expect(search(["[a]"])).toBe(0);
  expect(search(["a|b"])).toBe(0);
  expect(printed()).toEqual([
    "Home",
    `  call ${hl("f(x)")} here`,
    "Home",
    `  price is ${hl("$5.00")} or 5x00`,
    "Home",
    `  ${hl("[a]")} a`,
    'No pages match "a|b".',
  ]);
});

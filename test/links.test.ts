import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import links, { linksUsage } from "../src/commands/links";
import { pagesDir, writePage } from "../src/pages";

let dir: string;
let oldCwd: string;
let log: ReturnType<typeof spyOn>;
let error: ReturnType<typeof spyOn>;

beforeEach(() => {
  oldCwd = process.cwd();
  dir = mkdtempSync(join(tmpdir(), "wiki-links-"));
  process.chdir(dir);
  log = spyOn(console, "log").mockImplementation(() => {});
  error = spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  log.mockRestore();
  error.mockRestore();
  process.chdir(oldCwd);
  rmSync(dir, { recursive: true, force: true });
});

const printed = () => log.mock.calls.map((c: unknown[]) => c.join(" "));

test("prints every page that links to the page, sorted", () => {
  writePage("Target", "# Target\n");
  writePage("Zebra", "See [[Target]].\n");
  writePage("Apple", "First [[Other]], then [[ Target ]] and [[Target]] again.\n");
  writePage("Middle", "No links to it, just the word Target and [[Targets]].\n");
  writePage("Other", "[[Zebra]]\n");
  expect(links(["Target"])).toBe(0);
  expect(printed()).toEqual(["Apple", "Zebra"]);
  expect(error).not.toHaveBeenCalled();
});

test("a page that links to itself is listed", () => {
  writePage("Home", "[[Home]]\n");
  expect(links(["Home"])).toBe(0);
  expect(printed()).toEqual(["Home"]);
});

test("joins the arguments into a multi-word title", () => {
  writePage("Getting started", "");
  writePage("Home", "Read [[Getting started]].\n");
  expect(links(["Getting", "started"])).toBe(0);
  expect(printed()).toEqual(["Home"]);
});

test("a page nobody links to prints a short message and succeeds", () => {
  writePage("Lonely", "[[Elsewhere]]\n");
  expect(links(["Lonely"])).toBe(0);
  expect(printed()).toEqual(['No pages link to "Lonely".']);
});

test("an unknown page prints one line naming it and fails", () => {
  writePage("Home", "[[Nope]]\n");
  expect(links(["Nope"])).toBe(1);
  expect(error).toHaveBeenCalledTimes(1);
  expect(error.mock.calls[0]![0]).toBe('wiki links: no page named "Nope"');
  expect(log).not.toHaveBeenCalled();
});

test("an invalid title prints one line and fails", () => {
  expect(links(["../secret"])).toBe(1);
  expect(error).toHaveBeenCalledTimes(1);
  expect(log).not.toHaveBeenCalled();
});

test("a missing title prints the usage and fails", () => {
  expect(links([])).toBe(1);
  expect(error).toHaveBeenCalledWith(linksUsage);
  expect(links(["  "])).toBe(1);
  expect(log).not.toHaveBeenCalled();
});

test("a folder named like a page is not a page", () => {
  writePage("Home", "[[Folder]]\n");
  mkdirSync(join(pagesDir(), "Folder.md"));
  expect(links(["Folder"])).toBe(1);
  expect(error.mock.calls[0]![0]).toBe('wiki links: no page named "Folder"');
  expect(log).not.toHaveBeenCalled();
});

test("an unknown title with a newline still prints one line", () => {
  expect(links(["Two\nlines"])).toBe(1);
  expect(error).toHaveBeenCalledTimes(1);
  expect(error.mock.calls[0]![0]).toBe('wiki links: no page named "Two\\x0alines"');
});

test("control characters in a linking page's title are escaped", () => {
  writePage("Target", "");
  writeFileSync(join(pagesDir(), "Red\x1b[31m.md"), "[[Target]]\n");
  expect(links(["Target"])).toBe(0);
  expect(printed()).toEqual(["Red\\x1b[31m"]);
});

test("a page file that can't be read as a page is skipped", () => {
  writePage("Target", "");
  writePage("Good", "[[Target]]\n");
  writeFileSync(join(pagesDir(), "Bad\\Name.md"), "[[Target]]\n");
  mkdirSync(join(pagesDir(), "Unreadable.md"));
  expect(links(["Target"])).toBe(0);
  expect(printed()).toEqual(["Bad\\Name", "Good"]);
});

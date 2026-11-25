import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkTitle, listPages, pagesDir, parseLinks } from "../pages";

export const linksUsage = "Usage: wiki links <title>";

/**
 * Makes a title safe to print on one line: control characters, such as
 * newlines and the escape that starts a terminal color, are shown as `\xNN`.
 */
export function printable(title: string): string {
  return title.replace(/[\x00-\x1f\x7f-\x9f]/g, (c) => `\\x${c.charCodeAt(0).toString(16).padStart(2, "0")}`);
}

/** A page's text, or undefined if its file can't be read. */
function readPageFile(title: string): string | undefined {
  try {
    return readFileSync(join(pagesDir(), `${title}.md`), "utf8");
  } catch {
    return undefined;
  }
}

/**
 * `wiki links <title>`: prints the title of every page that contains a
 * `[[link]]` to the page, one per line, sorted. A page that links to itself
 * is listed too, and a page whose file can't be read is skipped. The
 * arguments are joined with spaces, so `wiki links Getting started` works
 * without quotes. Returns the exit code.
 */
export default function links(args: string[]): number {
  const title = args.join(" ").trim();
  if (title === "") {
    console.error(linksUsage);
    return 1;
  }

  try {
    checkTitle(title);
  } catch (err) {
    console.error(`wiki links: ${printable(err instanceof Error ? err.message : String(err))}`);
    return 1;
  }

  // listPages() holds only page files, sorted, so a folder named like a page
  // doesn't count as one.
  const pages = listPages();
  if (!pages.includes(title)) {
    console.error(`wiki links: no page named "${printable(title)}"`);
    return 1;
  }

  const linking = pages.filter((page) => parseLinks(readPageFile(page) ?? "").includes(title));
  if (linking.length === 0) {
    console.log(`No pages link to "${printable(title)}".`);
    return 0;
  }
  for (const page of linking) console.log(printable(page));
  return 0;
}

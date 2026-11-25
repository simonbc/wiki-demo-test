import { listPages, pageExists, parseLinks, readPage } from "../pages";

export const linksUsage = "Usage: wiki links <title>";

/**
 * `wiki links <title>`: prints the title of every page that contains a
 * `[[link]]` to the page, one per line, sorted. A page that links to itself
 * is listed too. The arguments are joined with spaces, so
 * `wiki links Getting started` works without quotes. Returns the exit code.
 */
export default function links(args: string[]): number {
  const title = args.join(" ").trim();
  if (title === "") {
    console.error(linksUsage);
    return 1;
  }

  try {
    if (!pageExists(title)) {
      console.error(`wiki links: no page named "${title}"`);
      return 1;
    }
  } catch (err) {
    console.error(`wiki links: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }

  // listPages() is already sorted.
  const linking = listPages().filter((page) => parseLinks(readPage(page)).includes(title));
  if (linking.length === 0) {
    console.log(`No pages link to "${title}".`);
    return 0;
  }
  for (const page of linking) console.log(page);
  return 0;
}

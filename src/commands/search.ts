import { match } from "../highlight";
import { listPages, readPage } from "../pages";

export const searchUsage = "Usage: wiki search <word>";

/** A regular expression that finds `word` as plain text, ignoring case. */
function wordPattern(word: string): RegExp {
  // Escape only the syntax characters: with the `u` flag, other escapes are errors.
  const escaped = word.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  return new RegExp(escaped, "giu");
}

/**
 * `wiki search <word>`: for each page that contains the word, prints the page
 * title, then each line that contains it, indented, with every occurrence
 * highlighted in the page's own case. Matching ignores case and treats the
 * word as plain text. Pages are in title order, lines in file order. The
 * arguments are joined with spaces, so `wiki search foo bar` searches for
 * "foo bar". Returns the exit code: 0 even when no page matches.
 */
export default function search(args: string[]): number {
  const word = args.join(" ").trim();
  if (word === "") {
    console.error(searchUsage);
    return 1;
  }

  const pattern = wordPattern(word);
  let found = false;
  for (const title of listPages()) {
    const lines = readPage(title)
      .split(/\r?\n/)
      .filter((line) => {
        pattern.lastIndex = 0;
        return pattern.test(line);
      });
    if (lines.length === 0) continue;
    found = true;
    console.log(title);
    for (const line of lines) console.log(`  ${line.replace(pattern, (m) => match(m))}`);
  }

  if (!found) console.log(`No pages match "${word}".`);
  return 0;
}

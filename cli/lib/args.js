/**
 * args.js — tiny hand-rolled argument parser (no dependencies).
 *
 * Shape: parseArgs(argv) →
 *   {
 *     path: ["models", "register"],   // positional command words, in order
 *     positionals: ["file.json"],      // non-flag args after the command words
 *     options: { api: "...", json: true, keypair: "..." },
 *   }
 *
 * Rules:
 * - `--flag value`, `--flag=value`, and boolean `--flag` are supported.
 * - The first two positional words form the command path (e.g. `submit text`,
 *   `models register`); any later positionals are command arguments.
 *   Single-word commands (login, balance, …) simply use path[0].
 * - Parsing stops at `--` (everything after is positional).
 */

const TWO_WORD_COMMANDS = new Set(["submit", "models"]);
const BOOLEAN_FLAGS = new Set(["json", "help", "version"]);

export function parseArgs(argv) {
  const options = {};
  const words = [];
  let literal = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (literal) {
      words.push(a);
      continue;
    }
    if (a === "--") {
      literal = true;
      continue;
    }
    if (a === "-h") {
      options.help = true;
      continue;
    }
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq !== -1) {
        options[a.slice(2, eq)] = a.slice(eq + 1);
      } else if (BOOLEAN_FLAGS.has(a.slice(2))) {
        options[a.slice(2)] = true;
      } else {
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith("--")) {
          options[a.slice(2)] = next;
          i++;
        } else {
          options[a.slice(2)] = true;
        }
      }
      continue;
    }
    words.push(a);
  }

  let path = [];
  let positionals = words;
  if (words.length > 0) {
    if (TWO_WORD_COMMANDS.has(words[0]) && words.length > 1) {
      path = [words[0], words[1]];
      positionals = words.slice(2);
    } else {
      path = [words[0]];
      positionals = words.slice(1);
    }
  }

  return { path, positionals, options };
}

/** Read a string option, falling back to a default when absent/boolean. */
export function optStr(options, name, fallback = undefined) {
  const v = options[name];
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

// Replaces the CARD_DB_COMPRESSED_B64 line in index.html with a freshly
// built value, leaving every other byte of the file untouched. Matched by
// its declaration prefix rather than a hardcoded line number, so this
// stays correct even if unrelated edits shift where the line falls.
//
// Optional 4th argument: a function-tags JSON file (from fetch-function-tags.mjs).
// If given and it looks sane, the `const IX_TAGS_JSON = {...};` line is refreshed too.
// If it is missing or looks wrong, the old tag line is kept and a warning is printed.
import { readFileSync, writeFileSync, existsSync } from 'fs';

const [, , indexHtmlPath, newB64Path, outPath, tagsPath] = process.argv;
if (!indexHtmlPath || !newB64Path) {
  console.error('Usage: node splice-card-db.mjs <index.html> <new-b64-file> [output-path] [function-tags.json]');
  process.exit(1);
}

const html = readFileSync(indexHtmlPath, 'utf8');
const newB64 = readFileSync(newB64Path, 'utf8').trim();

const PREFIX = 'const CARD_DB_COMPRESSED_B64 = "';
const startIdx = html.indexOf(PREFIX);
if (startIdx === -1) throw new Error('Could not find CARD_DB_COMPRESSED_B64 declaration -- aborting rather than guessing.');
const valueStart = startIdx + PREFIX.length;
const endIdx = html.indexOf('";', valueStart);
if (endIdx === -1) throw new Error('Could not find the closing quote for CARD_DB_COMPRESSED_B64 -- aborting rather than guessing.');

const before = html.slice(0, valueStart);
const after = html.slice(endIdx); // includes the closing ";
let spliced = before + newB64 + after;

// ---- optional: function tags -------------------------------------------------
if (tagsPath) {
  const TAG_PREFIX = 'const IX_TAGS_JSON = ';
  const MINIMUMS = { 'blink': 50, 'extra-combat': 10 };       // sanity floors: a near-empty result means the fetch went wrong
  try {
    if (!existsSync(tagsPath)) throw new Error('tags file not found');
    const tags = JSON.parse(readFileSync(tagsPath, 'utf8'));
    for (const [k, min] of Object.entries(MINIMUMS)) {
      if (!Array.isArray(tags[k]) || tags[k].length < min) throw new Error('tag "' + k + '" has ' + (tags[k] ? tags[k].length : 0) + ' cards (expected at least ' + min + ')');
    }
    const ti = spliced.indexOf(TAG_PREFIX);
    if (ti === -1) throw new Error('IX_TAGS_JSON line not found in index.html');
    const te = spliced.indexOf('\n', ti);
    spliced = spliced.slice(0, ti) + TAG_PREFIX + JSON.stringify(tags) + ';' + spliced.slice(te);
    console.log('Function tags refreshed:', Object.entries(tags).map(([k, v]) => k + '=' + v.length).join(', '));
  } catch (e) {
    console.warn('WARNING: function tags NOT refreshed (' + e.message + '). Keeping the previous tag lists.');
  }
}

writeFileSync(outPath || indexHtmlPath, spliced, 'utf8');
console.log('Spliced. Old value length:', endIdx - valueStart, 'New value length:', newB64.length);
console.log('Total file size change:', spliced.length - html.length, 'bytes');

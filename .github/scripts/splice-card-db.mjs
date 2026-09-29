// Replaces the CARD_DB_COMPRESSED_B64 line in index.html with a freshly
// built value, leaving every other byte of the file untouched. Matched by
// its declaration prefix rather than a hardcoded line number, so this
// stays correct even if unrelated edits shift where the line falls.
import { readFileSync, writeFileSync } from 'fs';

const [, , indexHtmlPath, newB64Path, outPath] = process.argv;
if (!indexHtmlPath || !newB64Path) {
  console.error('Usage: node splice-card-db.mjs <index.html> <new-b64-file> [output-path]');
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
const spliced = before + newB64 + after;

writeFileSync(outPath || indexHtmlPath, spliced, 'utf8');
console.log('Spliced. Old value length:', endIdx - valueStart, 'New value length:', newB64.length);
console.log('Total file size change:', spliced.length - html.length, 'bytes');

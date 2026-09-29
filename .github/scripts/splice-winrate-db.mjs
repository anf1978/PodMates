// Replaces the COMMANDER_TIER_DATA declaration in index.html with a freshly
// built value, leaving every other byte of the file untouched. Matched by
// its declaration prefix rather than a hardcoded line number. Unlike the
// card database (a compressed, base64 string ending in "), this is a plain
// JS array literal ending in ]; -- the new build script already writes its
// output as a complete "const COMMANDER_TIER_DATA = [...];" statement, so
// this just needs to find and replace that whole statement.
import { readFileSync, writeFileSync } from 'fs';

const [, , indexHtmlPath, newDataPath, outPath] = process.argv;
if (!indexHtmlPath || !newDataPath) {
  console.error('Usage: node splice-winrate-db.mjs <index.html> <new-data-file> [output-path]');
  process.exit(1);
}

const html = readFileSync(indexHtmlPath, 'utf8');
const newStatement = readFileSync(newDataPath, 'utf8').trim();

const PREFIX = 'const COMMANDER_TIER_DATA = [';
const startIdx = html.indexOf(PREFIX);
if (startIdx === -1) throw new Error('Could not find COMMANDER_TIER_DATA declaration -- aborting rather than guessing.');
const endIdx = html.indexOf('];', startIdx) + 2; // include the closing ];
if (endIdx === 1) throw new Error('Could not find the closing ]; for COMMANDER_TIER_DATA -- aborting rather than guessing.');

const before = html.slice(0, startIdx);
const after = html.slice(endIdx);
const spliced = before + newStatement + after;

writeFileSync(outPath || indexHtmlPath, spliced, 'utf8');
console.log('Spliced. Old statement length:', endIdx - startIdx, 'New statement length:', newStatement.length);
console.log('Total file size change:', spliced.length - html.length, 'bytes');

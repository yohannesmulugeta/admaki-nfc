import { readFileSync, readdirSync, statSync } from 'node:fs';
import assert from 'node:assert/strict';
const html = readFileSync('dist/index.html', 'utf8');
const requiredSections = ['main', 'the-card', 'how-it-works', 'demo', 'questions', 'contact'];
for (const id of requiredSections) assert(html.includes(`id="${id}"`), `Missing section ${id}`);
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
assert.equal(ids.length, new Set(ids).size, 'Duplicate HTML ids');
for (const [, fragment] of html.matchAll(/href="#([^"\s]+)"/g)) assert(ids.includes(fragment), `Broken fragment ${fragment}`);
for (const [, path] of html.matchAll(/(?:href|src)="(\/(?!\/)[^"?#]+)"/g)) assert(statSync(`dist${path}`).isFile(), `Missing local asset ${path}`);
assert(!/\b(?:ETB|USD|birr)\b|\$\s*\d/i.test(html), 'No prices should be published');
assert(html.includes('https://wa.me/251937928215'), 'Missing real contact route');
assert(readFileSync('dist/_headers', 'utf8').includes("script-src 'self'"));
let bytes=0;
function count(dir){for(const name of readdirSync(dir)){const path=`${dir}/${name}`;const stat=statSync(path);if(stat.isDirectory())count(path);else bytes+=stat.size;}}
count('dist');
assert(bytes<600000, `Static payload unexpectedly large: ${bytes}`);
console.log(`Build verified: ${requiredSections.length} sections, local assets and navigation intact, no prices. Total files: ${bytes.toLocaleString()} bytes.`);

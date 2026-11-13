import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';

const approvedRoutes = ['kkgt/01', 'kkgt/02', 'maison-debrah', 'maison-debrah/02', 'universal/01', 'universal/02'];
const cards = readdirSync('profiles').filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(`profiles/${f}`, 'utf8')));
assert.deepEqual(cards.map(p => p.slug).sort(), approvedRoutes, 'Do not rename permanent card routes: printed QR and NFC links depend on them');
const fingerprints = JSON.parse(readFileSync('profiles/templates/source-fingerprints.json', 'utf8'));
const text = html => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
function fixedCopy(html, fields) {
  let value = text(html);
  // Contact fields remain independently editable; protect the source's surrounding copy.
  const substitutions = Object.entries(fields).filter(([,v]) => typeof v === 'string').sort((a,b) => b[1].length-a[1].length);
  const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const byValue = new Map(substitutions.map(([key,v]) => [v, `{{${key}}}`]));
  return value.replace(new RegExp([...byValue.keys()].map(escapeRegex).join('|'), 'g'), match => byValue.get(match));
}
for (const p of cards) {
  const canonical = `https://nfc.admakidigital.com/${p.slug}/`;
  const html = readFileSync(`dist/${p.slug}/index.html`, 'utf8');
  assert(html.includes(`<link rel="canonical" href="${canonical}">`), 'Wrong card canonical');
  assert(html.includes(`<meta property="og:url" content="${canonical}">`), 'Wrong share metadata');
  assert(!html.includes('{{'), 'Unresolved content token');
  assert(!/<script(?![^>]*\bsrc=)/i.test(html), 'Inline script blocked by security policy');
  for (const [,path] of html.matchAll(/(?:href|src)="(\/(?!\/)[^"?#]+)"/g)) assert(statSync(`dist${path}`).size > 0, `Missing card resource: ${path}`);
  const vcf = readFileSync(`dist/${p.slug}/contact.vcf`, 'utf8');
  assert(vcf.startsWith('BEGIN:VCARD\r\nVERSION:3.0\r\n') && vcf.endsWith('END:VCARD\r\n'));
  for (const line of vcf.split('\r\n')) assert(Buffer.byteLength(line) <= 75, 'Invalid contact-file line folding');
  if (p.layout === 'source-copy') {
    assert(html.includes('<script src="/profiles/connect-share.js" defer></script>'), 'Share handler must load from ADMAKI');
    const hash = createHash('sha256').update(fixedCopy(html, p.fields)).digest('hex');
    assert.equal(hash, fingerprints[p.template], 'Existing card text changed');
    assert(html.includes(`href="/${p.slug}/contact.vcf"`), 'Contact download must belong to this card');
    assert(vcf.includes(`FN:${p.fields.name}`), 'Card and contact name mismatch');
    assert(vcf.includes(p.fields.phone), 'Contact phone mismatch');
    assert(html.includes(`tel:${p.fields.phone}`), 'Call destination mismatch');
    const unfolded = vcf.replace(/\r\n /g, '');
    const photo = unfolded.match(/PHOTO[^:]*:([^\r\n]+)/)?.[1];
    assert(photo && Buffer.from(photo, 'base64').equals(readFileSync(`public${p.fields.contactPhoto}`)), 'Contact portrait changed');
  } else {
    const unfolded = vcf.replace(/\r\n /g, '');
    assert(unfolded.includes(`NOTE:${p.companyDescription.replace(/,/g, '\\,')}`), 'Company description missing from saved-contact Note');
    assert(unfolded.includes(`item1.URL:${p.showroomUrl}`), 'Exact showroom map missing from saved contact');
    assert(unfolded.includes('item1.X-ABLabel:Showroom location'), 'Map URL must have a readable label');
    assert(!unfolded.includes('NOTE:Digital card:'), 'Note must describe the company');
    assert(unfolded.includes('ADR;TYPE=WORK:;;;Addis Ababa;;;Ethiopia'), 'Do not reintroduce an unconfirmed street address');
    const photo = unfolded.match(/PHOTO[^:]*:([^\r\n]+)/)?.[1];
    assert(photo && Buffer.from(photo, 'base64').equals(readFileSync(`public${p.contactPhoto}`)), 'Company logo missing from saved contact');
    for (const category of p.collections) assert(html.includes(`href="${category.url}"`), 'Missing product-category link');
    assert(html.includes(p.consultationUrl));
    assert(html.includes('https://www.instagram.com/maisondebrah_et/') && !html.includes('linkedin.com'));
  }
  const png = PNG.sync.read(readFileSync(`dist/${p.slug}/qr.png`));
  const qr = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  assert.equal(qr?.data, canonical, 'Printed QR must open its own permanent ADMAKI URL');
  console.log(`Verified ${p.slug}: contact, assets, content and decoded QR destination.`);
}
const share = readFileSync('dist/profiles/connect-share.js', 'utf8');
assert(share.includes('link[rel="canonical"]') && !share.includes('kkgtcoffee.com/connect/firaol'), 'Share must use the new permanent URL');
console.log('Six independent permanent cards verified.');

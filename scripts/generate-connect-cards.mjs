import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import QRCode from 'qrcode';

const origin = 'https://nfc.admakidigital.com';
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const vEscape = value => String(value).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
function render(template, values, escape) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (values[key] === undefined) throw new Error(`Missing card field: ${key}`);
    return escape(values[key]);
  });
}
function fold(line) {
  let result = '', bytes = 0;
  for (const c of line) {
    const n = Buffer.byteLength(c);
    if (bytes + n > 75) { result += '\r\n '; bytes = 1; }
    result += c; bytes += n;
  }
  return result;
}

const cards = readdirSync('profiles').filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(`profiles/${f}`, 'utf8')));
const routes = new Set();
for (const p of cards) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/.test(p.slug) || routes.has(p.slug)) throw new Error('Invalid or duplicate card route');
  routes.add(p.slug);
  const canonical = `${origin}/${p.slug}/`;
  const dir = `public/${p.slug}`;
  mkdirSync(dir, { recursive: true });
  if (p.layout === 'source-copy') {
    if (!['universal', 'kkgt'].includes(p.template)) throw new Error('Unknown source-card template');
    const values = { ...p.fields, canonical, contactUrl: `/${p.slug}/contact.vcf` };
    if (!/^\/profiles\/[a-z0-9/-]+\.(?:jpg|webp|png)$/.test(values.portrait)) throw new Error('Invalid portrait asset');
    const template = readFileSync(`profiles/templates/${p.template}.html`, 'utf8');
    writeFileSync(`${dir}/index.html`, render(template, values, esc));
    const vTemplate = readFileSync(`profiles/templates/${p.template}.vcf`, 'utf8');
    const contactPhoto = values.contactPhoto || values.portrait;
    if (!/^\/profiles\/[a-z0-9/-]+\.(?:jpg|webp|png)$/.test(contactPhoto)) throw new Error('Invalid contact-photo asset');
    values.photoBase64 = readFileSync(`public${contactPhoto}`).toString('base64');
    const vCard = render(vTemplate, values, (v) => vEscape(v));
    writeFileSync(`${dir}/contact.vcf`, vCard.trimEnd().split(/\r?\n/).map(fold).join('\r\n') + '\r\n');
  }
  const color = p.qrColor || '#17573e';
  const options = { errorCorrectionLevel: 'M', margin: 4, color: { dark: color, light: '#ffffff' } };
  await QRCode.toFile(`${dir}/qr.svg`, canonical, { ...options, type: 'svg', width: 512 });
  await QRCode.toFile(`${dir}/qr.png`, canonical, { ...options, width: 1024 });
  console.log(`Permanent card ready: ${canonical}`);
}

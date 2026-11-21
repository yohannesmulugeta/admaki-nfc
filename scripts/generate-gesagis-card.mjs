import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import QRCode from 'qrcode';

const p = JSON.parse(readFileSync('profiles/gesagis-yeabtsega.json', 'utf8'));
if (p.layout !== 'gesagis' || p.slug !== 'gesagis/yeabtsega') throw new Error('Unexpected GESAGIS card route');
const origin = 'https://nfc.admakidigital.com';
const canonical = origin + '/' + p.slug + '/';
const dir = 'public/' + p.slug;
const assetDir = 'public/profiles/gesagis';
mkdirSync(dir, { recursive: true });
mkdirSync(assetDir, { recursive: true });
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const vEsc = s => String(s).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
function fold(line) {
  let out = '', bytes = 0;
  for (const c of line) {
    const len = Buffer.byteLength(c);
    if (bytes + len > 75) { out += '\r\n '; bytes = 1; }
    out += c; bytes += len;
  }
  return out;
}
function asset(name, ext) {
  const raw = readFileSync('profiles/media/gesagis-' + name + '.b64', 'utf8').trim();
  if (!/^[A-Za-z0-9+/=\s]+$/.test(raw)) throw new Error('Invalid image encoding');
  const buf = Buffer.from(raw, 'base64');
  if (name === 'portrait' && (buf.length < 2000 || buf[0] !== 255 || buf[1] !== 216 || buf.at(-2) !== 255 || buf.at(-1) !== 217)) throw new Error('Invalid JPEG portrait');
  if (name === 'logo' && (buf.length < 1000 || buf.subarray(0,4).toString() !== 'RIFF' || buf.subarray(8,12).toString() !== 'WEBP')) throw new Error('Invalid WebP logo');
  writeFileSync(assetDir + '/' + (name === 'portrait' ? 'yeabtsega' : name) + '.' + ext, buf);
  return buf;
}
const photo = asset('portrait', 'jpg');
asset('logo', 'webp');
if (p.portrait !== '/profiles/gesagis/yeabtsega.jpg' || p.logo !== '/profiles/gesagis/logo.webp') throw new Error('GESAGIS image paths changed');
if (!/^https:\/\/u\.wechat\.com\/[A-Za-z0-9_-]+\?s=2$/.test(p.wechatUrl) || p.wechatQr !== '/profiles/gesagis/wechat-qr.svg' || p.wechatQrPng !== '/profiles/gesagis/wechat-qr.png') throw new Error('Invalid WeChat profile or QR destinations');
const qrOptions = { errorCorrectionLevel: 'H', margin: 4, color: { dark: '#101712', light: '#ffffff' } };
await QRCode.toFile(assetDir + '/wechat-qr.svg', p.wechatUrl, { ...qrOptions, type: 'svg', width: 512 });
await QRCode.toFile(assetDir + '/wechat-qr.png', p.wechatUrl, { ...qrOptions, width: 1024 });
const vcf = [
  'BEGIN:VCARD', 'VERSION:3.0',
  'FN:' + vEsc(p.name),
  'N:' + vEsc(p.familyName) + ';' + vEsc(p.givenName) + ';;;',
  'ORG:' + vEsc(p.organization), 'TITLE:' + vEsc(p.role),
  'PHOTO;ENCODING=b;TYPE=JPEG:' + photo.toString('base64'),
  'TEL;TYPE=CELL,VOICE:' + p.phone,
  'TEL;TYPE=WORK,VOICE:' + p.secondaryPhone,
  'EMAIL;TYPE=WORK,INTERNET:' + p.email,
  'ADR;TYPE=WORK:;;' + vEsc('Piyasa, Addis Capital Building, 1st Floor') + ';Addis Ababa;;;Ethiopia',
  'item1.URL:' + canonical,
  'item1.X-ABLabel:Digital business card',
  'item2.URL:' + p.mapSearchUrl,
  'item2.X-ABLabel:Office location (address search)',
  'item3.URL:' + p.wechatUrl,
  'item3.X-ABLabel:WeChat contact',
  'NOTE:' + vEsc(p.companyDescription),
  'END:VCARD'
].map(fold).join('\r\n') + '\r\n';
writeFileSync(dir + '/contact.vcf', vcf);
writeFileSync(dir + '/yeabtsega-iphone.vcf', vcf);
const services = p.services.map(s => '<article class="service"><b>' + esc(s.name) + '</b><p>' + esc(s.description) + '</p></article>').join('');
const template = readFileSync('profiles/templates/gesagis.html', 'utf8');
const values = { ...p, canonical, servicesHtml: services, contactUrl: '/' + p.slug + '/contact.vcf', qrUrl: '/' + p.slug + '/qr.svg', qrPngUrl: '/' + p.slug + '/qr.png' };
const html = template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
  if (!(key in values)) throw new Error('Missing GESAGIS field: ' + key);
  return key === 'servicesHtml' ? services : esc(values[key]);
});
if (html.includes('{{')) throw new Error('Unreplaced GESAGIS template token');
writeFileSync(dir + '/index.html', html);
console.log('Generated GESAGIS card and photo-backed vCards at ' + canonical);

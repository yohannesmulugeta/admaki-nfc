import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';

const approvedRoutes = ['admaki', 'gesagis/yeabtsega', 'kkgt/01', 'kkgt/02', 'maison-debrah', 'maison-debrah/02', 'maison-debrah/03', 'maison-debrah/04', 'shasho-kelbesa/ebise', 'universal/01', 'universal/02'];
const cards = readdirSync('profiles').filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(`profiles/${f}`, 'utf8')));
for(const route of approvedRoutes)assert(cards.some(p=>p.slug===route),'Do not remove permanent card route '+route);
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
  } else if (p.layout === 'admaki') {
    const unfolded = vcf.replace(/\r\n /g, '');
    assert(unfolded.includes(`TEL;TYPE=WORK,VOICE:${p.phone}`), 'ADMAKI contact phone mismatch');
    assert(unfolded.includes(`URL:${p.website}`), 'ADMAKI website missing from contact');
    assert(unfolded.includes(`item1.URL:${canonical}`), 'ADMAKI card missing from saved contact');
    assert(unfolded.includes(`EMAIL;TYPE=WORK,INTERNET:${p.email}`));
    assert(unfolded.includes(`EMAIL;TYPE=WORK,INTERNET:${p.personalEmail}`));
    const photo = unfolded.match(/PHOTO[^:]*:([^\r\n]+)/)?.[1];
    assert(photo && Buffer.from(photo, 'base64').equals(readFileSync(`public${p.contactPhoto}`)), 'ADMAKI contact logo mismatch');
    assert(html.includes(`tel:${p.phone}`) && html.includes(`https://wa.me/${p.whatsapp}`));
    assert.equal(p.services.length, 5, 'Keep the five verified website services');
    for (const service of p.services) assert(html.includes(`href="${service.url}"`), 'Missing service destination');
    assert(html.includes('data-card-url="'+canonical+'"'), 'ADMAKI share must use its permanent profile');
  } else if(p.theme==='business'){assert(html.includes(p.name)&&html.includes(p.phone),'Card identity mismatch');
  } else if (p.layout === 'gesagis') {
    assert.equal(p.slug, 'gesagis/yeabtsega', 'GESAGIS card URL must remain stable');
    assert(html.includes('<script src="/profiles/profile.js" defer></script>'), 'GESAGIS share handler missing');
    assert(html.includes('<h1 id="profile-name">'+p.name+'</h1>'), 'GESAGIS identity mismatch');
    assert(html.includes('src="'+p.portrait+'"') && html.includes('src="'+p.logo+'"'), 'GESAGIS approved images missing');
    assert(html.includes('tel:'+p.phone) && html.includes('tel:'+p.secondaryPhone), 'GESAGIS telephone buttons mismatch');
    assert(html.includes('https://wa.me/'+p.whatsapp), 'GESAGIS WhatsApp link missing');
    assert(html.includes('mailto:'+p.email), 'GESAGIS email link missing');
    assert(html.includes('href="'+p.mapSearchUrl.replaceAll('&','&amp;')+'"'), 'GESAGIS office directions missing');
    assert(html.includes('data-card-url="'+canonical+'"'), 'GESAGIS share URL mismatch');
    assert(html.includes('href="/'+p.slug+'/contact.vcf"'), 'GESAGIS contact link missing');
    assert(html.includes('href="/'+p.slug+'/qr.png"'), 'GESAGIS QR download missing');
    assert.equal(p.phone, '+251902988591', 'GESAGIS confirmed primary phone changed');
    assert.equal(p.secondaryPhone, '+251927179289', 'GESAGIS confirmed secondary phone changed');
    assert.equal(p.whatsapp, '251902988591', 'GESAGIS WhatsApp must use primary phone');
    assert.equal(p.wechatUrl, 'https://u.wechat.com/kIWh28U1emI-syvsXO_nhBg?s=2', 'GESAGIS supplied WeChat URL changed');
    assert(html.includes('href="'+p.wechatUrl.replaceAll('&','&amp;')+'"'), 'WeChat contact destination missing from page');
    assert(html.includes('src="'+p.wechatQr+'"'), 'WeChat QR asset missing from page');
    assert(html.includes('data-open-wechat') && html.includes('id="wechat-dialog"'), 'WeChat modal trigger or target missing');
    assert(html.includes('<script src="/profiles/gesagis/wechat.js" defer></script>'), 'GESAGIS WeChat dialog script missing');
    assert(html.includes('href="'+p.wechatQrPng+'"'), 'WeChat QR download missing');
    assert(statSync('dist'+p.wechatQr).size > 500, 'WeChat SVG QR missing');
    const wechatPng = PNG.sync.read(readFileSync('dist'+p.wechatQrPng));
    const wechatQr = jsQR(new Uint8ClampedArray(wechatPng.data), wechatPng.width, wechatPng.height);
    assert.equal(wechatQr?.data, p.wechatUrl, 'WeChat QR must scan to the supplied contact, never the business-card URL');
    const wechatScript = readFileSync('dist/profiles/gesagis/wechat.js', 'utf8');
    assert(wechatScript.includes('wechat-dialog') && wechatScript.includes('showModal()'), 'WeChat modal script missing');

    assert(html.includes('class="section contact-section"') && html.includes('class="contact-details"'), 'GESAGIS premium contact layout missing');
    assert((html.match(/class="contact-glyph"/g) || []).length === 4, 'GESAGIS contact icons missing or duplicated');
    assert(html.includes('class="map-call"') && html.includes('Get Directions'), 'GESAGIS full-width map action missing');
    assert(html.includes('class="share-actions"') && html.includes('Show QR') && html.includes('Share Card'), 'GESAGIS sharing controls missing');
    assert(!html.includes('class="contact-glyph">☎'), 'Old GESAGIS icon layout reintroduced');
    const gesagisStyles = readFileSync('dist/profiles/gesagis/card.css', 'utf8');
    assert(gesagisStyles.includes('.contact-row .contact-glyph') && gesagisStyles.includes('flex: 0 0 44px'), 'GESAGIS contact icon alignment regression');
    assert(gesagisStyles.includes('grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)'), 'GESAGIS share buttons not responsive');

    for (const service of p.services) assert(html.includes(service.name.replaceAll('&','&amp;')), 'GESAGIS service missing');
    const unfolded = vcf.replace(/\r\n /g, '');
    assert(unfolded.includes('FN:'+p.name) && unfolded.includes('ORG:'+p.organization), 'GESAGIS contact identity mismatch');
    assert(unfolded.includes('TITLE:'+p.role), 'GESAGIS job title missing from saved contact');
    assert(unfolded.includes('TEL;TYPE=CELL,VOICE:'+p.phone), 'GESAGIS primary telephone mismatch');
    assert(unfolded.includes('TEL;TYPE=WORK,VOICE:'+p.secondaryPhone), 'GESAGIS second telephone missing');
    assert(unfolded.includes('EMAIL;TYPE=WORK,INTERNET:'+p.email), 'GESAGIS saved email missing');
    assert(unfolded.includes('item1.URL:'+canonical), 'GESAGIS saved contact URL mismatch');
    assert(unfolded.includes('item2.URL:'+p.mapSearchUrl), 'GESAGIS directions missing from contact');
    assert(unfolded.includes('item3.URL:'+p.wechatUrl), 'GESAGIS WeChat link missing from saved contact');
    assert(unfolded.includes('Addis Capital Building'), 'GESAGIS approved address missing');
    const encoded = unfolded.match(/PHOTO;ENCODING=b;TYPE=JPEG:([A-Za-z0-9+/=]+)/)?.[1];
    assert(encoded, 'GESAGIS vCard photo missing');
    const decoded = Buffer.from(encoded, 'base64');
    assert(decoded.length > 2000 && decoded[0] === 255 && decoded[1] === 216, 'GESAGIS portrait invalid');
    assert(decoded.equals(readFileSync('public'+p.portrait)), 'GESAGIS saved-contact portrait differs from card');
    assert(statSync('dist'+p.logo).size > 1000, 'GESAGIS original logo missing from build');
    assert(readFileSync('dist/'+p.slug+'/yeabtsega-iphone.vcf','utf8') === vcf, 'GESAGIS iPhone contact mismatch');
  } else if (p.layout === 'static') {
    // Protect the new independent permanent branded card.
    assert.equal(p.slug, 'shasho-kelbesa/ebise', 'Unexpected static card');
    assert(html.includes('<script src="/profiles/profile.js" defer></script>'), 'Share handler missing');
    assert(html.includes('<h1>'+p.name+'</h1>'), 'Profile name mismatch');
    assert(html.includes('tel:'+p.phone), 'Call destination mismatch');
    assert(html.includes('https://wa.me/'+p.whatsapp), 'WhatsApp destination mismatch');
    assert(html.includes('mailto:'+p.email), 'Email destination mismatch');
    assert(html.includes('href="'+p.website+'"'), 'Website destination mismatch');
    assert(html.includes('data-card-url="'+canonical+'"'), 'Share destination mismatch');
    assert(html.includes('src="'+p.portrait+'"') && html.includes('src="'+p.logo+'"'), 'Required client images missing');
    const unfolded = vcf.replace(/\r\n /g, '');
    assert(unfolded.includes('FN:'+p.name), 'vCard name mismatch');
    assert(unfolded.includes('TEL;TYPE=CELL,VOICE:'+p.phone), 'vCard phone mismatch');
    assert(unfolded.includes('EMAIL;TYPE=WORK:'+p.email), 'vCard email mismatch');
    assert(unfolded.includes('ORG:'+p.organization), 'Company missing from saved contact');
    assert(html.includes('href="'+p.iosContactFile+'"'), 'Fresh iPhone contact download not linked');
    assert(readFileSync('dist'+p.iosContactFile, 'utf8') === vcf, 'Fresh and canonical contacts must match');
    assert(unfolded.indexOf('PHOTO;ENCODING=b;TYPE=JPEG:') < unfolded.indexOf('TEL;TYPE='), 'Portrait must precede phone');
    assert(unfolded.includes('URL:'+p.website), 'Website missing from saved contact');
    assert(p.contactPhoto, 'Contact photograph is required');
    const photo = unfolded.match(/PHOTO;ENCODING=b;TYPE=JPEG:([A-Za-z0-9+/=]+)/)?.[1];
    assert(photo, 'Ebise saved contact must embed a photo');
    const bytes = Buffer.from(photo, 'base64');
    assert(bytes.length > 3000 && bytes[0] === 255 && bytes[1] === 216 && bytes.at(-2) === 255 && bytes.at(-1) === 217, 'Contact photo not a valid JPEG');
    assert(bytes.equals(readFileSync('public'+p.contactPhoto)), 'Contact portrait does not match source photo');
    assert(statSync('dist'+p.contactPhoto).size === bytes.length, 'Published contact JPEG missing');
    assert(unfolded.includes('item1.URL:'+canonical), 'vCard digital-card link mismatch');
    assert(html.includes('href="'+p.mapSearchUrl.replaceAll('&','&amp;')+'"'), 'Map link missing from card');
    assert(unfolded.includes('item2.URL:'+p.mapSearchUrl), 'Map link missing from contact');
    assert(unfolded.includes('Beal Building'), 'Office address missing');
    assert(html.includes('8–10 tonnes per hour'), 'Plant capacity missing');
    assert(html.includes('WHAT WE DO') && html.includes('VISIT OUR OFFICE'), 'Business or office content missing');
    assert(html.includes('class="machine-panel"') && html.includes('class="machine-graphic"'), 'Premium machine feature missing');
    assert(html.includes('src="/profiles/shasho/cleaning-plant.jpg"'), 'Company machinery photo missing from card');
    assert(statSync('dist/profiles/shasho/cleaning-plant.jpg').size > 10000, 'Company machinery photo not published');
    assert(html.includes('class="service export"') && html.includes('class="service import"'), 'Export/import showcases missing');
    assert(html.includes('class="hero"') && html.includes('class="social-row"'), 'Premium hero/social sections missing');
    assert(!html.includes('class="contact-list"'), 'Duplicated contact list reintroduced');
    for (const [index,s] of p.social.entries()) {
      assert(html.includes('href="'+s.url.replaceAll('&','&amp;')+'"'), s.name+' missing on card');
      assert(unfolded.includes('item'+(index+3)+'.URL:'+s.url), s.name+' missing in saved contact');
    }
  } else {
    const unfolded = vcf.replace(/\r\n /g, '');
    assert(unfolded.includes(`NOTE:${p.companyDescription.replace(/,/g, '\\,')}`), 'Company description missing from saved-contact Note');
    assert(unfolded.includes(`item1.URL:${p.showroomUrl}`), 'Exact showroom map missing from saved contact');
    assert(unfolded.includes('item1.X-ABLabel:Showroom location'), 'Map URL must have a readable label');
    assert(!unfolded.includes('NOTE:Digital card:'), 'Note must describe the company');
    assert(unfolded.includes('ADR;TYPE=WORK:;;;Addis Ababa;;;Ethiopia'), 'Do not reintroduce an unconfirmed street address');
    for (const [index, social] of p.social.entries()) {
      assert(unfolded.includes(`item${index + 2}.URL:${social.url}`), 'Social link missing from saved contact');
      assert(unfolded.includes(`item${index + 2}.X-ABLabel:${social.name}`), 'Social link label missing');
    }
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
console.log(`${cards.length} independent permanent cards verified.`);

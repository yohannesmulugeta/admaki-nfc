import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import QRCode from 'qrcode';

const origin = 'https://nfc.admakidigital.com';
const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const paths = {
  arrow: '<path d="M7 17 17 7M7 7h10v10"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z"/>',
  whatsapp: '<path d="M21 11.5a9 9 0 0 1-13.4 7.8L3 21l1.6-4.7A9 9 0 1 1 21 11.5Z"/><path d="M8 7.5c-.8 2.9 2 6.9 5.5 7.7 1 .3 2-.5 2-1.2l-2-1.1-.9.7c-1.4-.6-2.7-1.9-3.2-3.3l.7-.8-1-2Z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  save: '<path d="M12 3v12m-5-5 5 5 5-5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4m-6.8 7 6.8 4"/>',
  qr: '<path d="M3 3h6v6H3zm12 0h6v6h-6zM3 15h6v6H3zm12 0h3v3h3v3h-6zm6-3v3m-9-3v3m0 3v3"/>',
  book: '<path d="M12 5C9 3 5 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Zm0 0v15"/>',
  globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>',
  linkedin: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 10v7m0-10h.01M11 17v-7m0 3a3 3 0 0 1 6 0v4"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>'
};
const icon = (name) => `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.arrow}</svg>`;
const vEscape = (s) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
// RFC 2425 folds at 75 octets; preserve complete UTF-8 code points.
function fold(line) {
  let result = '', bytes = 0;
  for (const ch of line) {
    const n = Buffer.byteLength(ch);
    if (bytes + n > 75) { result += '\r\n '; bytes = 1; }
    result += ch; bytes += n;
  }
  return result;
}

for (const file of readdirSync('profiles').filter((name) => name.endsWith('.json'))) {
  const p = JSON.parse(readFileSync(`profiles/${file}`, 'utf8'));
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug)) throw new Error('Invalid profile slug');
  if (p.theme !== 'maison') throw new Error('Unknown profile theme');
  const canonical = `${origin}/${p.slug}/`;
  const dir = `public/${p.slug}`;
  mkdirSync(dir, { recursive: true });
  const contactUrl = `/${p.slug}/contact.vcf`;
  const qrUrl = `/${p.slug}/qr.svg`;
  const external = 'target="_blank" rel="noopener noreferrer"';
  const row = (name, sub, url, glyph, attrs = '') => `<a class="detail-link" href="${esc(url)}" ${attrs}><span class="icon-box">${icon(glyph)}</span><span><strong>${esc(name)}</strong><small>${esc(sub)}</small></span>${icon('arrow')}</a>`;
  const social = p.social.map((s) => `<a class="social-link" href="${esc(s.url)}" ${external}>${icon(s.icon)}<span>${esc(s.name)}</span>${icon('arrow')}</a>`).join('');
  writeFileSync(`${dir}/contact.vcf`, [
    'BEGIN:VCARD', 'VERSION:3.0', `FN:${vEscape(p.name)}`, `N:${vEscape(p.name)};;;;`,
    `ORG:${vEscape(p.organization)}`, `TEL;TYPE=WORK,VOICE:${p.phone}`,
    `EMAIL;TYPE=WORK,INTERNET:${p.email}`, `EMAIL;TYPE=WORK,INTERNET:${p.salesEmail}`,
    'ADR;TYPE=WORK:;;Namibia Street\\, Bole Sub-City;Addis Ababa;;;Ethiopia',
    `URL:${p.website}`, `NOTE:${vEscape(`Digital card: ${canonical}`)}`, 'END:VCARD', ''
  ].map(fold).join('\r\n'));
  await QRCode.toFile(`${dir}/qr.svg`, canonical, { type: 'svg', errorCorrectionLevel: 'M', margin: 4, color: { dark: '#17573e', light: '#ffffff' }, width: 512 });
  writeFileSync(`${dir}/index.html`, `<!doctype html>
<html lang="en" data-theme="${esc(p.theme)}">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#17573e"><meta name="robots" content="noindex,follow">
  <title>${esc(p.name)} | Digital Card</title>
  <meta name="description" content="Connect with Maison Debrah Ethiopia. Save our contact, call, WhatsApp, explore the catalogue or visit our Addis Ababa showroom.">
  <link rel="canonical" href="${canonical}"><link rel="icon" href="${esc(p.logo)}" type="image/svg+xml">
  <meta property="og:title" content="${esc(p.name)} | Addis Ababa Showroom"><meta property="og:type" content="website">
  <meta property="og:description" content="Furniture, lighting & decoration. All our contact details in one place.">
  <meta property="og:url" content="${canonical}"><meta property="og:image" content="${origin}${p.cover}"><meta property="og:image:alt" content="${esc(p.coverAlt)}">
  <link rel="preload" as="image" href="${esc(p.cover)}"><link rel="stylesheet" href="/profiles/profile.css">
  <script src="/profiles/profile.js" defer></script>
</head>
<body>
<a class="skip-link" href="#contact">Skip to contact details</a>
<main class="card">
  <header class="intro">
    <div class="cover"><img src="${esc(p.cover)}" alt="${esc(p.coverAlt)}" width="640" height="374" fetchpriority="high"><span class="cover-label">THE WORLD OF MAISON DEBRAH</span><button class="qr-trigger" type="button" data-open-qr aria-label="Show this card’s QR code">${icon('qr')}</button></div>
    <div class="identity"><div class="brand-badge"><img src="${esc(p.logo)}" alt="Maison Debrah logo" width="224" height="62"></div>
      <p class="eyebrow">${esc(p.eyebrow)}</p><h1>${esc(p.name)}</h1>
      <p class="intro-copy">${esc(p.description)}</p>
    </div>
  </header>
  <div class="card-body" id="contact">
    <a class="save-contact" href="${contactUrl}" download="maison-debrah.vcf">${icon('save')}<span>Save contact</span></a>
    <p class="save-hint">Keep our showroom one tap away.</p>
    <div class="quick-actions" aria-label="Quick contact">
      <a href="tel:${esc(p.phone)}">${icon('phone')}<span>Call</span></a>
      <a href="https://wa.me/${esc(p.whatsapp)}" ${external}>${icon('whatsapp')}<span>WhatsApp</span></a>
      <a href="mailto:${esc(p.email)}">${icon('mail')}<span>Email</span></a>
    </div>
    <section class="contact-section" aria-labelledby="reach-title"><h2 id="reach-title">LET’S CONNECT</h2>
      <div class="detail-list">
        ${row('Speak with us', p.phoneLabel, `tel:${p.phone}`, 'phone')}
        ${row('General enquiries', p.email, `mailto:${p.email}`, 'mail')}
        ${row('Sales enquiries', p.salesEmail, `mailto:${p.salesEmail}`, 'mail')}
        ${row('Visit our showroom', p.address, p.showroomUrl, 'pin', external)}
      </div>
      <details class="hours"><summary>Showroom opening hours</summary><ul>${p.hours.map((h) => `<li>${esc(h)}</li>`).join('')}</ul></details>
    </section>
    <section class="explore-section" aria-labelledby="explore-title"><h2 id="explore-title">EXPLORE MAISON DEBRAH</h2>
      <a class="collection-feature" href="${esc(p.collectionUrl)}" ${external}><img src="${esc(p.interior)}" alt="${esc(p.interiorAlt)}" width="640" height="374" loading="lazy"><span><small>CONSIDERED FOR YOUR SPACE</small><strong>Find your inspiration.</strong><b>Explore our furniture ${icon('arrow')}</b></span></a>
      <div class="detail-list explore-links">${row('View our catalogue', 'Discover the collection', p.catalogue, 'book', external)}${row('Visit our website', 'maisondebrah-et.com', p.website, 'globe', external)}</div>
    </section>
    <nav class="social-links" aria-label="Maison Debrah social profiles">${social}</nav>
    <div class="share-actions"><button class="share-button" type="button" data-share data-card-url="${canonical}" data-card-name="${esc(p.name)}">${icon('share')}<span>Share this card</span></button><button class="qr-link" type="button" data-open-qr>${icon('qr')}<span>QR code</span></button></div>
    <p class="feedback" role="status" aria-live="polite"></p>
    <div class="copy-fallback" hidden><label for="card-url">Copy this card’s link</label><input id="card-url" readonly value="${canonical}"></div>
    <footer><span>Thoughtfully connected.</span><a href="https://nfc.admakidigital.com/">Digital card by <strong>ADMAKI</strong>${icon('arrow')}</a></footer>
  </div>
</main>
<dialog id="qr-dialog" aria-labelledby="qr-title"><form method="dialog"><button class="dialog-close" aria-label="Close QR code">${icon('close')}</button></form><p class="eyebrow">SCAN TO CONNECT</p><h2 id="qr-title">${esc(p.name)}</h2><img class="qr-image" src="${qrUrl}" alt="QR code for ${esc(p.name)}’s digital card" width="256" height="256"><p class="qr-caption">Open this digital card on another phone.</p><a class="save-contact" href="${qrUrl}" download="maison-debrah-qr.svg">${icon('save')}<span>Download QR code</span></a></dialog>
</body></html>\n`);
  console.log(`Generated ${p.slug}: card, vCard and QR code.`);
}

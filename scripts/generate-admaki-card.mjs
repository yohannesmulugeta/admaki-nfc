import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import QRCode from 'qrcode';

const p = JSON.parse(readFileSync('profiles/admaki.json', 'utf8'));
const canonical = `https://nfc.admakidigital.com/${p.slug}/`;
const dir = `public/${p.slug}`;
mkdirSync(dir, { recursive: true });
const e = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const paths = {
  arrow:'<path d="M7 17 17 7M7 7h10v10"/>',
  phone:'<path d="m7 3 3 5-2 2a14 14 0 0 0 6 6l2-2 5 3c0 3-2 4-4 4A19 19 0 0 1 3 7c0-2 1-4 4-4Z"/>',
  whatsapp:'<path d="M21 11.5a9 9 0 0 1-13.4 7.8L3 21l1.6-4.7A9 9 0 1 1 21 11.5Z"/><path d="M8 7.5c-.8 2.9 2 6.9 5.5 7.7 1 .3 2-.5 2-1.2l-2-1.1-.9.7c-1.4-.6-2.7-1.9-3.2-3.3l.7-.8-1-2Z"/>',
  mail:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3 7 9 6 9-6"/>',
  save:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  share:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4m-6.8 7 6.8 4"/>',
  qr:'<path d="M3 3h6v6H3zm12 0h6v6h-6zM3 15h6v6H3zm12 0h3v3h3v3h-6zm6-3v3m-9-3v3m0 3v3"/>',
  web:'<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18M7 6.5h.01m3 0h.01M7 13h4m-4 3h8"/>',
  content:'<path d="m4 9 13-5v16L4 15Zm3 7 2 5h3l-2-6m10-7 2-1m-2 8 2 1"/>',
  system:'<path d="m12 3 10 5-10 5L2 8Zm-9 10 9 5 9-5M3 18l9 5 9-5"/>',
  card:'<rect x="2" y="5" width="20" height="14" rx="3"/><circle cx="8" cy="11" r="2"/><path d="M5 16c0-3 6-3 6 0m3-7h5m-5 4h5m-5 3h3"/>',
  menu:'<path d="M4 3h16v18H4Zm4 5h8m-8 4h8m-8 4h5"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>'
};
const icon = key => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[key]}</svg>`;
const ext = 'target="_blank" rel="noopener noreferrer"';
const whatsapp = `https://wa.me/${p.whatsapp}?text=${encodeURIComponent('Hello Joni, I would like to discuss an ADMAKI Digital project.')}`;
const vEscape = value => String(value).replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
function fold(line) {
  let result = '', bytes = 0;
  for (const ch of line) {
    const count = Buffer.byteLength(ch);
    if (bytes + count > 75) { result += '\r\n '; bytes = 1; }
    result += ch; bytes += count;
  }
  return result;
}
const note = `${p.description}\nServices: ${p.services.map(s=>s.title).join('; ')}\nContact: ${p.contactName}\nDigital card: ${canonical}\nWhatsApp: https://wa.me/${p.whatsapp}`;
writeFileSync(`${dir}/contact.vcf`, [
  'BEGIN:VCARD','VERSION:3.0',`FN:${vEscape(p.contactName+' | '+p.name)}`,`N:;${vEscape(p.contactName)};;;`,
  `ORG:${vEscape(p.organization)}`,`TEL;TYPE=WORK,VOICE:${p.phone}`,
  `EMAIL;TYPE=WORK,INTERNET:${p.email}`,`EMAIL;TYPE=WORK,INTERNET:${p.personalEmail}`,
  'ADR;TYPE=WORK:;;;Addis Ababa;;;Ethiopia',`URL:${p.website}`,
  `item1.URL:${canonical}`,'item1.X-ABLabel:Digital card',
  `item2.URL:https://wa.me/${p.whatsapp}`,'item2.X-ABLabel:WhatsApp',
  `item3.URL:https://menu.admakidigital.com/`,'item3.X-ABLabel:ADMAKI Menu',
  `item4.URL:https://nfc.admakidigital.com/`,'item4.X-ABLabel:ADMAKI Digital Card',
  `PHOTO;ENCODING=b;TYPE=JPEG:${readFileSync('public'+p.contactPhoto).toString('base64')}`,
  `NOTE:${vEscape(note)}`,'END:VCARD',''
].map(fold).join('\r\n'));
await QRCode.toFile(`${dir}/qr.svg`, canonical, {type:'svg',errorCorrectionLevel:'M',margin:4,width:512,color:{dark:'#0b1120',light:'#ffffff'}});
await QRCode.toFile(`${dir}/qr.png`, canonical, {type:'png',errorCorrectionLevel:'M',margin:4,width:1024,color:{dark:'#0b1120',light:'#ffffff'}});
writeFileSync(`${dir}/index.html`, `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#FAFAF8">
<title>Joni · ADMAKI Digital | Digital Card</title><meta name="description" content="${e(p.description)}">
<link rel="canonical" href="${canonical}"><link rel="icon" href="/brand/favicon.svg" type="image/svg+xml">
<meta property="og:title" content="Joni · ADMAKI Digital"><meta property="og:description" content="Websites, creative campaigns, custom software, digital cards and QR menus. Let's make your next move."><meta property="og:type" content="website"><meta property="og:url" content="${canonical}"><meta property="og:image" content="https://nfc.admakidigital.com/brand/social-preview.png">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="Joni · ADMAKI Digital"><meta name="twitter:image" content="https://nfc.admakidigital.com/brand/social-preview.png">
<link rel="preload" as="font" type="font/woff2" href="/fonts/manrope-variable.woff2" crossorigin><link rel="stylesheet" href="/profiles/admaki/card.css"><script src="/profiles/profile.js" defer></script>
</head><body>
<a class="skip-link" href="#contact">Skip to contact details</a>
<main class="digital-card">
<header class="hero"><div class="hero-top"><a href="${e(p.website)}" aria-label="Visit ADMAKI Digital website" ${ext}><img class="brand" src="${e(p.logo)}" alt="ADMAKI Digital" width="1148" height="284"></a><button class="icon-button" type="button" data-open-qr aria-label="Show this card's QR code">${icon('qr')}</button></div>
<div class="hero-orbits" aria-hidden="true"><i></i><i></i><i></i><b></b></div>
<p class="eyebrow">CREATIVE THINKING. PRACTICAL TOOLS.</p>
<h1>Ideas that move.<br>Systems that <em>work.</em></h1>
<p class="intro">${e(p.description)}</p>
<div class="location"><span></span>${e(p.location)}</div></header>
<div class="card-content" id="contact">
<div class="contact-intro"><div class="avatar" aria-hidden="true">J.</div><div><p class="contact-name">${e(p.contactName)}</p><p class="contact-company">Let’s talk about your next project.</p></div></div>
<a class="primary save" href="/${p.slug}/contact.vcf" download="Joni-ADMAKI-Digital.vcf">${icon('save')}Save contact</a>
<div class="quick-actions" aria-label="Contact Joni"><a href="tel:${p.phone}">${icon('phone')}<span>Call</span></a><a href="${e(whatsapp)}" ${ext}>${icon('whatsapp')}<span>WhatsApp</span></a><a href="mailto:${e(p.email)}">${icon('mail')}<span>Email</span></a></div>
<section aria-labelledby="services-title"><div class="section-heading"><span class="section-tag">THE ADMAKI TOOLKIT</span><h2 id="services-title">Make your next<br>move matter.</h2><p>Start with what your business needs.</p></div><div class="service-list">${p.services.map((s,i)=>`<a class="service" href="${e(s.url)}" ${ext}><span class="service-icon">${icon(s.icon)}</span><span class="service-copy"><span class="service-number">0${i+1}</span><h3>${e(s.title)}</h3><p>${e(s.description)}</p></span>${icon('arrow')}</a>`).join('')}</div></section>
<section class="work-section" aria-labelledby="work-title"><div class="section-heading"><span class="section-tag">SELECTED WORK</span><h2 id="work-title">Real businesses.<br>Practical solutions.</h2></div><div class="projects">${p.projects.map(s=>`<a class="project" href="${e(s.url)}" ${ext}><img src="${e(s.image)}" alt="${e(s.name)} website preview" width="1440" height="900" loading="lazy" decoding="async"><span class="project-caption"><span><strong>${e(s.name)}</strong><small>${e(s.category)}</small></span>${icon('arrow')}</span></a>`).join('')}</div><a class="text-link" href="https://admakidigital.com/work" ${ext}>Explore all our work ${icon('arrow')}</a></section>
<section class="project-cta" aria-labelledby="cta-title"><span class="section-tag">YOUR NEXT CHAPTER</span><h2 id="cta-title">Have an idea?<br>Let’s make it matter.</h2><p>A website, a campaign or a system that makes the work easier. Let’s start a conversation.</p><a class="primary" href="${e(whatsapp)}" ${ext}>Chat with Joni ${icon('arrow')}</a></section>
<section class="details" aria-label="Contact details"><a href="tel:${p.phone}"><span>CALL / WHATSAPP</span><strong>${e(p.phoneDisplay)}</strong>${icon('arrow')}</a><a href="mailto:${e(p.email)}"><span>GENERAL ENQUIRIES</span><strong>${e(p.email)}</strong>${icon('arrow')}</a><a href="mailto:${e(p.personalEmail)}"><span>CONTACT JONI</span><strong>${e(p.personalEmail)}</strong>${icon('arrow')}</a><a href="${e(p.website)}" ${ext}><span>VISIT OUR WEBSITE</span><strong>admakidigital.com</strong>${icon('arrow')}</a></section>
<div class="share-actions"><button type="button" class="share-button" data-share data-card-url="${canonical}" data-card-name="Joni · ADMAKI Digital">${icon('share')}Share this card</button><button type="button" class="qr-link" data-open-qr>${icon('qr')}QR code</button></div><p class="feedback" role="status" aria-live="polite"></p><div class="copy-fallback" hidden><label for="card-url">Copy this card’s link</label><input id="card-url" readonly value="${canonical}"></div>
<footer><p>Connected creativity.<br><strong>Practical technology.</strong></p><a href="https://nfc.admakidigital.com/" ${ext}>Digital card by ADMAKI ${icon('arrow')}</a></footer>
</div></main>
<dialog id="qr-dialog" aria-labelledby="qr-title"><form method="dialog"><button class="icon-button" aria-label="Close QR code">${icon('close')}</button></form><p class="section-tag">SCAN TO CONNECT</p><h2 id="qr-title">Joni · ADMAKI Digital</h2><img class="qr-image" src="/${p.slug}/qr.svg" alt="QR code opening Joni's ADMAKI Digital card" width="256" height="256"><p>Open this card on another phone.</p><a class="primary" href="/${p.slug}/qr.png" download="ADMAKI-Digital-QR.png">${icon('save')}Download QR code</a></dialog>
</body></html>\n`);
console.log(`Generated ${p.slug}: digital card, contact file and verified-destination QR assets.`);

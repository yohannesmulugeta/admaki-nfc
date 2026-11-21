// Shared by the public card and the authenticated editor's local preview.
// Insert user content through text nodes and validated URLs only.
import {renderFamily} from './render-families.js';
export function renderProfile(p){
    if(renderFamily(p))return;
    const text=(selector,value)=>{const el=document.querySelector(selector);if(el&&typeof value==='string')el.textContent=value};
    const link=(selector,value)=>{const el=document.querySelector(selector);if(el&&typeof value==='string'&&['https://','mailto:','tel:'].some(prefix=>value.startsWith(prefix)))el.href=value};
    const image=(selector,value)=>{const el=document.querySelector(selector);if(!el||typeof value!=='string')return;if(!value){el.hidden=true;el.removeAttribute('src');return;}if(value.startsWith('/')&&!value.startsWith('//')||value.startsWith('https://')){el.hidden=false;el.src=value;}};
    document.title=p.name+' | Digital Card';
    const meta=document.querySelector('meta[name="description"]');if(meta)meta.content=p.description||'';
    const shareButton=document.querySelector('[data-share]');if(shareButton)shareButton.dataset.cardName=p.name;
    text('#qr-title',p.name);
    text('.identity h1',p.name);text('.identity .eyebrow',p.eyebrow);
    text('.identity .intro-copy',p.description);text('.about-company p',p.companyDescription);
    image('.cover img',p.cover);image('.brand-badge img',p.logo);
    document.querySelector('.cover img')?.setAttribute('alt',p.coverAlt||'');
    document.querySelector('.collection-feature img')?.setAttribute('alt',p.interiorAlt||'');
    link('.quick-actions a:nth-child(1)','tel:'+p.phone);
    link('.quick-actions a:nth-child(2)','https://wa.me/'+p.whatsapp);
    link('.quick-actions a:nth-child(3)','mailto:'+p.email);
    const rows=document.querySelectorAll('.contact-section .detail-link');
    const details=[['Speak with us',p.phoneLabel,'tel:'+p.phone],['General enquiries',p.email,'mailto:'+p.email],['Sales enquiries',p.salesEmail,'mailto:'+p.salesEmail],['Get showroom directions',p.address,p.showroomUrl]];
    rows.forEach((el,i)=>{const d=details[i];if(!d)return;const strong=el.querySelector('strong'),small=el.querySelector('small');if(strong)strong.textContent=d[0];if(small)small.textContent=d[1]||'';if(typeof d[2]==='string'&&['https://','mailto:','tel:'].some(prefix=>d[2].startsWith(prefix)))el.href=d[2]});
    const nav=document.querySelector('.collection-links');
    if(nav&&Array.isArray(p.collections)){nav.replaceChildren();for(const c of p.collections){if(typeof c.url!=='string'||!c.url.startsWith('https://'))continue;const a=document.createElement('a');a.href=c.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=c.name||'Collection';nav.append(a)}}
    link('.gallery-directions',p.showroomUrl);
    link('.collection-feature',p.collectionUrl);
    image('.collection-feature img',p.interior);
    const explore=document.querySelectorAll('.explore-links .detail-link');
    const targets=[p.catalogue,p.consultationUrl,p.website];
    explore.forEach((a,i)=>{const url=targets[i];if(typeof url==='string'&&url.startsWith('https://'))a.href=url});
    const gallery=document.querySelector('.gallery-grid');
    if(gallery&&Array.isArray(p.gallery)){gallery.replaceChildren();for(const photo of p.gallery){if(typeof photo.image!=='string'||!(photo.image.startsWith('/')&&!photo.image.startsWith('//')||photo.image.startsWith('https://')))continue;const a=document.createElement('a');a.className='gallery-photo';a.href=photo.image;a.target='_blank';a.rel='noopener noreferrer';a.setAttribute('aria-label','Open '+(photo.title||'showroom')+' photograph');const figure=document.createElement('figure');const img=document.createElement('img');img.src=photo.image;img.alt=photo.alt||'';img.loading='lazy';const caption=document.createElement('figcaption');caption.textContent=photo.title||'';figure.append(img,caption);a.append(figure);gallery.append(a)}}
    const social=document.querySelector('.social-links');
    if(social&&Array.isArray(p.social)){social.replaceChildren();for(const c of p.social){if(!String(c.url||'').startsWith('https://'))continue;const a=document.createElement('a');a.className='social-link';a.href=c.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=c.name||'Social';social.append(a)}}
}

const dialog = document.querySelector('#qr-dialog');
const feedback = document.querySelector('.feedback');
const share = document.querySelector('[data-share]');
document.querySelectorAll('[data-open-qr]').forEach((button) => {
  button.addEventListener('click', () => dialog.showModal());
});
dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
share.addEventListener('click', async () => {
  const url = share.dataset.cardUrl;
  if (navigator.share) {
    try { await navigator.share({ title: share.dataset.cardName, url }); return; }
    catch (error) { if (error.name === 'AbortError') return; }
  }
  try {
    await navigator.clipboard.writeText(url);
    feedback.textContent = 'Card link copied. Ready to share.';
  } catch {
    const fallback = document.querySelector('.copy-fallback');
    fallback.hidden = false;
    fallback.querySelector('input').focus();
    fallback.querySelector('input').select();
    feedback.textContent = 'Select and copy the link below to share this card.';
  }
});


// Apply published card data without rebuilding or changing permanent NFC URLs.
(async function refreshPublishedCard(){
  const slug=location.pathname.replace(/^\\/+|\\/+$/g,'');
  if(!/^maison-debrah(?:\\/0[2-4])?$/.test(slug))return;
  try{
    const response=await fetch('/api/public/cards/'+slug,{cache:'no-store'});
    if(!response.ok)return; // Keep the generated static card as a safe fallback.
    const {profile:p}=await response.json();
    const text=(selector,value)=>{const el=document.querySelector(selector);if(el&&typeof value==='string')el.textContent=value};
    const href=(selector,value)=>{const el=document.querySelector(selector);if(el&&typeof value==='string'&&/^(https:\\/\\/|mailto:|tel:)/i.test(value))el.href=value};
    const image=(selector,value)=>{const el=document.querySelector(selector);if(el&&typeof value==='string'&&(/^(https:\\/\\/|\\/)/i.test(value)))el.src=value};
    text('.identity h1',p.name);text('.identity .eyebrow',p.eyebrow);
    text('.identity .intro-copy',p.description);text('.about-company p',p.companyDescription);
    image('.cover img',p.cover);image('.brand-badge img',p.logo);
    href('.quick-actions a:nth-child(1)', 'tel:'+p.phone);
    href('.quick-actions a:nth-child(2)','https://wa.me/'+p.whatsapp);
    href('.quick-actions a:nth-child(3)','mailto:'+p.email);
    const rows=document.querySelectorAll('.contact-section .detail-link');
    const details=[['Speak with us',p.phoneLabel,'tel:'+p.phone],['General enquiries',p.email,'mailto:'+p.email],['Sales enquiries',p.salesEmail,'mailto:'+p.salesEmail],['Get showroom directions',p.address,p.showroomUrl]];
    rows.forEach((el,i)=>{const d=details[i];if(!d)return;const strong=el.querySelector('strong'),small=el.querySelector('small');if(strong)strong.textContent=d[0];if(small)small.textContent=d[1]||'';if(/^(https:\\/\\/|mailto:|tel:)/.test(d[2]||''))el.href=d[2]});
    const nav=document.querySelector('.collection-links');
    if(nav&&Array.isArray(p.collections)){nav.replaceChildren();for(const c of p.collections){if(typeof c.url!=='string'||!/^https:\\/\\//.test(c.url))continue;const a=document.createElement('a');a.href=c.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=c.name||'Collection';nav.append(a)}}
    const social=document.querySelector('.social-links');
    if(social&&Array.isArray(p.social)){social.replaceChildren();for(const c of p.social){if(!/^https:\\/\\//.test(c.url||''))continue;const a=document.createElement('a');a.className='social-link';a.href=c.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=c.name||'Social';social.append(a)}}
  }catch(error){console.warn('Published profile unavailable; showing static card.',error)}
})();

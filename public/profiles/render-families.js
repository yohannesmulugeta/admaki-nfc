const validLink=value=>typeof value==='string'&&/^https:\/\//.test(value)&&!/[\s\\]/.test(value);
const validImage=value=>typeof value==='string'&&(/^(\/(?!\/)|https:\/\/)/).test(value)&&!/[\s\\]/.test(value);
const text=(selector,value,root=document)=>{const el=root.querySelector(selector);if(el&&typeof value==='string'&&el.textContent.replace(/\s/g,'')!==value.replace(/\s/g,''))el.textContent=value;};
const link=(selector,value,root=document)=>{const el=root.querySelector(selector);if(el&&(validLink(value)||/^(tel:|mailto:)[^\s]*$/.test(value)))el.href=value;};
const image=(selector,value,root=document)=>{const el=root.querySelector(selector);if(!el)return;if(!value){el.hidden=true;el.removeAttribute('src');}else if(validImage(value)){el.hidden=false;el.src=value;}};
function allLinks(prefix,values){document.querySelectorAll(`a[href^="${prefix}"]`).forEach((a,i)=>{const value=values[Math.min(i,values.length-1)]||'';a.hidden=!value;if(value){if(prefix==='https://wa.me/'){const url=new URL(a.href);url.pathname='/'+value;a.href=url.href;}else a.href=prefix+value;}else a.removeAttribute('href');});}
function socials(selector,list){const target=document.querySelector(selector);if(!target||!Array.isArray(list))return;const originals=Array.from(target.children),first=originals[0];target.replaceChildren();for(const item of list){if(!validLink(item.url))continue;const original=originals.find(a=>a.textContent.trim().includes(item.name))||first;const a=original?original.cloneNode(true):document.createElement('a');a.href=item.url;a.target='_blank';a.rel='noopener noreferrer';const label=a.querySelector(selector==='.social-row'?'strong':'span:not(.external)');if(label)label.textContent=item.name;else a.textContent=item.name;target.append(a);}}
function list(selector,list,update){const target=document.querySelector(selector);if(!target||!Array.isArray(list))return;const originals=Array.from(target.children);target.replaceChildren();list.forEach((item,i)=>{const original=originals[i]||originals[0];if(!original||!validLink(item.url))return;const row=original.cloneNode(true);row.href=item.url;update(row,item);target.append(row);});}
export function renderFamily(p){
 if(!['universal','kkgt','admaki','shasho','business'].includes(p.theme))return false;
 document.title=(p.contactName?p.contactName+' · ':'')+p.name+' | '+p.organization;
 const meta=document.querySelector('meta[name="description"]');if(meta)meta.content=p.description||p.companyDescription||'';
 text('#qr-title',p.name);const share=document.querySelector('[data-share]');if(share)share.dataset.cardName=p.name;
 allLinks('tel:',[p.phone]);allLinks('https://wa.me/',[p.whatsapp]);allLinks('mailto:',[p.email]);
 document.querySelectorAll('a[download][href$="contact.vcf"]').forEach(a=>a.href='/'+p.slug+'/contact.vcf');
 document.querySelectorAll('.qr-image').forEach(img=>img.src='/'+p.slug+'/qr.svg');
 if(p.theme==='business'){
  text('header h1',p.name);text('header .eyebrow',p.organization);text('header .role',p.role);text('header .intro',p.description);image('.business-logo',p.logo);text('.business-phone',p.phoneLabel||p.phone);text('.business-email',p.email);link('.business-website',p.website);text('.business-about p',p.companyDescription);text('.business-location p',p.address);link('.business-location a',p.showroomUrl);socials('.business-social',p.social);
  for(const [selector,value]of [['.business-phone',p.phone],['.business-whatsapp',p.whatsapp],['.business-email',p.email],['.business-website',p.website],['.business-about',p.companyDescription],['.business-location',p.address||p.showroomUrl]]){const el=document.querySelector(selector);if(el)el.hidden=!value;}return true;
 }
 if(p.theme==='kkgt'||p.theme==='universal'){
  text('.profile h1',p.name);text('.profile .company',p.organization);text('.profile .tagline',p.description);text('.profile .role',p.role);image('.portrait',p.portrait);text('.quick-actions a:first-child>span:last-child',p.phoneLabel||p.phone);
  if(p.theme==='kkgt'){text('.quick-actions a:first-child strong','Call '+p.name.split(' ')[0]);image('.cover-photo',p.cover);image('.cover .logo',p.logo);text('.contact-row[href^="mailto:"]:nth-of-type(2) small',p.email);const emails=document.querySelectorAll('.contact-row[href^="mailto:"]');emails.forEach((a,i)=>{const value=i===0?p.email:p.salesEmail;a.hidden=!value;if(value)a.href='mailto:'+value;else a.removeAttribute('href');text('small',value||'',a);});text('.address span',p.address);text('.about p',p.companyDescription);link('.coffee-feature',p.collectionUrl);image('.coffee-feature img',p.interior);link('.inquiry',p.consultationUrl);socials('.social-links',p.social);}
  else {image('.brand img',p.logo);text('.link-row[href^="mailto:"] .row-text>span',p.email);text('a.link-row[href^="https://maps"] .row-text>span',p.address);link('a.link-row[href^="https://maps"]',p.showroomUrl);socials('.social-grid',p.social);list('.collections',p.collections,(a,c)=>{text('.collection-label span',c.name,a);image('img',c.image,a);});}
  link('.website',p.website);return true;
 }
 if(p.theme==='admaki'){
  image('.hero-top .brand',p.logo);text('.hero h1',p.headline);text('.hero .intro',p.description);text('.hero .location',p.address);text('.contact-name',p.contactName);text('.contact-intro .avatar',p.contactName?.slice(0,1)+'.');link('.hero-top>a',p.website);text('.details a:nth-child(1) strong',p.phoneLabel||p.phone);text('.details a:nth-child(2) strong',p.email);text('.details a:nth-child(3) strong',p.personalEmail||'');const personal=document.querySelector('.details a:nth-child(3)');if(personal){personal.hidden=!p.personalEmail;if(p.personalEmail)personal.href='mailto:'+p.personalEmail;}link('.details a:nth-child(4)',p.website);link('.text-link',p.website);
  list('.service-list',p.services,(a,s)=>{text('h3',s.title,a);text('.service-copy p',s.description,a);});
  list('.projects',p.projects,(a,s)=>{text('strong',s.name,a);text('small',s.category,a);image('img',s.image,a);});return true;
 }
 if(p.theme==='shasho'){
  text('.hero h1',p.name);text('.role-line',p.organization);text('.hero-location',p.eyebrow);image('.portrait-frame img',p.portrait);image('.topbar .logo img',p.logo);link('.topbar .logo',p.website);link('.quick-actions a:nth-child(4)',p.website);text('.contact-small',(p.phoneLabel||p.phone)+' · '+p.email);text('.about>p',p.companyDescription);socials('.social-row',p.social);
  document.querySelectorAll('a[href*="google.com/maps"]').forEach(a=>{if(validLink(p.showroomUrl))a.href=p.showroomUrl;});text('.office-copy address',p.address);text('.office-copy h3',p.officeTitle);return true;
 }
 return true;
}

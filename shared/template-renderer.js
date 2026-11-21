// Pure renderer shared by the Worker and the browser preview. Compiled HTML is
// trusted build output; every content value is escaped at the insertion point.
export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const valueAt=(object,path)=>String(path||'').split('.').reduce((v,k)=>v?.[k],object);
function resolve(slot,p,context){
 if(slot.constant!==undefined)return slot.constant;
 if(slot.compute==='cardUrl')return context.origin+'/'+p.slug+'/';
 if(slot.compute==='contactUrl')return '/'+p.slug+'/contact.vcf';
 if(slot.compute==='qrUrl')return '/'+p.slug+'/qr.svg';
 if(slot.compute==='qrPng')return '/'+p.slug+'/qr.png';
 if(slot.compute==='contactSummary')return [p.phoneLabel||p.phone,p.email].filter(Boolean).join(' · ');
 if(slot.compute==='title')return [p.contactName,p.name,p.organization].filter(Boolean).join(' · ');
 if(slot.compute==='companyAbout')return 'ABOUT '+(p.organization||p.name);
 if(slot.compute==='companyExplore')return 'EXPLORE '+(p.organization||p.name);
 let value=valueAt(p,slot.key)??'';
 if(slot.fallback&&!value)value=valueAt(p,slot.fallback)||'';
 if(slot.transform==='tel')value=value?'tel:'+value:'';
 if(slot.transform==='mail')value=value?'mailto:'+value:'';
 if(slot.transform==='whatsapp')value=value?'https://wa.me/'+value:'';
 return value;
}
function safeAttribute(name,value){
 if(!value)return '';
 if(['href','src'].includes(name)){
  if(/[\u0000-\u0020\\]/.test(value)||String(value).startsWith('//'))return '';
  if(!/^(\/(?!\/)|https:\/\/|tel:|mailto:|#)/.test(value))return '';
 }
 return escapeHTML(value);
}
export function renderTemplate(definition,profile,{origin='https://nfc.admakidigital.com',preview=false}={}){
 const context={origin};
 const render=(html,slots,p)=>html.replace(/@@ADMAKI_(\d+)@@/g,(_,id)=>{
  const s=slots[Number(id)];if(!s)return '';
  if(s.type==='repeat'){
   const items=valueAt(p,s.key);if(!Array.isArray(items))return '';
   return items.map((item,i)=>{const row=s.rows.find(r=>r.match&&r.match===(item.name||item.title))||s.rows[i]||s.rows[0];return row?render(row.html,row.slots,item):'';}).join('');
  }
  if(s.type==='optionalHTML')return resolve(s,p,context)?render(s.html,slots,p):'';
  if(s.type==='optional'){const value=valueAt(p,s.key);return value&&(typeof value!=='string'||value.trim())?render(s.html,s.slots,p):'';}
  const value=resolve(s,p,context);
  if(s.type==='attribute')return safeAttribute(s.attribute,value);
  if(s.type==='image'){
   const src=safeAttribute('src',value);if(!src)return '';
   return s.html.replace('@@IMAGE_SOURCE@@',src).replace('@@IMAGE_ALT@@',escapeHTML(s.altKey?valueAt(p,s.altKey):s.alt||''));
  }
  // Preserve the approved line breaks, icons and emphasis for unchanged copy.
  if(s.defaultHTML!==undefined&&s.defaultValue!==undefined&&String(value).replace(/\s/g,'')===String(s.defaultValue??'').replace(/\s/g,''))return s.defaultHTML;
  return escapeHTML(value);
 });
 let html=render(definition.html,definition.slots,profile);
 if(preview)html=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
 return html;
}

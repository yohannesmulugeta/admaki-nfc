const strings = ['name','organization','eyebrow','description','companyDescription','phone','phoneLabel','whatsapp','email','salesEmail','address','website','showroomUrl','catalogue','collectionUrl','consultationUrl','logo','cover','coverAlt','interior','interiorAlt','contactPhoto','theme','role','portrait','contactName','headline','personalEmail','officeTitle'];
const arrayFields = {social:['name','url','icon'],collections:['name','url','image'],featuredProducts:['name','category','image','url'],gallery:['image','title','alt'],services:['title','description','icon','url'],projects:['name','category','image','url']};
const urls = new Set(['website','showroomUrl','catalogue','collectionUrl','consultationUrl','url']);
const images = new Set(['logo','cover','interior','contactPhoto','portrait','image']);
export const maisonSlugs = ['maison-debrah','maison-debrah/02','maison-debrah/03','maison-debrah/04'];
const safeURL = (value, local = false) => {
  if (!value) return true;
  if (/[\u0000-\u0020\\]/.test(value)) return false;
  if (local && value.startsWith('/') && !value.startsWith('//')) return true;
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; }
};
export function validateProfile(next, old) {
  if (!next || typeof next !== 'object' || Array.isArray(next) || next.slug !== old.slug || next.source !== old.source) throw Error('Permanent card address and source cannot change');
  if (Object.keys(next).some(key => ![...strings,...Object.keys(arrayFields),'contactAddress','slug','source'].includes(key))) throw Error('Unexpected profile field');
  for (const key of strings) {
    if (!(key in next)) continue;
    if (typeof next[key] !== 'string' || next[key].length > 4000 || /[\u0000\r\n]/.test(next[key]) && !['description','companyDescription'].includes(key)) throw Error('Invalid '+key);
    if (urls.has(key) && !safeURL(next[key])) throw Error('Use a valid HTTPS link for '+key);
    if (images.has(key) && !safeURL(next[key],true)) throw Error('Use a local image path or HTTPS URL for '+key);
  }
  if (!next.name?.trim()) throw Error('Name is required');
  for (const key of ['email','salesEmail','personalEmail']) if (next[key] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next[key])) throw Error('Invalid '+key);
  if (next.phone && !/^\+?[0-9 ()-]{5,30}$/.test(next.phone)) throw Error('Invalid phone');
  if (next.whatsapp && !/^[0-9]{5,20}$/.test(next.whatsapp)) throw Error('WhatsApp needs digits including the country code');
  if (!['maison','universal','kkgt','admaki','shasho','business'].includes(old.theme) || next.theme !== old.theme) throw Error('Card theme cannot change in this editor');
  for (const [key, fields] of Object.entries(arrayFields)) {
    if (!(key in next)) continue;
    const value = next[key];
    if (!Array.isArray(value) || value.length > 30) throw Error('Invalid '+key);
    for (const item of value) {
      if (!item || typeof item !== 'object' || Array.isArray(item) || Object.keys(item).some(k => !fields.includes(k))) throw Error('Invalid '+key+' entry');
      for (const [field,text] of Object.entries(item)) {
        if (typeof text !== 'string' || text.length > 2048 || /[\u0000\r\n]/.test(text)) throw Error('Invalid '+key+' '+field);
        if ((urls.has(field) || images.has(field)) && !safeURL(text,images.has(field))) throw Error('Invalid '+key+' link');
      }
    }
  }
  if (next.contactAddress) {
    if (typeof next.contactAddress !== 'object' || Array.isArray(next.contactAddress) || Object.keys(next.contactAddress).some(k=>!['street','city','region','postalCode','country'].includes(k)) || Object.values(next.contactAddress).some(v=>typeof v!=='string'||v.length>200||/[\u0000\r\n]/.test(v))) throw Error('Invalid contact address');
  }
  if (JSON.stringify(next).length > 65000) throw Error('Profile is too large');
}
const escape = value => String(value || '').replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
function fold(line) {
  let result='',bytes=0;
  for (const ch of line) { const size=new TextEncoder().encode(ch).length; if(bytes+size>75){result+='\r\n ';bytes=1;}result+=ch;bytes+=size; }
  return result;
}
export function vcard(p, origin) {
  const a=p.contactAddress||{},links=[];
  if(p.showroomUrl)links.push({name:'Showroom location',url:p.showroomUrl});
  if(p.theme!=='maison')links.push({name:'Digital card',url:new URL('/'+p.slug+'/',origin).href});
  if(p.theme==='admaki'&&p.whatsapp)links.push({name:'WhatsApp',url:'https://wa.me/'+p.whatsapp});
  if(p.theme==='admaki')for(const service of p.services||[])if(service.url?.includes('menu.admakidigital.com')||service.url?.includes('nfc.admakidigital.com'))links.push({name:service.title,url:service.url});
  links.push(...(p.social||[]));
  const note=[p.companyDescription||p.description||'',...(p.services?.length?['Services: '+p.services.map(s=>s.title).join('; ')]:[])].filter(Boolean).join('\n');
  return ['BEGIN:VCARD','VERSION:3.0',`FN:${escape(p.contactName?p.contactName+' | '+p.name:p.name)}`,`N:${escape(p.contactName||p.name)};;;;`,`ORG:${escape(p.organization)}`,...(p.role?[`TITLE:${escape(p.role)}`]:[]),
    `TEL;TYPE=WORK,VOICE:${escape(p.phone)}`,`EMAIL;TYPE=WORK,INTERNET:${escape(p.email)}`,
    ...(p.personalEmail?[`EMAIL;TYPE=WORK,INTERNET:${escape(p.personalEmail)}`]:[]),
    ...(p.salesEmail?[`EMAIL;TYPE=WORK,INTERNET:${escape(p.salesEmail)}`]:[]),
    `ADR;TYPE=WORK:;;${escape(a.street)};${escape(a.city)};${escape(a.region)};${escape(a.postalCode)};${escape(a.country)}`,
    `URL:${escape(p.website)}`,
    ...links.flatMap((s,i)=>[`item${i+1}.URL:${escape(s.url)}`,`item${i+1}.X-ABLabel:${escape(s.name)}`]),
    ...(p.contactPhoto?[`PHOTO;VALUE=URI:${escape(new URL(p.contactPhoto,origin).href)}`]:[]),
    `NOTE:${escape(note)}`,'END:VCARD',''].map(fold).join('\r\n');
}

import {readFileSync,readdirSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {validateProfile} from '../worker/profile.js';
export function loadCompanies(){
 const companies=JSON.parse(readFileSync('companies/registry.json','utf8'));
 const profiles=readdirSync('profiles').filter(f=>f.endsWith('.json')).map(f=>JSON.parse(readFileSync('profiles/'+f,'utf8')));
 const ids=new Set(),routes=new Set();
 for(const company of companies){if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(company.id)||ids.has(company.id)||!company.name)throw Error('Invalid or duplicate company');ids.add(company.id);
  company.profiles=company.cards.map(slug=>{if(routes.has(slug))throw Error('Card assigned to more than one company: '+slug);routes.add(slug);const p=profiles.find(p=>p.slug===slug);if(!p)throw Error('Missing profile: '+slug);return normalizeProfile(p,company);});
 }
 for(const profile of profiles)if(!routes.has(profile.slug))throw Error('Profile has no company assignment: '+profile.slug);
 return companies;
}
function addressFromContact(path){const unfolded=readFileSync(path,'utf8').replace(/\r?\n /g,'');const line=unfolded.match(/^ADR[^:]*:(.*)$/m)?.[1]?.replace(/\r$/,'');if(!line)return undefined;const parts=line.split(/(?<!\\);/).map(v=>v.replace(/\\,/g,',').replace(/\\;/g,';'));return {street:parts[2]||'',city:parts[3]||'',region:parts[4]||'',postalCode:parts[5]||'',country:parts[6]||''};}
export function normalizeProfile(p,company){
 if(!p.layout||p.theme==='business'){validateProfile(p,p);return p;}
 if(p.layout==='admaki'){const {layout,phoneDisplay,location,...rest}=p;const next={...rest,theme:'admaki',phoneLabel:phoneDisplay,address:location,contactAddress:{street:'',city:location.split(',')[0].trim(),region:'',postalCode:'',country:location.split(',').slice(1).join(',').trim()}};validateProfile(next,next);return next;}
 const theme=p.layout==='source-copy'?p.template:'shasho';
 const html=p.layout==='source-copy'?readFileSync(`profiles/templates/${p.template}.html`,'utf8'):readFileSync(`public/${p.slug}/index.html`,'utf8');
 const document=new JSDOM(html).window.document;
 const text=selector=>document.querySelector(selector)?.textContent.trim()||'';
 const href=selector=>document.querySelector(selector)?.getAttribute('href')||'';
 const img=selector=>document.querySelector(selector)?.getAttribute('src')||'';
 const f=p.fields||p;
 const next={slug:p.slug,source:p.source,theme,name:f.name,organization:company.name,phone:f.phone,phoneLabel:f.phoneDisplay||text('.contact-small').split('·')[0].trim(),whatsapp:f.whatsapp,email:f.email,logo:company.logo,portrait:f.portrait,contactPhoto:f.contactPhoto||f.portrait};
 if(theme==='kkgt')Object.assign(next,{role:f.role,description:text('.tagline'),salesEmail:f.email2,cover:img('.cover-photo'),companyDescription:text('.about p'),website:href('.website'),address:text('.address span'),contactAddress:addressFromContact('profiles/templates/kkgt.vcf'),collectionUrl:href('.coffee-feature'),interior:img('.coffee-feature img'),consultationUrl:href('.inquiry'),social:Array.from(document.querySelectorAll('.social-links a')).map(a=>({name:a.querySelector('span')?.textContent||'',url:a.getAttribute('href')}))});
 if(theme==='universal')Object.assign(next,{description:text('.tagline'),address:text('.link-row .row-text:has(strong)') ,website:href('.website'),showroomUrl:href('a.link-row[href^="https://maps"]'),contactAddress:addressFromContact('profiles/templates/universal.vcf'),social:Array.from(document.querySelectorAll('.social-grid a')).map(a=>({name:a.querySelector('span:not(.external)')?.textContent||'',url:a.getAttribute('href')})),collections:Array.from(document.querySelectorAll('.collections>a')).map(a=>({name:a.querySelector('.collection-label span')?.textContent||'',url:a.getAttribute('href'),image:a.querySelector('img')?.getAttribute('src')||''}))});
 if(theme==='universal'){const map=document.querySelector('a.link-row[href^="https://maps"]');next.address=map?.querySelector('.row-text span')?.textContent||text('.profile .location');}
 if(theme==='shasho')Object.assign(next,{website:p.website,address:text('.office-copy address'),officeTitle:text('.office-copy h3'),showroomUrl:p.mapSearchUrl,eyebrow:text('.hero-location'),companyDescription:text('.about>p'),social:p.social,contactAddress:addressFromContact(`public/${p.slug}/contact.vcf`)});
 validateProfile(next,next);return next;
}

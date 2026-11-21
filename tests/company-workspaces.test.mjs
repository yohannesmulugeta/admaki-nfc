import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {JSDOM} from 'jsdom';
import {loadCompanies,normalizeProfile} from '../scripts/company-registry.mjs';
import {validateProfile,vcard} from '../worker/profile.js';
import {renderFamily} from '../public/profiles/render-families.js';
import {applyCompanyBrand} from '../public/manager/ui.js';
const companies=loadCompanies();
test('all five companies and ten existing cards have independent, valid workspace profiles',()=>{
 assert.equal(companies.length,5);const profiles=companies.flatMap(c=>c.profiles);assert.equal(profiles.length,10);assert.equal(new Set(profiles.map(p=>p.slug)).size,10);
 for(const p of profiles){validateProfile(p,p);const edited={...p,name:p.name+' test',phone:'+251911111111'};validateProfile(edited,p);assert.match(vcard(edited,'https://stage.example'),/TEL;TYPE=WORK,VOICE:\+251911111111/);assert.throws(()=>validateProfile({...edited,theme:'other'},p));assert.throws(()=>validateProfile({...edited,website:'javascript:alert(1)'},p));}
 assert.equal(profiles.find(p=>p.theme==='shasho').name,'Ebise Shasho');
});
test('onboarding is repeatable and never overwrites existing drafts, published content or versions',()=>{
 const db=new DatabaseSync(':memory:');for(const f of ['0001_card_admin.sql','0002_card_history.sql','0003_card_media.sql','0004_company_branding.sql'])db.exec(readFileSync('migrations/'+f,'utf8'));
 db.prepare('INSERT INTO organizations(id,name) VALUES(?,?)').run('maison-debrah','Maison Debrah Ethiopia');const p=companies[0].profiles[0];const original=JSON.stringify({...p,name:'Owner-approved edit'}),draft=JSON.stringify({...p,name:'Private work in progress'});
 db.prepare('INSERT INTO cards(id,organization_id,slug,label,published_json,draft_json,version) VALUES(?,?,?,?,?,?,?)').run('existing','maison-debrah',p.slug,'Existing',original,draft,27);
 const {batch}=JSON.parse(execFileSync(process.execPath,['scripts/provision-companies.mjs'],{encoding:'utf8'}));for(let pass=0;pass<2;pass++)for(const query of batch)db.prepare(query.sql).run(...query.params);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM organizations').get().n,5);assert.equal(db.prepare('SELECT COUNT(*) n FROM cards').get().n,10);const existing=db.prepare('SELECT * FROM cards WHERE id=?').get('existing');assert.equal(existing.published_json,original);assert.equal(existing.draft_json,draft);assert.equal(existing.version,27);assert.equal(db.prepare('SELECT COUNT(*) n FROM users').get().n,0);db.close();
});
test('custom public layouts receive edited identity and contact data without injecting HTML',t=>{
 const temp=mkdtempSync(join(tmpdir(),'admaki-layout-'));t.after(()=>rmSync(temp,{recursive:true,force:true}));
 mkdirSync(join(temp,'profiles'));mkdirSync(join(temp,'public/profiles/admaki'),{recursive:true});
 writeFileSync(join(temp,'profiles/admaki.json'),readFileSync('profiles/admaki.json'));
 writeFileSync(join(temp,'public/profiles/admaki/contact-logo.jpg'),readFileSync('public/profiles/admaki/contact-logo.jpg'));
 execFileSync(process.execPath,[resolve('scripts/generate-admaki-card.mjs')],{cwd:temp,encoding:'utf8'});

 for(const company of companies.filter(c=>c.id!=='maison-debrah')){const p=company.profiles[0];const raw=JSON.parse(readFileSync('profiles/'+({universal:'universal-01',kkgt:'kkgt-01',admaki:'admaki','shasho-kelbesa':'shasho-ebise'})[company.id]+'.json','utf8'));const html=raw.layout==='source-copy'?readFileSync('profiles/templates/'+raw.template+'.html','utf8').replace(/\{\{(\w+)\}\}/g,(_,key)=>raw.fields[key]||''):readFileSync((raw.layout==='admaki'?temp+'/':'')+'public/'+raw.slug+'/index.html','utf8');
  const dom=new JSDOM(html,{url:'https://stage.example/'+p.slug+'/'});globalThis.document=dom.window.document;
  renderFamily({...p,name:'<script>Edited name</script>',phone:'+251911111111',email:'updated@example.test',personalEmail:'personal@example.test',salesEmail:'sales@example.test'});
  assert(document.querySelector('h1').textContent.includes(p.theme==='admaki'?'Ideas that move.':'<script>Edited name</script>'));assert(!document.querySelector('h1 script'));assert.equal(document.querySelector('a[href^="tel:"]').getAttribute('href'),'tel:+251911111111');assert.equal(document.querySelector('a[href^="mailto:"]').getAttribute('href'),'mailto:updated@example.test');
  if(p.theme==='admaki'){assert.equal(document.querySelector('.details a:nth-child(2)').href,'mailto:updated@example.test');assert.equal(document.querySelector('.details a:nth-child(3)').href,'mailto:personal@example.test');}dom.window.close();
 }
});
test('shared company branding switches without carrying the previous company logo or accent',()=>{
 const dom=new JSDOM('<body class="client"><img id="clientLogo"><strong id="clientBrandName"></strong><span id="companyBreadcrumb"></span><span id="companyEyebrow"></span></body>');globalThis.document=dom.window.document;
 for(const company of companies){applyCompanyBrand(company);assert.equal(document.querySelector('#clientLogo').getAttribute('src'),company.logo);assert.equal(document.body.style.getPropertyValue('--accent'),company.accent);assert.equal(document.querySelector('#clientBrandName').textContent,company.name);}
 applyCompanyBrand({name:'A future company'});assert.equal(document.querySelector('#clientLogo').getAttribute('src'),'/brand/admaki-logo.svg');assert.equal(document.body.style.getPropertyValue('--accent'),'#2563eb');dom.window.close();
});

test('a new company receives the standard card and preview through the same onboarding pipeline',()=>{
 const root=process.cwd(),temp=mkdtempSync(join(tmpdir(),'admaki-company-'));
 try{mkdirSync(join(temp,'profiles'));mkdirSync(join(temp,'companies'));
 const p={slug:'future-company',source:'Test fixture only',theme:'business',name:'Future Company',organization:'Future Company',phone:'+251911111111',email:'hello@example.test',website:'https://example.test/',logo:''};
 writeFileSync(join(temp,'profiles/future.json'),JSON.stringify(p));writeFileSync(join(temp,'companies/registry.json'),JSON.stringify([{id:'future-company',name:p.name,logo:'',accent:'#2563eb',cards:[p.slug]}]));
 for(const script of ['generate-business-cards','generate-connect-cards','generate-workspaces'])execFileSync(process.execPath,[resolve(root,'scripts/'+script+'.mjs')],{cwd:temp,encoding:'utf8'});
 const html=readFileSync(join(temp,'public/future-company/index.html'),'utf8');assert(html.includes('Future Company'));assert(html.includes('https://nfc.admakidigital.com/future-company/'));assert(!html.includes('Maison Debrah'));
 const preview=readFileSync(join(temp,'public/dashboard/preview/business/index.html'),'utf8');assert(preview.includes('/dashboard/preview.js'));assert(!preview.includes('/profiles/profile.js'));
 const manifest=JSON.parse(readFileSync(join(temp,'.local/company-onboarding.json'),'utf8'));assert.equal(manifest[0].profiles[0].theme,'business');
 }finally{rmSync(temp,{recursive:true,force:true});}
});

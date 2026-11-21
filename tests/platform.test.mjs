import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {loadCompanies} from '../scripts/company-registry.mjs';
import {renderTemplate} from '../shared/template-renderer.js';
import {validateContent} from '../shared/content-schema.js';
import {startBackup,advanceBackups,archiveHistory,archivedRevision} from '../worker/operations.js';
import {restoreBackup} from '../shared/backup-format.js';
import {createCard} from '../worker/onboarding.js';
import {embeddedPhoto} from '../worker/contact.js';
import {publicCard} from '../worker/templates.js';
import {qrResponse} from '../worker/qr.js';
import {assets} from './helpers.mjs';
import {PNG} from 'pngjs';
import jsQR from 'jsqr';
function database(){const sqlite=new DatabaseSync(':memory:');for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync('migrations/'+f,'utf8'));class S{constructor(q,v=[]){this.q=q;this.v=v;}bind(...v){return new S(this.q,v);}async first(){return sqlite.prepare(this.q).get(...this.v)||null;}async all(){return {results:sqlite.prepare(this.q).all(...this.v)};}async run(){return {meta:{changes:Number(sqlite.prepare(this.q).run(...this.v).changes)}};}}return {sqlite,prepare:q=>new S(q),async batch(list){sqlite.exec('BEGIN');try{const r=[];for(const s of list)r.push(await s.run());sqlite.exec('COMMIT');return r;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};}
function bucket(){const map=new Map();return {map,async put(k,v){map.set(k,typeof v==='string'?new TextEncoder().encode(v):new Uint8Array(v));},async get(k){const v=map.get(k);return v?{arrayBuffer:async()=>v.buffer.slice(v.byteOffset,v.byteOffset+v.byteLength),json:async()=>JSON.parse(new TextDecoder().decode(v)),body:new Response(v).body}:null;}};}
const companies=loadCompanies();
test('all registered public designs render safely from pinned templates and preview restores cleared content',()=>{
 for(const p of companies.flatMap(c=>c.profiles)){
  const definition=JSON.parse(readFileSync('public/templates/'+p.theme+'/'+JSON.parse(readFileSync('templates/'+p.theme+'/manifest.json','utf8')).version+'.json','utf8'));
  validateContent(p,p,definition.schema);const html=renderTemplate(definition,p),preview=renderTemplate(definition,p,{preview:true});assert(!html.includes('@@ADMAKI_'));assert(!preview.includes('<script'));const document=new JSDOM(html).window.document;
  assert(document.body.textContent.includes(p.name));assert.equal(document.querySelector('a[href^="tel:"]').getAttribute('href'),'tel:'+p.phone);assert(document.querySelector('a[href$="contact.vcf"]'));assert(document.querySelector('link[rel=canonical]').href.endsWith('/'+p.slug+'/'));
  const changed={...p,name:'<img src=x onerror=alert(1)>',phone:'',social:[],collections:[]};const empty=renderTemplate(definition,changed,{preview:true});assert(!empty.includes('onerror=alert(1)>'));const restored=renderTemplate(definition,p,{preview:true});assert.equal(restored,preview);document.defaultView.close();
 }
});
test('standard company onboarding is idempotent, tenant-restricted and immediately supplies QR files',async()=>{
 const db=database(),env={DB:db,ASSETS:assets};db.sqlite.exec("INSERT INTO organizations(id,name) VALUES('new','New company');INSERT INTO users(id,username,display_name,password_hash,password_salt,is_platform_admin) VALUES('admin','admin','Admin','x','x',1)");
 const org={id:'new',name:'New company',logo_url:''},request={requestId:crypto.randomUUID(),templateId:'business',slug:'new/alice',name:'Alice'};
 const one=await createCard(env,{id:'admin'},org,request),two=await createCard(env,{id:'admin'},org,request);assert.equal(one.id,two.id);assert(two.existing);
 await assert.rejects(()=>createCard(env,{id:'admin'},org,{...request,slug:'new/bob',templateId:'shasho'}),/available/);await assert.rejects(()=>createCard(env,{id:'admin'},org,{...request,slug:'api/alice'}),/permanent/);
 for(const format of ['svg','png']){const r=await qrResponse(new Request('https://nfc.admakidigital.com/new/alice/qr.'+format),{slug:request.slug},format);assert.equal(r.status,200);if(format==='png'){const image=PNG.sync.read(Buffer.from(await r.arrayBuffer()));assert.equal(jsQR(image.data,image.width,image.height).data,'https://nfc.admakidigital.com/new/alice/');}}
 const profile=JSON.parse(db.sqlite.prepare('SELECT published_json FROM cards').get().published_json),definition=JSON.parse(readFileSync('public/templates/business/1.json','utf8'));assert(renderTemplate(definition,profile).includes('Alice'));const withPhone=renderTemplate(definition,{...profile,phone:'+251911111111'});assert(withPhone.includes('tel:+251911111111'));assert(!withPhone.includes('template-example'));db.sqlite.close();
});
test('history archival retains payloads and a complete private backup restores into an empty isolated database',async()=>{
 const db=database(),media=bucket(),backups=bucket(),env={DB:db,MEDIA:media,BACKUPS:backups};const p=companies[0].profiles[0];db.sqlite.exec("INSERT INTO organizations(id,name) VALUES('test','Test');");
 db.sqlite.prepare("INSERT INTO cards(id,organization_id,slug,label,published_json,template_id) VALUES('card','test',?,'Card',?,'maison')").run(p.slug,JSON.stringify(p));
 for(let i=1;i<=24;i++)db.sqlite.prepare("INSERT INTO card_revisions(card_id,version,profile_json,template_id) VALUES('card',?,?,'maison')").run(i,JSON.stringify({...p,name:'Version '+i}));
 await archiveHistory(env,4);assert.equal(db.sqlite.prepare('SELECT count(*) n FROM card_revisions').get().n,20);assert.equal(JSON.parse((await archivedRevision(env,'card',1)).profile_json).name,'Version 1');
 await startBackup(env);for(let i=0;i<10;i++)await advanceBackups(env,8);const run=db.sqlite.prepare('SELECT * FROM operational_runs').get();assert.equal(run.status,'complete');const manifest=await(await backups.get(run.object_key+'manifest.json')).json();const target=database(),targetMedia=bucket();
 const read=async(name,type)=>{const object=await backups.get(run.object_key+name);const bytes=await object.arrayBuffer();return type==='text'?new TextDecoder().decode(bytes):bytes;};const result=await restoreBackup(manifest,read,target,targetMedia);assert.equal(result.objects,4);assert.equal(target.sqlite.prepare('SELECT count(*) n FROM card_revisions').get().n,20);assert.equal(targetMedia.map.size,4);await assert.rejects(()=>restoreBackup(manifest,read,target,targetMedia),/empty/);
 const corrupt=database();await assert.rejects(()=>restoreBackup(manifest,async(name,type)=>name==='table-0.json'?JSON.stringify({payload:'bad',sha256:'wrong'}):read(name,type),corrupt,bucket()),/integrity/);db.sqlite.close();target.sqlite.close();corrupt.sqlite.close();
});
test('1,000-company fixture uses indexed card lookup and bounded directory pages',()=>{
 const db=database(),start=performance.now();db.sqlite.exec('BEGIN');const org=db.sqlite.prepare('INSERT INTO organizations(id,name) VALUES(?,?)'),card=db.sqlite.prepare("INSERT INTO cards(id,organization_id,slug,label,published_json) VALUES(?,?,?,?,?)");for(let i=0;i<1000;i++){org.run('org'+i,'Company '+i);for(let j=0;j<2;j++)card.run('c'+i+'-'+j,'org'+i,'company-'+i+'/'+j,'Person '+j,'{}');}db.sqlite.exec('COMMIT');const plan=db.sqlite.prepare('EXPLAIN QUERY PLAN SELECT * FROM cards WHERE slug=?').all('company-999/1');assert(plan.some(r=>r.detail.includes('INDEX')));assert.equal(db.sqlite.prepare('SELECT id FROM cards ORDER BY updated_at DESC,slug LIMIT 24 OFFSET 24').all().length,24);console.log('Local 1,000-company / 2,000-card fixture inserted and queried in '+Math.round(performance.now()-start)+' ms; this is not an edge load benchmark.');db.sqlite.close();
});

test('compressed weak ETags revalidate and legacy photo revisions retain an embedded JPEG',async()=>{const profile=companies.find(c=>c.id==='shasho-kelbesa').profiles[0],card={id:'legacy',slug:profile.slug,version:1,published_json:JSON.stringify(profile)};const response=await publicCard(new Request('https://stage.example/'+profile.slug+'/'),{ASSETS:assets},card);const tag=response.headers.get('etag');assert.equal((await publicCard(new Request('https://stage.example/'+profile.slug+'/',{headers:{'if-none-match':'W/'+tag}}),{ASSETS:assets},card)).status,304);const photo=await embeddedPhoto({ASSETS:assets},{...profile,contactPhoto:'/profiles/shasho/ebise-portrait.webp'},'legacy');assert.equal(photo.type,'JPEG');assert(photo.base64.length>1000);});

test('GESAGIS release 2 retains corrected contacts and distinct WeChat QR while release 1 stays pinned',()=>{const p=companies.find(c=>c.id==='gesagis').profiles[0];const release=JSON.parse(readFileSync('public/templates/gesagis/2.json','utf8'));const document=new JSDOM(renderTemplate(release,p)).window.document;assert.equal(document.querySelector('.quick a').getAttribute('href'),'tel:+251902988591');assert.equal(document.querySelector('.contact-row:nth-child(2)').getAttribute('href'),'tel:+251927179289');assert.equal(document.querySelector('.wechat-action-primary').getAttribute('href'),p.wechatUrl);assert.equal(document.querySelector('.wechat-qr-preview img').getAttribute('src'),p.wechatQr);assert.equal(document.querySelector('#qr-dialog img').getAttribute('src'),'/gesagis/yeabtsega/qr.svg');const previous=JSON.parse(readFileSync('public/templates/gesagis/1.json','utf8'));assert.equal(previous.version,'1');assert(!previous.html.includes('wechat-section'));document.defaultView.close();});

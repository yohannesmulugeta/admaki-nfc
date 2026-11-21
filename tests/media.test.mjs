import assert from 'node:assert/strict';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../worker/index.js';
import {sha} from '../worker/auth.js';
import {cleanupMedia} from '../worker/media.js';
const db=new DatabaseSync(':memory:');
for(const file of ['0001_card_admin.sql','0002_card_history.sql','0003_card_media.sql','0004_company_branding.sql'])db.exec(readFileSync('migrations/'+file,'utf8'));
class Statement{constructor(sql,values=[]){this.sql=sql;this.values=values;}bind(...v){return new Statement(this.sql,v);}async first(){return db.prepare(this.sql).get(...this.values)||null;}async all(){return {results:db.prepare(this.sql).all(...this.values)};}async run(){return {meta:{changes:Number(db.prepare(this.sql).run(...this.values).changes)}};}}
const objects=new Map();let failPut=false,failDelete=false,throttle=false,beforeBatch;
const env={DB:{prepare:sql=>new Statement(sql),async batch(statements){if(beforeBatch){const fn=beforeBatch;beforeBatch=null;fn();}db.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());db.exec('COMMIT');return results;}catch(error){db.exec('ROLLBACK');throw error;}}},MEDIA_LIMITER:{limit:async()=>({success:!throttle})},MEDIA:{async put(key,data,options){if(failPut)throw Error('offline');objects.set(key,{data:new Uint8Array(data),options});return {key};},async delete(key){if(failDelete)throw Error('offline');objects.delete(key);},async get(key){const object=objects.get(key);return object?{body:new Response(object.data).body,size:object.data.length,httpEtag:'"fixture-etag"'}:null;},async head(key){const object=objects.get(key);return object?{size:object.data.length,httpEtag:'"fixture-etag"'}:null;}},ASSETS:{fetch:async()=>new Response('asset')}};
const tokens={owner:'1'.repeat(64),other:'2'.repeat(64),admin:'3'.repeat(64)};
for(const [name,token]of Object.entries(tokens)){
 db.prepare('INSERT INTO users(id,username,password_hash,password_salt,display_name,is_platform_admin) VALUES(?,?,?,?,?,?)').run(name,name,'unused','0'.repeat(64),name,name==='admin'?1:0);
 db.prepare("INSERT INTO sessions VALUES(?,?,datetime('now','+1 day'),CURRENT_TIMESTAMP)").run(await sha(token),name);
}
db.exec("INSERT INTO organizations(id,name) VALUES('maison','Maison'),('other','Other');INSERT INTO memberships VALUES('maison','owner','owner'),('other','other','owner')");
const original=JSON.parse(readFileSync('profiles/maison-debrah.json','utf8'));
for(const [id,slug]of [['card1','maison-debrah'],['card2','maison-debrah/02']]){const p={...original,slug};db.prepare('INSERT INTO cards(id,organization_id,slug,label,published_json) VALUES(?,?,?,?,?)').run(id,'maison',slug,id,JSON.stringify(p));db.prepare('INSERT INTO card_revisions VALUES(?,1,?,CURRENT_TIMESTAMP)').run(id,JSON.stringify(p));}
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB1cAAAAASUVORK5CYII=','base64');
async function call(path,{method='GET',data,user='owner',type='application/json',origin='https://stage.example'}={}){
 const headers={origin};if(user)headers.cookie='admaki_session='+tokens[user];if(data!==undefined)headers['content-type']=type;
 return worker.fetch(new Request('https://stage.example'+path,{method,headers,...(data===undefined?{}:{body:type==='application/json'?JSON.stringify(data):data})}),env);
}
const upload=(data=png,user='owner',type='image/png')=>call('/api/cards/card1/media',{method:'POST',data,user,type});
let image;
test('Card image uploads and lifecycle',async t=>{
 await t.test('uploads require login, correct tenant and origin',async()=>{
  assert.equal((await upload(png,null)).status,401);assert.equal((await upload(png,'other')).status,404);
  assert.equal((await call('/api/cards/card1/media',{method:'POST',data:png,type:'image/png',origin:'https://evil.example'})).status,403);
 });
 await t.test('rejects SVG, mismatched signatures, excessive bytes and dimensions',async()=>{
  assert.equal((await upload(Buffer.from('<svg/>'),'owner','image/svg+xml')).status,415);
  assert.equal((await upload(Buffer.from('not an image'))).status,415);
  assert.equal((await upload(new Uint8Array(5*1024*1024+1))).status,413);
  const large=Buffer.from(png);large.writeUInt32BE(9000,16);assert.equal((await upload(large)).status,413);
 });
 await t.test('accepts PNG, JPEG and WebP with server-selected content types',async()=>{
  const first=await upload();assert.equal(first.status,201);image=await first.json();assert.match(image.url,/^\/media\/[a-f0-9-]{36}\.png$/);
  assert.equal(image.width,1);assert.equal(objects.size,1);
  for(const [file,type]of [['public/profiles/maison-debrah/contact-logo.jpg','image/jpeg'],['public/profiles/maison-debrah/showroom.webp','image/webp']])assert.equal((await upload(readFileSync(file),'owner',type)).status,201);
 });
 await t.test('unpublished media is private even with a known URL; HEAD does not leak',async()=>{
  assert.equal((await call(image.url,{user:null})).status,404);assert.equal((await call(image.url,{user:'other'})).status,404);assert.equal((await call(image.url,{method:'HEAD',user:null})).status,404);
  const response=await call(image.url);assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual(Buffer.from(await response.arrayBuffer()),png);
  assert.equal((await call(image.url,{user:'admin'})).status,200);
 });
 await t.test('card owners list only their images; storage keys stay on the server',async()=>{
  const response=await call('/api/cards/card1/media');const data=await response.json();assert(data.enabled);assert.equal(data.media.length,3);assert(!JSON.stringify(data).includes('organizations/'));assert.equal((await call('/api/cards/card1/media',{user:'other'})).status,404);
 });
 await t.test('another card cannot save this upload as its media',async()=>{
  const p={...original,slug:'maison-debrah/02',cover:image.url};assert.equal((await call('/api/cards/card2/draft',{method:'PUT',data:{version:1,profile:p}})).status,400);
 });
 await t.test('draft saving keeps the image private and protects it from removal',async()=>{
  const p={...original,cover:image.url};assert.equal((await call('/api/cards/card1/draft',{method:'PUT',data:{version:1,profile:p}})).status,200);
  assert.equal((await call(image.url,{user:null})).status,404);assert.equal((await call('/api/cards/card1/media/'+image.id,{method:'DELETE'})).status,409);
 });
 await t.test('publishing releases the image without modifying other cards',async()=>{
  assert.equal((await call('/api/cards/card1/publish',{method:'POST',data:{version:2}})).status,200);assert.equal((await call(image.url,{user:null})).status,200);
  assert.equal((await(await call('/api/cards/card2')).json()).published.cover,original.cover);
 });
 await t.test('rollback makes old media private but retains it for saved history',async()=>{
  assert.equal((await call('/api/cards/card1/rollback',{method:'POST',data:{version:3,targetVersion:1}})).status,200);
  assert.equal((await call(image.url,{user:null})).status,404);assert.equal((await call('/api/cards/card1/media/'+image.id,{method:'DELETE'})).status,409);
  db.prepare("UPDATE media_assets SET created_at=datetime('now','-10 days') WHERE id=?").run(image.id);await cleanupMedia(env);assert(db.prepare('SELECT id FROM media_assets WHERE id=?').get(image.id));
 });
 await t.test('unused images can be deleted; other tenants cannot delete them',async()=>{
  const next=await(await upload()).json();assert.equal((await call('/api/cards/card1/media/'+next.id,{method:'DELETE',user:'other'})).status,404);
  assert.equal((await call('/api/cards/card1/media/'+next.id,{method:'DELETE'})).status,200);assert.equal((await call(next.url)).status,404);
 });
 await t.test('a cleanup race cannot save an image marked for deletion',async()=>{
  const next=await(await upload()).json();beforeBatch=()=>db.prepare("UPDATE media_assets SET status='deleting' WHERE id=?").run(next.id);
  const r=await call('/api/cards/card1/draft',{method:'PUT',data:{version:4,profile:{...original,cover:next.url}}});assert.equal(r.status,409);assert.equal(db.prepare("SELECT version FROM cards WHERE id='card1'").get().version,4);
 });
 await t.test('failed writes compensate R2 and D1 reservations',async()=>{
  const count=db.prepare('SELECT count(*) n FROM media_assets').get().n;failPut=true;assert.equal((await upload()).status,503);failPut=false;assert.equal(db.prepare('SELECT count(*) n FROM media_assets').get().n,count);
 });
 await t.test('a failed delete remains retryable and cannot be referenced',async()=>{
  const next=await(await upload()).json();failDelete=true;assert.equal((await call('/api/cards/card1/media/'+next.id,{method:'DELETE'})).status,503);failDelete=false;
  assert.equal((await call('/api/cards/card1/draft',{method:'PUT',data:{version:4,profile:{...original,cover:next.url}}})).status,400);
  assert.equal((await call('/api/cards/card1/media/'+next.id,{method:'DELETE'})).status,200);
 });
 await t.test('cleanup deletes stale unused media and recovers pending uploads',async()=>{
  const next=await(await upload()).json();db.prepare("UPDATE media_assets SET created_at=datetime('now','-10 days') WHERE id=?").run(next.id);
  await cleanupMedia(env);assert(!db.prepare('SELECT id FROM media_assets WHERE id=?').get(next.id));
  failPut=true;failDelete=true;assert.equal((await upload()).status,503);failPut=false;failDelete=false;
  const pending=db.prepare("SELECT id FROM media_assets WHERE status='pending'").get();assert(pending);db.prepare("UPDATE media_assets SET created_at=datetime('now','-2 days') WHERE id=?").run(pending.id);await cleanupMedia(env);assert(!db.prepare('SELECT id FROM media_assets WHERE id=?').get(pending.id));
  assert(db.prepare('SELECT id FROM media_assets WHERE id=?').get(image.id));
 });
 await t.test('quotas count pending reservations and uploads are rate limited',async()=>{
  const statement=db.prepare("INSERT INTO media_assets(id,organization_id,card_id,created_by,object_key,public_path,content_type,byte_size) VALUES(?,'maison','card2','owner',?,?,'image/png',5242880)");
  for(let i=0;i<20;i++)statement.run('quota'+i,'quota/'+i,'/media/quota'+i);assert.equal((await upload()).status,409);
  db.exec("DELETE FROM media_assets WHERE id GLOB 'quota*'");throttle=true;assert.equal((await upload()).status,429);throttle=false;
 });
 await t.test('disabled R2 advertises unavailability and leaves card editing working',async()=>{
  const bucket=env.MEDIA;delete env.MEDIA;assert.equal((await(await call('/api/cards/card1/media')).json()).enabled,false);assert.equal((await upload()).status,503);assert.equal((await call('/api/cards/card1')).status,200);env.MEDIA=bucket;
 });
});

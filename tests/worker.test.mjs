import {assets} from './helpers.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from '../worker/index.js';
import { derive, equalHash, ITERATIONS } from '../worker/auth.js';
const sqlite=new DatabaseSync(':memory:');
sqlite.exec(readFileSync('migrations/0001_card_admin.sql','utf8'));
sqlite.exec(readFileSync('migrations/0002_card_history.sql','utf8'));
sqlite.exec(readFileSync('migrations/0003_card_media.sql','utf8'));
for(const f of ['0004_company_branding.sql','0005_platform_templates.sql','0006_storage_policy.sql','0007_admin_mfa.sql'])sqlite.exec(readFileSync('migrations/'+f,'utf8'));
class Statement {
  constructor(sql,values=[]){this.sql=sql;this.values=values;}
  bind(...values){return new Statement(this.sql,values);}
  async first(){return sqlite.prepare(this.sql).get(...this.values)||null;}
  async all(){return {results:sqlite.prepare(this.sql).all(...this.values)};}
  async run(){const result=sqlite.prepare(this.sql).run(...this.values);return {meta:{changes:Number(result.changes)}};}
}
const env={AUTH_PEPPER:'test-only-pepper-not-for-production',DB:{prepare:sql=>new Statement(sql),async batch(statements){sqlite.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sqlite.exec('COMMIT');return results;}catch(error){sqlite.exec('ROLLBACK');throw error;}}},LOGIN_LIMITER:{limit:async()=>({success:true})},ASSETS:assets};
const password='Unique-test-password-903!';
const salt='a'.repeat(64),hash=await derive(password,salt,ITERATIONS,env.AUTH_PEPPER);
for(const [id,admin]of [['owner',0],['other',0],['admin',1]])sqlite.prepare('INSERT INTO users(id,username,display_name,password_hash,password_salt,password_iterations,is_platform_admin) VALUES(?,?,?,?,?,?,?)').run(id,id,id,hash,salt,ITERATIONS,admin);
for(const id of ['maison-debrah','elsewhere'])sqlite.prepare('INSERT INTO organizations(id,name) VALUES(?,?)').run(id,id);
sqlite.exec("INSERT INTO memberships VALUES('maison-debrah','owner','owner'),('elsewhere','other','owner')");
const profile=JSON.parse(readFileSync('profiles/maison-debrah.json','utf8'));
for(let i=1;i<=4;i++){const p={...profile,slug:i===1?'maison-debrah':'maison-debrah/0'+i};sqlite.prepare('INSERT INTO cards(id,organization_id,slug,label,published_json) VALUES(?,?,?,?,?)').run('card'+i,'maison-debrah',p.slug,'Card '+i,JSON.stringify(p));sqlite.prepare('INSERT INTO card_revisions(card_id,version,profile_json) VALUES(?,1,?)').run('card'+i,JSON.stringify(p));}
let owner,other,admin;
async function request(path,method='GET',data,cookie,origin='https://stage.example'){
  const headers={origin};if(data!==undefined)headers['content-type']='application/json';if(cookie)headers.cookie=cookie;
  return worker.fetch(new Request('https://stage.example'+path,{method,headers,...(data===undefined?{}:{body:JSON.stringify(data)})}),env);
}
async function signIn(username){const r=await request('/api/auth/login','POST',{username,password});assert.equal(r.status,200);assert.match(r.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);return r.headers.get('set-cookie').split(';')[0];}
test('Phase 1 authentication and card operations',async t=>{
  await t.test('password comparison and pepper separation',async()=>{assert.equal(await equalHash(hash,hash),true);assert.equal(await equalHash(hash,'0'.repeat(64)),false);assert.notEqual(await derive(password,salt,ITERATIONS,'different-pepper'),hash);});
  await t.test('CSRF blocked and malformed bodies handled',async()=>{assert.equal((await request('/api/auth/login','POST',{username:'owner',password},null,'https://evil.example')).status,403);const r=await worker.fetch(new Request('https://stage.example/api/auth/login',{method:'POST',headers:{origin:'https://stage.example','content-type':'application/json'},body:'{'}),env);assert.equal(r.status,400);});
  await t.test('wrong password rejected',async()=>assert.equal((await request('/api/auth/login','POST',{username:'owner',password:'wrong'})).status,401));
  await t.test('admin can sign in without tenant membership',async()=>{owner=await signIn('owner');other=await signIn('other');admin=await signIn('admin');assert.equal((await request('/api/admin/organizations','GET',undefined,admin)).status,200);});
  await t.test('client cannot call admin API or read another tenant',async()=>{assert.equal((await request('/api/admin/organizations','GET',undefined,owner)).status,403);assert.equal((await request('/api/cards/card1','GET',undefined,other)).status,404);assert.equal((await request('/api/cards/card1/draft','PUT',{version:1,profile},other)).status,404);});
  await t.test('dashboard metadata is scoped and admin card directory is protected',async()=>{
    assert.equal((await request('/api/admin/cards')).status,401);
    assert.equal((await request('/api/admin/cards','GET',undefined,owner)).status,403);
    const directory=await(await request('/api/admin/cards','GET',undefined,admin)).json();
    assert.equal(directory.cards.length,4);assert.equal(directory.cards[0].cover,profile.cover);
    assert.equal(directory.cards[0].organization_id,'maison-debrah');assert(!('published_json' in directory.cards[0]));
    const mine=await(await request('/api/cards?organization=elsewhere','GET',undefined,owner)).json();
    assert.equal(mine.cards.length,4);assert.equal(mine.organization,'maison-debrah');
    const theirs=await(await request('/api/cards?organization=maison-debrah','GET',undefined,other)).json();assert.equal(theirs.cards.length,0);
  });
  await t.test('anonymous cannot read draft and public API has no drafts',async()=>{assert.equal((await request('/api/cards/card1')).status,401);const r=await request('/api/public/cards/maison-debrah');const data=await r.json();assert(!('draft'in data));assert.equal((await request('/api/public/cards/elsewhere')).status,404);});
  await t.test('unsafe links, protocol-relative images and slug edits rejected',async()=>{for(const change of [{website:'javascript:alert(1)'},{cover:'//evil.example/a.png'},{slug:'elsewhere'}])assert.equal((await request('/api/cards/card1/draft','PUT',{version:1,profile:{...profile,...change}},owner)).status,400);});
  await t.test('draft stays private; stale version conflicts',async()=>{const edited={...profile,name:'New published name',phone:'+251911111111',contactAddress:{...profile.contactAddress,street:'Test street'}};assert.equal((await request('/api/cards/card1/draft','PUT',{version:1,profile:edited},owner)).status,200);assert.equal((await request('/api/cards/card1/draft','PUT',{version:1,profile:edited},owner)).status,409);assert.equal((await(await request('/api/public/cards/maison-debrah')).json()).profile.name,profile.name);});
  await t.test('publishing updates only chosen card, vCard and audit',async()=>{assert.equal((await request('/api/cards/card1/publish','POST',{version:2},owner)).status,200);assert.equal((await(await request('/api/public/cards/maison-debrah')).json()).profile.name,'New published name');assert.equal((await(await request('/api/cards/card2','GET',undefined,owner)).json()).published.name,profile.name);const vcf=await(await request('/maison-debrah/contact.vcf')).text();assert.match(vcf,/FN:New published name/);assert.match(vcf,/TEL;TYPE=WORK,VOICE:\+251911111111/);assert.match(vcf,/Test street/);for(const line of vcf.split('\r\n'))assert(Buffer.byteLength(line)<=75);assert.equal(sqlite.prepare("SELECT count(*) n FROM audit_events WHERE action='card.publish'").get().n,1);});
  await t.test('history and rollback preserve permanent slug',async()=>{const data=await(await request('/api/cards/card1/history','GET',undefined,owner)).json();assert.equal(data.revisions.length,2);assert.equal((await request('/api/cards/card1/rollback','POST',{version:3,targetVersion:1},owner)).status,200);const current=await(await request('/api/cards/card1','GET',undefined,owner)).json();assert.equal(current.published.name,profile.name);assert.equal(current.slug,profile.slug);assert.equal(current.version,4);});
  await t.test('admin creates company/account and manages cards',async()=>{assert.equal((await request('/api/cards/card2','GET',undefined,admin)).status,200);assert.equal((await request('/api/admin/organizations','POST',{name:'New company'},admin)).status,201);assert.equal((await request('/api/admin/organizations/maison-debrah/users','POST',{username:'newclient',displayName:'New Client',password},admin)).status,201);assert.equal((await signIn('newclient')).startsWith('admaki_session='),true);});
  await t.test('future-company cards publish through the shared API with tenant isolation',async()=>{
    const p={slug:'future-company/alice',source:'Test fixture',theme:'business',name:'Alice',organization:'Future company',phone:'+251911111111',email:'alice@example.test',website:'https://example.test/'};
    sqlite.prepare('INSERT INTO cards(id,organization_id,slug,label,published_json) VALUES(?,?,?,?,?)').run('future-card','elsewhere',p.slug,p.name,JSON.stringify(p));
    assert.equal((await request('/api/cards/future-card','GET',undefined,owner)).status,404);
    assert.equal((await request('/api/cards/future-card/draft','PUT',{version:1,profile:{...p,name:'Updated Alice'}},other)).status,200);
    assert.equal((await(await request('/api/public/cards/'+p.slug)).json()).profile.name,'Alice');
    assert.equal((await request('/api/cards/future-card/publish','POST',{version:2},other)).status,200);
    assert.equal((await(await request('/api/public/cards/'+p.slug)).json()).profile.name,'Updated Alice');
    assert.match(await(await request('/'+p.slug+'/contact.vcf')).text(),/FN:Updated Alice/);
    assert.equal((await(await request('/api/cards/card2','GET',undefined,owner)).json()).published.name,profile.name);
  });
  await t.test('company branding uses a shared default, validates contrast and requires admin access',async()=>{
    assert.equal((await request('/api/admin/organizations/elsewhere','PATCH',{name:'Other company',logo:'/brand/admaki-logo.svg',accent:'#012483'},other)).status,403);
    assert.equal((await request('/api/admin/organizations/elsewhere','PATCH',{name:'Other company',accent:'#ffffff'},admin)).status,400);
    assert.equal((await request('/api/admin/organizations/elsewhere','PATCH',{name:'Other company',logo:'javascript:alert(1)'},admin)).status,400);
    assert.equal((await request('/api/admin/organizations/elsewhere','PATCH',{name:'Other company',logo:'/brand/admaki-logo.svg',accent:'#012483'},admin)).status,200);
    const data=await(await request('/api/cards','GET',undefined,other)).json();assert.equal(data.branding.logo,'/brand/admaki-logo.svg');assert.equal(data.branding.accent,'#012483');assert.equal(data.organization,'Other company');
    const mine=await(await request('/api/cards','GET',undefined,owner)).json();assert.equal(mine.branding.accent,'#2563eb');
  });
  await t.test('admin reset revokes client sessions',async()=>{assert.equal((await request('/api/admin/organizations/maison-debrah/users/owner/password','POST',{password:'Replacement-password-472!'},admin)).status,200);assert.equal((await request('/api/cards','GET',undefined,owner)).status,401);});
  await t.test('password change revokes all sessions and logout clears cookie',async()=>{assert.equal((await request('/api/auth/password','POST',{currentPassword:password,newPassword:'Other-new-password-472!'},other)).status,200);assert.equal((await request('/api/cards','GET',undefined,other)).status,401);const r=await request('/api/auth/logout','POST',{},admin);assert.match(r.headers.get('set-cookie'),/Max-Age=0/);assert.equal((await request('/api/admin/organizations','GET',undefined,admin)).status,401);});
  await t.test('edge limiter fails closed',async()=>{env.LOGIN_LIMITER={limit:async()=>({success:false})};assert.equal((await request('/api/auth/login','POST',{username:'owner',password})).status,429);});
});

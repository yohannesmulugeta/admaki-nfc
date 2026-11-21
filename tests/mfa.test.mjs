import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import worker from '../worker/index.js';
import {derive,ITERATIONS} from '../worker/auth.js';
import {base32,totp,matchStep,seal,unseal} from '../worker/mfa.js';
import {assets} from './helpers.mjs';
test('RFC 6238 vectors, replay windows and account-bound authenticated encryption',async()=>{
 const secret=base32(new TextEncoder().encode('12345678901234567890'));
 for(const [seconds,expected]of [[59,'94287082'],[1111111109,'07081804'],[1111111111,'14050471'],[1234567890,'89005924'],[2000000000,'69279037']])assert.equal(await totp(secret,Math.floor(seconds/30),8),expected);
 const code=await totp(secret,100);assert.equal(await matchStep(secret,code,-1,3000000),100);assert.equal(await matchStep(secret,code,100,3000000),null);assert.equal(await matchStep(secret,'000',-1,3000000),null);
 const cipher=await seal(secret,'test-pepper','owner');assert(!cipher.includes(secret));assert.equal(await unseal(cipher,'test-pepper','owner'),secret);await assert.rejects(()=>unseal(cipher,'other-pepper','owner'));await assert.rejects(()=>unseal(cipher,'test-pepper','other-user'));
});
test('administrator enrollment, two-step sign-in, single-use recovery, expiry and session revocation',async()=>{
 const sqlite=new DatabaseSync(':memory:');for(const file of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync('migrations/'+file,'utf8'));
 class S{constructor(q,v=[]){this.q=q;this.v=v;}bind(...v){return new S(this.q,v);}async first(){return sqlite.prepare(this.q).get(...this.v)||null;}async all(){return {results:sqlite.prepare(this.q).all(...this.v)};}async run(){return {meta:{changes:Number(sqlite.prepare(this.q).run(...this.v).changes)}};}}
 let beforeBatch;const env={AUTH_PEPPER:'test-only-pepper',ASSETS:assets,DB:{prepare:q=>new S(q),async batch(list){if(beforeBatch){const hook=beforeBatch;beforeBatch=null;hook();}sqlite.exec('BEGIN');try{const out=[];for(const s of list)out.push(await s.run());sqlite.exec('COMMIT');return out;}catch(e){sqlite.exec('ROLLBACK');throw e;}}},LOGIN_LIMITER:{limit:async()=>({success:true})}};
 const password='A-unique-test-password-845!',salt='b'.repeat(64),hash=await derive(password,salt,ITERATIONS,env.AUTH_PEPPER);for(const [id,admin]of [['owner',1],['client',0]])sqlite.prepare('INSERT INTO users(id,username,display_name,password_hash,password_salt,password_iterations,is_platform_admin) VALUES(?,?,?,?,?,?,?)').run(id,id,id,hash,salt,ITERATIONS,admin);
 async function call(path,method='GET',body,cookie,origin='https://stage.example'){return worker.fetch(new Request('https://stage.example/api'+path,{method,headers:{origin,...(cookie?{cookie}:{}),...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}),env);}
 async function login(otp,username='owner'){return call('/auth/login','POST',{username,password,...(otp?{otp}:{})});}
 const cookie=r=>r.headers.get('set-cookie').split(';')[0];let admin=cookie(await login()),client=cookie(await login(undefined,'client'));
 assert.equal((await call('/auth/mfa')).status,401);assert.equal((await call('/auth/mfa','GET',undefined,client)).status,403);assert.equal((await call('/auth/mfa/begin','POST',{password},admin,'https://evil.example')).status,403);
 assert.equal((await call('/auth/mfa/begin','POST',{password:'wrong'},admin)).status,403);
 let begin=await call('/auth/mfa/begin','POST',{password},admin);assert.equal(begin.status,200);assert.equal(begin.headers.get('cache-control'),'no-store');let setup=await begin.json();assert(setup.uri.startsWith('otpauth://totp/'));assert(setup.qr.includes('<svg'));assert.equal(sqlite.prepare("SELECT mfa_secret_cipher FROM users WHERE id='owner'").get().mfa_secret_cipher,null);
 sqlite.exec("UPDATE users SET mfa_pending_expires_at=1 WHERE id='owner'");assert.equal((await call('/auth/mfa/enable','POST',{password,code:'000000'},admin)).status,400);
 setup=await(await call('/auth/mfa/begin','POST',{password},admin)).json();const step=Math.floor(Date.now()/30000);assert.equal((await call('/auth/mfa/enable','POST',{password,code:'wrong'},admin)).status,400);
 const enabled=await call('/auth/mfa/enable','POST',{password,code:await totp(setup.secret,step)},admin);assert.equal(enabled.status,200);const codes=(await enabled.json()).recoveryCodes;assert.equal(codes.length,10);assert.equal(new Set(codes).size,10);const row=sqlite.prepare("SELECT * FROM users WHERE id='owner'").get();assert(!row.mfa_recovery_json.includes(codes[0]));assert(!row.mfa_secret_cipher.includes(setup.secret));assert.equal((await call('/auth/me','GET',undefined,admin)).status,401);
 const required=await login();assert.equal(required.status,401);assert.equal((await required.json()).mfaRequired,true);assert.equal((await login('00000')).status,401);
 const nextCode=await totp(setup.secret,step+1),success=await login(nextCode);assert.equal(success.status,200);assert.equal((await login(nextCode)).status,401);
 const recovery=await login(codes[0]);assert.equal(recovery.status,200);admin=cookie(recovery);assert.equal((await login(codes[0])).status,401);const status=await(await call('/auth/mfa','GET',undefined,admin)).json();assert.deepEqual(status,{enabled:true,recoveryCodesRemaining:9});
 assert.equal((await call('/auth/mfa/disable','POST',{password:'wrong',code:codes[1]},admin)).status,403);assert.equal((await call('/auth/mfa/disable','POST',{password,code:codes[1]},admin)).status,200);assert.equal((await call('/auth/me','GET',undefined,admin)).status,401);assert.equal((await login()).status,200);
 beforeBatch=()=>sqlite.prepare("UPDATE users SET mfa_secret_cipher='concurrent-enrollment' WHERE id='owner'").run();const race=await login();assert.equal(race.status,409);assert(!race.headers.has('set-cookie'));sqlite.close();
});

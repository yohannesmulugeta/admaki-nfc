import {buildSync} from 'esbuild';
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {sha} from '../worker/auth.js';
test('Real Workers runtime persists media in D1/R2 and controls public visibility',async()=>{
 const options=convertV4MiniflareOptions({name:'nfc-media-runtime',routes:['stage.example/*'],modules:[{type:'ESModule',path:'index.js',contents:buildSync({entryPoints:['worker/index.js'],bundle:true,write:false,format:'esm',platform:'browser'}).outputFiles[0].text}],modulesRoot:'.',compatibilityDate:'2026-11-20',d1Databases:['DB'],r2Buckets:['MEDIA'],ratelimits:{MEDIA_LIMITER:{namespace_id:'1012',simple:{limit:10,period:60}}},assets:{directory:'public',binding:'ASSETS',run_worker_first:true}});
 options.workers[0].config.exports={default:{type:'worker'}};
 const mf=new Miniflare(options);
 try{
  const db=await mf.getD1Database('DB');
 const runtimeFetch=(url,options)=>mf.dispatchFetch(url,options);
  for(const file of ['0001_card_admin.sql','0002_card_history.sql','0003_card_media.sql','0004_company_branding.sql','0005_platform_templates.sql','0006_storage_policy.sql']){
   const sql=readFileSync('migrations/'+file,'utf8').replace(/--[^\n]*/g,'');
   for(const statement of sql.split(';').filter(x=>x.trim()))await db.prepare(statement).run();
  }
  const profile=JSON.parse(readFileSync('profiles/maison-debrah.json','utf8')),token='4'.repeat(64);
  await db.batch([
   db.prepare("INSERT INTO organizations(id,name) VALUES('maison','Maison')"),
   db.prepare("INSERT INTO users(id,username,password_hash,password_salt,display_name) VALUES('owner','owner','unused','unused','Owner')"),
   db.prepare("INSERT INTO memberships VALUES('maison','owner','owner')"),
   db.prepare("INSERT INTO cards(id,organization_id,slug,label,published_json) VALUES('card1','maison','maison-debrah','Card 1',?)").bind(JSON.stringify(profile)),
   db.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,'owner',datetime('now','+1 day'))").bind(await sha(token))
  ]);
  const headers={origin:'https://stage.example',cookie:'admaki_session='+token};
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB1cAAAAASUVORK5CYII=','base64');
  const uploaded=await runtimeFetch('https://stage.example/api/cards/card1/media',{method:'POST',headers:{...headers,'content-type':'image/png'},body:png});assert.equal(uploaded.status,201,await uploaded.clone().text());
  const image=await uploaded.json();const bucket=await mf.getR2Bucket('MEDIA');const row=await db.prepare('SELECT * FROM media_assets WHERE id=?').bind(image.id).first();assert.equal(row.status,'ready');assert.deepEqual(Buffer.from(await(await bucket.get(row.object_key)).arrayBuffer()),png);
  assert.equal((await runtimeFetch('https://stage.example'+image.url)).status,404);
  const preview=await runtimeFetch('https://stage.example'+image.url,{headers});assert.equal(preview.status,200);assert.equal(preview.headers.get('x-content-type-options'),'nosniff');
  const save=await runtimeFetch('https://stage.example/api/cards/card1/draft',{method:'PUT',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({version:1,profile:{...profile,cover:image.url}})});assert.equal(save.status,200,await save.clone().text());
  assert.equal((await runtimeFetch('https://stage.example'+image.url)).status,404);
  const publish=await runtimeFetch('https://stage.example/api/cards/card1/publish',{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({version:2})});assert.equal(publish.status,200,await publish.clone().text());
  const publicImage=await runtimeFetch('https://stage.example'+image.url);assert.equal(publicImage.status,200);assert.deepEqual(Buffer.from(await publicImage.arrayBuffer()),png);
  const protectedDelete=await runtimeFetch('https://stage.example/api/cards/card1/media/'+image.id,{method:'DELETE',headers});assert.equal(protectedDelete.status,409);
  const dashboard=await runtimeFetch('https://stage.example/dashboard/');assert.equal(dashboard.status,200);assert.match(await dashboard.text(),/Uploaded images/);
 }finally{await mf.dispose();}
});

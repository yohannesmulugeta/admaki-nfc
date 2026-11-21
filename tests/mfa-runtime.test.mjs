import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
test('authenticator encryption and QR generation work in the actual Cloudflare runtime',async()=>{
 const script=buildSync({stdin:{contents:`import {base32,totp,seal,unseal} from './worker/mfa.js';import {privateQr} from './worker/qr.js';export default {async fetch(){const secret=base32(new TextEncoder().encode('12345678901234567890'));const cipher=await seal(secret,'test-only-pepper','admin');return Response.json({code:await totp(secret,1,8),roundtrip:await unseal(cipher,'test-only-pepper','admin')===secret,qr:privateQr('otpauth://totp/TEST?secret='+secret).startsWith('<svg')});}};`,resolveDir:process.cwd(),sourcefile:'mfa-runtime-fixture.js'},bundle:true,write:false,format:'esm',platform:'browser'}).outputFiles[0].text;
 const options=convertV4MiniflareOptions({name:'mfa-runtime',modules:[{type:'ESModule',path:'index.js',contents:script}],modulesRoot:'.',compatibilityDate:'2026-11-20'});options.workers[0].config.exports={default:{type:'worker'}};const mf=new Miniflare(options);try{const r=await mf.dispatchFetch('https://test.example/');assert.equal(r.status,200);assert.deepEqual(await r.json(),{code:'94287082',roundtrip:true,qr:true});}finally{await mf.dispose();}
});

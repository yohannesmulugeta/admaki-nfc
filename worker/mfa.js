import {sha,equalHash} from './auth.js';
// RFC 6238 TOTP. Secrets are encrypted at rest with an account-bound AES-GCM key.
const encoder=new TextEncoder(),alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
export function base32(bytes){let bits=0,value=0,out='';for(const byte of bytes){value=(value<<8)|byte;bits+=8;while(bits>=5){out+=alphabet[(value>>>(bits-5))&31];bits-=5;}}if(bits)out+=alphabet[(value<<(5-bits))&31];return out;}
function decode(value){let bits=0,current=0,out=[];for(const c of value){const n=alphabet.indexOf(c);if(n<0)throw Error('Invalid authenticator secret');current=(current<<5)|n;bits+=5;if(bits>=8){out.push((current>>>(bits-8))&255);bits-=8;}}return new Uint8Array(out);}
export async function totp(secret,step,digits=6){const key=await crypto.subtle.importKey('raw',decode(secret),{name:'HMAC',hash:'SHA-1'},false,['sign']),counter=new Uint8Array(8);new DataView(counter.buffer).setBigUint64(0,BigInt(step));const digest=new Uint8Array(await crypto.subtle.sign('HMAC',key,counter)),offset=digest.at(-1)&15,number=new DataView(digest.buffer).getUint32(offset)&0x7fffffff;return String(number%10**digits).padStart(digits,'0');}
export async function matchStep(secret,code,lastStep=-1,time=Date.now()){if(!/^[0-9]{6}$/.test(String(code)))return null;const step=Math.floor(time/30000);for(const delta of [0,-1,1]){const candidate=step+delta;if(candidate<=Number(lastStep??-1))continue;const expected=await totp(secret,candidate);if(await equalHash(await sha(expected),await sha(code)))return candidate;}return null;}
async function encryptionKey(pepper){if(!pepper)fail('Account service not configured',503);return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',encoder.encode('ADMAKI-MFA-v1\0'+pepper)),{name:'AES-GCM'},false,['encrypt','decrypt']);}
const encode64=bytes=>btoa(String.fromCharCode(...bytes));
const decode64=text=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));
export async function seal(secret,pepper,userId){const iv=crypto.getRandomValues(new Uint8Array(12)),cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(userId)},await encryptionKey(pepper),encoder.encode(secret));return encode64(iv)+'.'+encode64(new Uint8Array(cipher));}
export async function unseal(value,pepper,userId){const [iv,cipher]=value.split('.');return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:decode64(iv),additionalData:encoder.encode(userId)},await encryptionKey(pepper),decode64(cipher)));}
export async function recoveryHash(code,pepper,userId){const key=await crypto.subtle.importKey('raw',encoder.encode(pepper),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode('ADMAKI-recovery\0'+userId+'\0'+code)))).map(b=>b.toString(16).padStart(2,'0')).join('');}
export async function consumeFactor(env,user,code){
 code=String(code||'').trim();if(!user.mfa_secret_cipher)return true;
 if(/^[0-9]{6}$/.test(code)){const secret=await unseal(user.mfa_secret_cipher,env.AUTH_PEPPER,user.id),step=await matchStep(secret,code,user.mfa_last_step);if(step===null)return false;const result=await env.DB.prepare('UPDATE users SET mfa_last_step=? WHERE id=? AND mfa_secret_cipher=? AND (mfa_last_step IS NULL OR mfa_last_step<?)').bind(step,user.id,user.mfa_secret_cipher,step).run();return !!result.meta.changes;}
 const normalized=code.replace(/[ -]/g,'').toUpperCase();if(!/^[A-F0-9]{32}$/.test(normalized))return false;const hashes=JSON.parse(user.mfa_recovery_json),hash=await recoveryHash(normalized,env.AUTH_PEPPER,user.id);let index=-1;for(let i=0;i<hashes.length;i++)if(await equalHash(hashes[i],hash)){index=i;break;}if(index<0)return false;hashes.splice(index,1);
 const result=await env.DB.prepare('UPDATE users SET mfa_recovery_json=? WHERE id=? AND mfa_recovery_json=? AND mfa_secret_cipher=?').bind(JSON.stringify(hashes),user.id,user.mfa_recovery_json,user.mfa_secret_cipher).run();return !!result.meta.changes;
}
export async function mfaAction(env,user,data,action,verifyPassword){
 if(!user.is_platform_admin)fail('Forbidden',403);
 const audit=action=>env.DB.prepare('INSERT INTO security_events(id,actor_user_id,action) VALUES(?,?,?)').bind(crypto.randomUUID(),user.id,'auth.mfa.'+action);
 const record=await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(user.id).first();
 if(!record?.is_platform_admin)fail('Forbidden',403);
 if(action==='status')return {enabled:!!record.mfa_secret_cipher,recoveryCodesRemaining:JSON.parse(record.mfa_recovery_json).length};
 if(!await verifyPassword(record,String(data.password||'')))fail('Current password incorrect',403);
 if(action==='begin'){
  if(record.mfa_secret_cipher)fail('Two-step verification is already enabled',409);
  const secret=base32(crypto.getRandomValues(new Uint8Array(20))),cipher=await seal(secret,env.AUTH_PEPPER,user.id);
  const updated=await env.DB.batch([env.DB.prepare('UPDATE users SET mfa_pending_cipher=?,mfa_pending_expires_at=? WHERE id=? AND password_hash=? AND mfa_secret_cipher IS NULL').bind(cipher,Math.floor(Date.now()/1000)+600,user.id,record.password_hash),audit('begin')]);if(!updated[0].meta.changes)fail('Account changed. Start again.',409);
  return {secret,uri:'otpauth://totp/'+encodeURIComponent('ADMAKI Digital:'+record.username)+'?secret='+secret+'&issuer=ADMAKI%20Digital&digits=6&period=30'};
 }
 if(action==='enable'){
  if(record.mfa_secret_cipher||!record.mfa_pending_cipher||record.mfa_pending_expires_at<Math.floor(Date.now()/1000))fail('Setup expired. Start again.');
  const secret=await unseal(record.mfa_pending_cipher,env.AUTH_PEPPER,user.id),step=await matchStep(secret,String(data.code||''));if(step===null)fail('Enter the current six-digit authenticator code');
  const recoveryCodes=Array.from({length:10},()=>Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b=>b.toString(16).padStart(2,'0')).join('').toUpperCase()),hashes=[];for(const code of recoveryCodes)hashes.push(await recoveryHash(code,env.AUTH_PEPPER,user.id));
  const result=await env.DB.batch([
   env.DB.prepare('UPDATE users SET mfa_secret_cipher=mfa_pending_cipher,mfa_pending_cipher=NULL,mfa_pending_expires_at=NULL,mfa_last_step=?,mfa_recovery_json=? WHERE id=? AND mfa_pending_cipher=? AND mfa_secret_cipher IS NULL AND password_hash=?').bind(step,JSON.stringify(hashes),user.id,record.mfa_pending_cipher,record.password_hash),
   env.DB.prepare('DELETE FROM sessions WHERE user_id=? AND EXISTS(SELECT 1 FROM users WHERE id=? AND mfa_secret_cipher=?)').bind(user.id,user.id,record.mfa_pending_cipher),audit('enable')
  ]);if(!result[0].meta.changes)fail('Account changed. Start again.',409);return {enabled:true,recoveryCodes};
 }
 if(action==='disable'){
  if(!record.mfa_secret_cipher||!await consumeFactor(env,record,data.code))fail('Authenticator or recovery code incorrect',403);
  await env.DB.batch([env.DB.prepare("UPDATE users SET mfa_secret_cipher=NULL,mfa_pending_cipher=NULL,mfa_pending_expires_at=NULL,mfa_last_step=NULL,mfa_recovery_json='[]' WHERE id=? AND password_hash=?").bind(user.id,record.password_hash),env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(user.id),audit('disable')]);return {enabled:false};
 }
 fail('Not found',404);
}

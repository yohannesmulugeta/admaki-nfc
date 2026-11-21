import { derive, equalHash, ITERATIONS, randomToken, sha, validPassword } from './auth.js';
import { validateProfile, vcard } from './profile.js';
import { MediaError,uploadMedia,listMedia,deleteMedia,serveMedia,cleanupMedia,validateMediaReferences,availableMediaSQL } from './media.js';
const reply = (data,status=200) => new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}});
class APIError extends Error { constructor(message,status=400){super(message);this.status=status;} }
const fail=(message,status)=>{throw new APIError(message,status);};
const cookie=(token,age)=>`admaki_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${age}`;
const tokenFrom=req=>(req.headers.get('cookie')||'').match(/(?:^|;\s*)admaki_session=([a-f0-9]{64})(?:;|$)/)?.[1];
async function body(req) {
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) fail('JSON body required',415);
  if (Number(req.headers.get('content-length'))>70000) fail('Request too large',413);
  const reader=req.body?.getReader();if(!reader)fail('JSON body required');
  const chunks=[];let size=0;
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>70000){await reader.cancel();fail('Request too large',413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  try {const result=JSON.parse(new TextDecoder().decode(bytes));if(!result||typeof result!=='object'||Array.isArray(result))fail('Invalid JSON');return result;} catch {fail('Invalid JSON');}
}
async function sessionUser(req,env) {
  const token=tokenFrom(req);if(!token)return null;
  return env.DB.prepare("SELECT u.id,u.username,u.display_name,u.is_platform_admin FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>datetime('now')").bind(await sha(token)).first();
}
async function limited(req,env,key) {
  if(!env.LOGIN_LIMITER)fail('Account protection not configured',503);
  const result=await env.LOGIN_LIMITER.limit({key});if(!result.success)fail('Too many attempts. Please try again shortly.',429);
}
async function passwordRecord(password,env) {
  if(!env.AUTH_PEPPER)fail('Account service not configured',503);
  if(!validPassword(password))fail('Use a unique password of 12–128 characters');
  const salt=randomToken();return {salt,hash:await derive(password,salt,ITERATIONS,env.AUTH_PEPPER)};
}
async function login(req,env) {
  await limited(req,env,'ip:'+(req.headers.get('cf-connecting-ip')||'local'));
  const data=await body(req),username=String(data.username||'').trim().toLowerCase(),password=String(data.password||'');
  if(!env.AUTH_PEPPER)fail('Account service not configured',503);
  if(username.length>64||password.length>128)fail('Invalid credentials',401);
  await limited(req,env,'user:'+username);
  const user=await env.DB.prepare('SELECT * FROM users WHERE username=?').bind(username).first();
  // Perform the same derivation for unknown usernames to limit enumeration by timing.
  const candidate=await derive(password,user?.password_salt||'0'.repeat(64),user?.password_iterations||ITERATIONS,env.AUTH_PEPPER);
  const correct=await equalHash(candidate,user?.password_hash||'0'.repeat(64));
  if(!user || user.locked_until && Date.parse(user.locked_until+'Z')>Date.now())fail('Invalid credentials or temporarily locked',401);
  if(!correct){await env.DB.prepare("UPDATE users SET failed_attempts=failed_attempts+1,locked_until=CASE WHEN failed_attempts>=4 THEN datetime('now','+15 minutes') ELSE NULL END WHERE id=?").bind(user.id).run();fail('Invalid credentials or temporarily locked',401);}
  const token=randomToken();
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET failed_attempts=0,locked_until=NULL WHERE id=?').bind(user.id),
    env.DB.prepare("DELETE FROM sessions WHERE expires_at<=datetime('now')"),
    env.DB.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,datetime('now','+1 day'))").bind(await sha(token),user.id)
  ]);
  const response=reply({ok:true,username:user.username,isPlatformAdmin:!!user.is_platform_admin});response.headers.set('set-cookie',cookie(token,86400));return response;
}
async function logout(req,env){const token=tokenFrom(req);if(token)await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha(token)).run();const r=reply({ok:true});r.headers.set('set-cookie',cookie('',0));return r;}
async function changePassword(req,env,user){
  await limited(req,env,'password:'+user.id);const data=await body(req);
  const record=await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(user.id).first();
  const candidate=await derive(String(data.currentPassword||''),record.password_salt,record.password_iterations,env.AUTH_PEPPER);
  if(!await equalHash(candidate,record.password_hash))fail('Current password incorrect',403);
  const next=await passwordRecord(data.newPassword,env);
  await env.DB.batch([env.DB.prepare('UPDATE users SET password_hash=?,password_salt=?,password_iterations=?,failed_attempts=0,locked_until=NULL WHERE id=?').bind(next.hash,next.salt,ITERATIONS,user.id),env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(user.id)]);
  const r=reply({ok:true});r.headers.set('set-cookie',cookie('',0));return r;
}
function audit(env,user,org,card,action,mutation=null){
  if(mutation)return env.DB.prepare('INSERT INTO audit_events(id,actor_user_id,organization_id,card_id,action) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM cards WHERE id=? AND last_mutation_id=?)').bind(crypto.randomUUID(),user.id,org,card,action,card,mutation);
  return env.DB.prepare('INSERT INTO audit_events(id,actor_user_id,organization_id,card_id,action) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),user.id,org,card,action);
}
function companyBrand(data){
  const name=typeof data.name==='string'?data.name.trim():'';
  if(name.length<2||name.length>120)fail('Use a company name of 2–120 characters');
  const logo=typeof data.logo==='string'?data.logo:'';
  if(logo.length>2048||logo&&(!/^\/(?!\/)[^\s\\]+$/.test(logo)&&!/^https:\/\/[^\s\\]+$/.test(logo)))fail('Use a local image path or HTTPS logo link');
  const accent=data.accent||'#2563eb';if(!/^#[0-9a-fA-F]{6}$/.test(accent))fail('Use a six-digit brand colour');
  const rgb=[1,3,5].map(i=>parseInt(accent.slice(i,i+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
  if(1.05/(.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]+.05)<4.5)fail('Choose a darker brand colour so white button text stays readable');
  return {name,logo,accent:accent.toLowerCase()};
}
async function admin(req,env,user,path){
  if(!user.is_platform_admin)fail('Forbidden',403);
  if(path==='/api/admin/cards'&&req.method==='GET'){
    const data=await env.DB.prepare("SELECT c.id,c.organization_id,o.name AS organization_name,c.label,c.slug,c.version,c.updated_at,c.draft_json IS NOT NULL AS has_draft,COALESCE(json_extract(COALESCE(c.draft_json,c.published_json),'$.cover'),json_extract(COALESCE(c.draft_json,c.published_json),'$.portrait'),json_extract(c.published_json,'$.logo')) AS cover FROM cards c JOIN organizations o ON o.id=c.organization_id ORDER BY c.updated_at DESC,c.slug").all();
    return reply({cards:data.results});
  }
  if(path==='/api/admin/organizations'){
    if(req.method==='GET'){const data=await env.DB.prepare('SELECT o.id,o.name,o.logo_url,o.accent,(SELECT COUNT(*) FROM cards c WHERE c.organization_id=o.id) AS card_count FROM organizations o ORDER BY o.name').all();return reply({organizations:data.results});}
    if(req.method==='POST'){const data=await body(req);const brand=companyBrand(data),id=crypto.randomUUID();await env.DB.batch([env.DB.prepare('INSERT INTO organizations(id,name,logo_url,accent) VALUES(?,?,?,?)').bind(id,brand.name,brand.logo,brand.accent),audit(env,user,id,null,'organization.create')]);return reply({id,...brand},201);}
  }
  const match=path.match(/^\/api\/admin\/organizations\/([a-zA-Z0-9_-]+)(?:\/(users)(?:\/([a-zA-Z0-9_-]+)\/password)?)?$/);if(!match)fail('Not found',404);
  const org=await env.DB.prepare('SELECT id,name,logo_url,accent FROM organizations WHERE id=?').bind(match[1]).first();if(!org)fail('Not found',404);
  if(req.method==='PATCH'&&!match[2]){const brand=companyBrand(await body(req));await env.DB.batch([env.DB.prepare('UPDATE organizations SET name=?,logo_url=?,accent=? WHERE id=?').bind(brand.name,brand.logo,brand.accent,org.id),audit(env,user,org.id,null,'organization.branding')]);return reply({id:org.id,...brand});}
  if(req.method==='GET'&&!match[2]){const [cards,users]=await Promise.all([env.DB.prepare("SELECT id,label,slug,version,updated_at,draft_json IS NOT NULL AS has_draft,COALESCE(json_extract(COALESCE(draft_json,published_json),'$.cover'),json_extract(COALESCE(draft_json,published_json),'$.portrait'),json_extract(published_json,'$.logo')) AS cover FROM cards WHERE organization_id=? ORDER BY slug").bind(org.id).all(),env.DB.prepare('SELECT u.id,u.username,u.display_name,m.role FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.organization_id=? AND u.is_platform_admin=0').bind(org.id).all()]);return reply({organization:org,cards:cards.results,users:users.results});}
  if(req.method==='POST'&&match[2]==='users'){
    const data=await body(req);const password=await passwordRecord(data.password,env);
    if(match[3]){
      const target=await env.DB.prepare('SELECT u.id FROM users u JOIN memberships m ON m.user_id=u.id WHERE u.id=? AND m.organization_id=? AND u.is_platform_admin=0').bind(match[3],org.id).first();if(!target)fail('Not found',404);
      await env.DB.batch([env.DB.prepare('UPDATE users SET password_hash=?,password_salt=?,password_iterations=?,failed_attempts=0,locked_until=NULL WHERE id=?').bind(password.hash,password.salt,ITERATIONS,target.id),env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(target.id),audit(env,user,org.id,null,'account.password_reset:'+target.id)]);return reply({ok:true});
    }
    const username=String(data.username||'').trim().toLowerCase();if(!/^[a-z][a-z0-9_-]{2,63}$/.test(username)||typeof data.displayName!=='string'||!data.displayName.trim()||data.displayName.length>120)fail('Invalid username or display name');
    if(await env.DB.prepare('SELECT id FROM users WHERE username=?').bind(username).first())fail('Username already exists',409);
    const id=crypto.randomUUID();await env.DB.batch([env.DB.prepare('INSERT INTO users(id,username,display_name,password_hash,password_salt,password_iterations) VALUES(?,?,?,?,?,?)').bind(id,username,data.displayName.trim(),password.hash,password.salt,ITERATIONS),env.DB.prepare("INSERT INTO memberships(organization_id,user_id,role) VALUES(?,?,'owner')").bind(org.id,id),audit(env,user,org.id,null,'account.create:'+id)]);return reply({id,username},201);
  }
  fail('Not found',404);
}
async function cards(req,env,user,url){
  // Admin access is explicit and separate from tenant membership.
  const membership=user.is_platform_admin?null:await env.DB.prepare('SELECT m.organization_id,m.role,o.name FROM memberships m JOIN organizations o ON o.id=m.organization_id WHERE m.user_id=?').bind(user.id).first();
  if(!user.is_platform_admin&&!membership)fail('Forbidden',403);
  if(url.pathname==='/api/cards'&&req.method==='GET'){
    const org=user.is_platform_admin?url.searchParams.get('organization'):membership.organization_id;
    if(!org)fail('Select a company');
    const data=await env.DB.prepare("SELECT id,label,slug,version,updated_at,draft_json IS NOT NULL AS has_draft,COALESCE(json_extract(COALESCE(draft_json,published_json),'$.cover'),json_extract(COALESCE(draft_json,published_json),'$.portrait'),json_extract(published_json,'$.logo')) AS cover FROM cards WHERE organization_id=? ORDER BY slug").bind(org).all();const brand=await env.DB.prepare('SELECT name,logo_url,accent FROM organizations WHERE id=?').bind(org).first();return reply({organization:brand?.name||org,branding:{name:brand?.name||org,logo:brand?.logo_url||'',accent:brand?.accent||'#2563eb'},cards:data.results});
  }
  const match=url.pathname.match(/^\/api\/cards\/([a-zA-Z0-9_-]+)(?:\/(draft|publish|history|rollback|media)(?:\/([a-f0-9-]{36}))?)?$/);if(!match)fail('Not found',404);
  const card=user.is_platform_admin?await env.DB.prepare('SELECT * FROM cards WHERE id=?').bind(match[1]).first():await env.DB.prepare('SELECT * FROM cards WHERE id=? AND organization_id=?').bind(match[1],membership.organization_id).first();
  if(!card)fail('Not found',404);
  const endpoint=match[2];
  if(req.method==='GET'&&!endpoint)return reply({id:card.id,label:card.label,slug:card.slug,version:card.version,updatedAt:card.updated_at,published:JSON.parse(card.published_json),draft:card.draft_json?JSON.parse(card.draft_json):null});
  if(req.method==='GET'&&endpoint==='history'){const revisions=await env.DB.prepare('SELECT version,created_at FROM card_revisions WHERE card_id=? ORDER BY version DESC LIMIT 20').bind(card.id).all();return reply({revisions:revisions.results});}
  if(!user.is_platform_admin&&!['owner','editor'].includes(membership.role))fail('Forbidden',403);
  if(endpoint==='media'){
    if(req.method==='GET'&&!match[3])return listMedia(env,card);
    if(req.method==='POST'&&!match[3])return uploadMedia(req,env,user,card);
    if(req.method==='DELETE'&&match[3])return deleteMedia(env,card,match[3],user);
    fail('Not found',404);
  }
  const data=await body(req);if(!Number.isInteger(data.version)||data.version!==card.version)fail('This card changed. Reload it before saving.',409);
  const mutation=crypto.randomUUID(),version=card.version+1;let update,action;
  if(req.method==='PUT'&&endpoint==='draft'){
    try{validateProfile(data.profile,JSON.parse(card.published_json));}catch(error){fail(error.message);}
    await validateMediaReferences(env,card,data.profile);
    action='card.draft';update=env.DB.prepare("UPDATE cards SET draft_json=?,version=version+1,updated_at=CURRENT_TIMESTAMP,last_mutation_id=? WHERE id=? AND version=? AND "+availableMediaSQL).bind(JSON.stringify(data.profile),mutation,card.id,card.version,JSON.stringify(data.profile),card.id);
  }else if(req.method==='DELETE'&&endpoint==='draft'){
    action='card.discard';update=env.DB.prepare("UPDATE cards SET draft_json=NULL,version=version+1,updated_at=CURRENT_TIMESTAMP,last_mutation_id=? WHERE id=? AND version=?").bind(mutation,card.id,card.version);
  }else if(req.method==='POST'&&endpoint==='publish'){
    if(!card.draft_json)fail('Save a draft first');action='card.publish';update=env.DB.prepare("UPDATE cards SET published_json=draft_json,draft_json=NULL,version=version+1,updated_at=CURRENT_TIMESTAMP,last_mutation_id=? WHERE id=? AND version=?").bind(mutation,card.id,card.version);
  }else if(req.method==='POST'&&endpoint==='rollback'){
    const revision=await env.DB.prepare('SELECT profile_json FROM card_revisions WHERE card_id=? AND version=?').bind(card.id,data.targetVersion||0).first();if(!revision)fail('Published revision not found',404);
    action='card.rollback';update=env.DB.prepare("UPDATE cards SET published_json=?,draft_json=NULL,version=version+1,updated_at=CURRENT_TIMESTAMP,last_mutation_id=? WHERE id=? AND version=?").bind(revision.profile_json,mutation,card.id,card.version);
  }else fail('Not found',404);
  const statements=[update,audit(env,user,card.organization_id,card.id,action,mutation)];
  if(['card.publish','card.rollback'].includes(action))statements.push(env.DB.prepare('INSERT INTO card_revisions(card_id,version,profile_json) SELECT id,version,published_json FROM cards WHERE id=? AND last_mutation_id=?').bind(card.id,mutation));
  const result=await env.DB.batch(statements);if(!result[0].meta.changes)fail('This card changed. Reload it before saving.',409);return reply({version});
}
async function handle(req,env){
  const url=new URL(req.url),path=url.pathname;
  if(path.startsWith('/media/')){if(!['GET','HEAD'].includes(req.method))fail('Method not allowed',405);return serveMedia(req,env,sessionUser);}
  const contact=path.match(/^\/([a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)\/contact\.vcf$/);
  if(contact&&['GET','HEAD'].includes(req.method)){
    const card=env.DB&&await env.DB.prepare('SELECT published_json FROM cards WHERE slug=?').bind(contact[1]).first();
    if(!card)return env.ASSETS.fetch(req);
    return new Response(req.method==='HEAD'?null:vcard(JSON.parse(card.published_json),url.origin),{headers:{'content-type':'text/vcard; charset=utf-8','content-disposition':`attachment; filename="${contact[1].replaceAll('/','-')}.vcf"`,'cache-control':'no-store','x-content-type-options':'nosniff'}});
  }
  if(!path.startsWith('/api/'))return env.ASSETS.fetch(req);
  if(!env.DB)fail('Not configured',503);
  if(!['GET','HEAD'].includes(req.method)&&req.headers.get('origin')!==url.origin)fail('Invalid origin',403);
  if(path.startsWith('/api/public/cards/')&&req.method==='GET'){
    const slug=path.slice('/api/public/cards/'.length).replace(/\/$/,'');if(!/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/.test(slug))fail('Not found',404);
    const card=await env.DB.prepare('SELECT published_json,version FROM cards WHERE slug=?').bind(slug).first();if(!card)fail('Not found',404);
    return reply({profile:JSON.parse(card.published_json),version:card.version});
  }
  if(path==='/api/auth/login'&&req.method==='POST')return login(req,env);
  if(path==='/api/auth/logout'&&req.method==='POST')return logout(req,env);
  const user=await sessionUser(req,env);if(!user)fail('Unauthorized',401);
  if(path==='/api/auth/me'&&req.method==='GET')return reply({username:user.username,displayName:user.display_name,isPlatformAdmin:!!user.is_platform_admin});
  if(path==='/api/auth/password'&&req.method==='POST')return changePassword(req,env,user);
  if(path.startsWith('/api/admin/'))return admin(req,env,user,path);
  return cards(req,env,user,url);
}
export default {async fetch(req,env){try{return await handle(req,env);}catch(error){if(!(error instanceof APIError)&&!(error instanceof MediaError))console.error(JSON.stringify({event:'request_failed',path:new URL(req.url).pathname,message:'Internal request failure'}));return reply({error:error instanceof APIError||error instanceof MediaError?error.message:'Request failed'},error.status||500);}},async scheduled(event,env,ctx){ctx.waitUntil(cleanupMedia(env));}};

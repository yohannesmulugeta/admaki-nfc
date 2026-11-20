// Cloudflare Worker API — staging only; requires Access, D1 and static assets bindings.
const reply=(x,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{'content-type':'application/json','cache-control':'no-store'}});
const err=(e,s)=>reply({error:e},s);
const decode=s=>JSON.parse(atob(s.replace(/-/g,'+').replace(/_/g,'/')));
async function identity(req,env){
 const token=req.headers.get('cf-access-jwt-assertion');if(!token||!env.ACCESS_TEAM_DOMAIN||!env.ACCESS_AUD)throw Error('Unauthorized');
 const [h,p,s,...extra]=token.split('.');if(!h||!p||!s||extra.length)throw Error('Unauthorized');
 const header=decode(h),claims=decode(p),now=Math.floor(Date.now()/1000);
 if(header.alg!=='RS256'||!header.kid||claims.iss!=='https://'+env.ACCESS_TEAM_DOMAIN||!(Array.isArray(claims.aud)?claims.aud:[claims.aud]).includes(env.ACCESS_AUD)||!claims.sub||!claims.exp||claims.exp<=now||(claims.nbf&&claims.nbf>now))throw Error('Unauthorized');
 const res=await fetch('https://'+env.ACCESS_TEAM_DOMAIN+'/cdn-cgi/access/certs');if(!res.ok)throw Error('Auth unavailable');
 const jwk=(await res.json()).keys.find(k=>k.kid===header.kid&&k.kty==='RSA');if(!jwk)throw Error('Unauthorized');
 const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
 const bytes=Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
 if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,bytes,new TextEncoder().encode(h+'.'+p)))throw Error('Unauthorized');
 return claims.sub;
}
const editable=['name','organization','eyebrow','description','companyDescription','phone','phoneLabel','whatsapp','email','salesEmail','address','website','showroomUrl','catalogue','collectionUrl','consultationUrl','logo','cover','coverAlt','interior','interiorAlt','contactPhoto','theme','social','collections','featuredProducts','gallery'];
function validate(next,old){if(!next||typeof next!=='object'||Array.isArray(next)||next.slug!==old.slug||next.source!==old.source||JSON.stringify(next.contactAddress)!==JSON.stringify(old.contactAddress))throw Error('Protected fields changed');if(Object.keys(next).some(k=>!editable.includes(k)&&!['slug','source','contactAddress'].includes(k)))throw Error('Unexpected field');for(const k of editable){const v=next[k];if(['social','collections','featuredProducts','gallery'].includes(k)){if(!Array.isArray(v)||v.length>30||v.some(x=>!x||typeof x!=='object'||Object.values(x).some(y=>typeof y!=='string'||y.length>2048)))throw Error('Invalid '+k)}else if(typeof v!=='string'||v.length>4000)throw Error('Invalid '+k)}if(JSON.stringify(next).length>65000)throw Error('Too large');}
export default {async fetch(req,env){const u=new URL(req.url);if(!u.pathname.startsWith('/api/'))return env.ASSETS.fetch(req);if(!env.DB||!env.ACCESS_AUD||!env.ACCESS_TEAM_DOMAIN)return err('Not configured',503);let uid;try{uid=await identity(req,env)}catch{return err('Unauthorized',401)}
 try{const membership=await env.DB.prepare('SELECT m.organization_id,m.role,o.name FROM memberships m JOIN organizations o ON o.id=m.organization_id WHERE m.user_id=?').bind(uid).first();if(!membership)return err('Forbidden',403);
 if(u.pathname==='/api/cards'&&req.method==='GET'){const cards=await env.DB.prepare('SELECT id,label,slug,version FROM cards WHERE organization_id=? ORDER BY slug').bind(membership.organization_id).all();return reply({organization:membership.name,cards:cards.results})}
 const m=u.pathname.match(/^\/api\/cards\/([a-zA-Z0-9_-]+)(?:\/(draft|publish))?$/);if(!m)return err('Not found',404);
 const card=await env.DB.prepare('SELECT * FROM cards WHERE id=? AND organization_id=?').bind(m[1],membership.organization_id).first();if(!card)return err('Not found',404);
 if(req.method==='GET'&&!m[2])return reply({id:card.id,label:card.label,slug:card.slug,version:card.version,published:JSON.parse(card.published_json),draft:card.draft_json?JSON.parse(card.draft_json):null});
 if(!['owner','editor'].includes(membership.role))return err('Forbidden',403);
 if(req.method==='PUT'&&m[2]==='draft'){const body=await req.json();if(body.version!==card.version)return err('Version conflict',409);try{validate(body.profile,JSON.parse(card.published_json))}catch(e){return err(e.message,400)}const result=await env.DB.prepare('UPDATE cards SET draft_json=?,version=version+1 WHERE id=? AND organization_id=? AND version=?').bind(JSON.stringify(body.profile),card.id,membership.organization_id,card.version).run();return result.meta.changes?reply({version:card.version+1}):err('Conflict',409)}
 if(req.method==='POST'&&m[2]==='publish'){const body=await req.json();if(body.version!==card.version)return err('Conflict',409);if(!card.draft_json)return err('Save a draft first',400);const result=await env.DB.prepare('UPDATE cards SET published_json=draft_json,draft_json=NULL,version=version+1 WHERE id=? AND organization_id=? AND version=?').bind(card.id,membership.organization_id,card.version).run();return result.meta.changes?reply({version:card.version+1}):err('Conflict',409)}
 return err('Not found',404);
 }catch{return err('Request failed',500)}
}};
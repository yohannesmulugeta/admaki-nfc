import {renderTemplate} from '../shared/template-renderer.js';
export async function loadTemplate(env,id,version='1'){
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)||!/^[1-9][0-9]*$/.test(String(version)))throw Error('Invalid template identity');
 const response=await env.ASSETS.fetch(new Request('https://assets.local/templates/'+id+'/'+version+'.json'));
 if(!response.ok)throw Error('Template is unavailable');const text=await response.text();if(text.length>2000000)throw Error('Template is too large');const definition=JSON.parse(text);if(definition.id!==id||definition.version!==String(version))throw Error('Template identity mismatch');return definition;
}
export async function templateCatalog(env){const r=await env.ASSETS.fetch(new Request('https://assets.local/templates/catalog.json'));if(!r.ok)throw Error('Template catalogue is unavailable');return r.json();}
export function templateIdentity(card,profile){return {id:card.template_id||profile.theme,version:card.template_version||'1',schemaVersion:card.schema_version||1};}
export async function publicCard(req,env,card){
 const profile=JSON.parse(card.published_json),identity=templateIdentity(card,profile),etag='"card-'+card.id+'-'+card.version+'-'+identity.version+'"';
 const headers={'content-type':'text/html; charset=utf-8','cache-control':'public, max-age=0, must-revalidate','etag':etag,'x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'strict-origin-when-cross-origin','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; font-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self' https://wa.me"};
 if((req.headers.get('if-none-match')||'').split(',').some(v=>v.trim().replace(/^W\//,'')===etag||v.trim()==='*'))return new Response(null,{status:304,headers});
 const definition=await loadTemplate(env,identity.id,identity.version);
 return new Response(req.method==='HEAD'?null:renderTemplate(definition,profile,{origin:new URL(req.url).origin}),{headers});
}
export function blankProfile(definition,{slug,name,organization,logo='',phone='',email=''}){
 const result={slug,theme:definition.id,source:'Created through the ADMAKI admin workspace'};
 for(const [key,field]of Object.entries(definition.schema.fields)){result[key]=field.type==='array'?[]:field.type==='object'?Object.fromEntries(Object.keys(field.properties).map(k=>[k,''])):'';}
 Object.assign(result,{name,organization,logo,phone,email});return result;
}

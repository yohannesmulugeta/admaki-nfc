import {templateCatalog,loadTemplate,blankProfile} from './templates.js';
import {validateProfile} from './profile.js';
export const validSlug=slug=>typeof slug==='string'&&slug.length<=160&&/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/.test(slug)&&!['admin','dashboard','api','media','profiles','templates','shared','manager','brand','fonts','assets'].includes(slug.split('/')[0]);
export async function createCard(env,user,org,data){
 const catalog=await templateCatalog(env),meta=catalog.templates.find(t=>t.id===data.templateId);
 if(!meta||!meta.reusable&&meta.organizationId!==org.id)throw Object.assign(Error('Choose a template available to this company'),{status:400});
 if(!validSlug(data.slug)||typeof data.name!=='string'||!data.name.trim()||data.name.length>120)throw Object.assign(Error('Use a valid permanent card address and display name'),{status:400});
 const existing=await env.DB.prepare('SELECT id,organization_id FROM cards WHERE slug=?').bind(data.slug).first();
 if(existing){if(data.requestId&&existing.id===data.requestId&&existing.organization_id===org.id)return {id:existing.id,existing:true};throw Object.assign(Error('This permanent card address is already reserved'),{status:409});}
 const id=typeof data.requestId==='string'&&/^[a-f0-9-]{36}$/.test(data.requestId)?data.requestId:crypto.randomUUID(),definition=await loadTemplate(env,meta.id,meta.version);
 const profile=blankProfile(definition,{slug:data.slug,name:data.name.trim(),organization:org.name,logo:org.logo_url,phone:data.phone||'',email:data.email||''});
 validateProfile(profile,profile,definition.schema);
 await env.DB.batch([
  env.DB.prepare('INSERT INTO cards(id,organization_id,slug,label,published_json,template_id,template_version,schema_version) VALUES(?,?,?,?,?,?,?,?)').bind(id,org.id,data.slug,data.name.trim(),JSON.stringify(profile),meta.id,meta.version,meta.schemaVersion),
  env.DB.prepare('INSERT INTO card_revisions(card_id,version,profile_json,template_id,template_version,schema_version) VALUES(?,1,?,?,?,?)').bind(id,JSON.stringify(profile),meta.id,meta.version,meta.schemaVersion),
  env.DB.prepare('INSERT INTO audit_events(id,actor_user_id,organization_id,card_id,action) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),user.id,org.id,id,'card.create')
 ]);return {id,slug:data.slug};
}
export function pagination(url){const page=Math.max(1,Math.min(100000,Number(url.searchParams.get('page'))||1)),limit=Math.max(1,Math.min(100,Number(url.searchParams.get('limit'))||24));return {page,limit,offset:(page-1)*limit};}

// Maintenance is bounded and resumable. Nothing deletes a retained revision or
// image: older revisions move to a private archive and remain restorable.
import {BACKUP_TABLES as tables,hashBytes as digest} from '../shared/backup-format.js';
const now=()=>new Date().toISOString();
export async function startBackup(env){
 if(!env.BACKUPS)throw Object.assign(Error('Backup storage is not configured'),{status:503});
 const running=await env.DB.prepare("SELECT id FROM operational_runs WHERE kind='backup' AND status='running' ORDER BY created_at DESC LIMIT 1").first();if(running)return {id:running.id,existing:true};
 const id=crypto.randomUUID(),cursor={table:0,offset:0,part:0,objects:0,phase:'tables'};
 try{await env.DB.prepare("INSERT INTO operational_runs(id,kind,status,cursor,object_key) VALUES(?,'backup','running',?,?)").bind(id,JSON.stringify(cursor),'backups/'+id+'/').run();}catch(error){const active=await env.DB.prepare("SELECT id FROM operational_runs WHERE kind='backup' AND status='running'").first();if(active)return {id:active.id,existing:true};throw error;}return {id};
}
export async function backupStep(env,run){
 if(!env.BACKUPS)return;const claim=await env.DB.prepare("UPDATE operational_runs SET lease_until=datetime('now','+5 minutes') WHERE id=? AND status='running' AND cursor=? AND (lease_until IS NULL OR lease_until<datetime('now'))").bind(run.id,run.cursor).run();if(!claim.meta.changes)return;const c=JSON.parse(run.cursor),prefix=run.object_key;
 try{
  if(c.phase==='tables'){
   const table=tables[c.table];const data=await env.DB.prepare('SELECT rowid AS _backup_rowid,* FROM '+table+' WHERE rowid>? ORDER BY rowid LIMIT 50').bind(c.offset).all();
   const last=data.results.at(-1)?._backup_rowid;for(const row of data.results)delete row._backup_rowid;const payload=JSON.stringify({table,rows:data.results});
   await env.BACKUPS.put(prefix+'table-'+c.part+'.json',JSON.stringify({payload,sha256:await digest(payload)}),{httpMetadata:{contentType:'application/json'}});
   c.part++;c.offset=last||c.offset;if(data.results.length<50){c.table++;c.offset=0;if(c.table===tables.length){c.phase='media';c.offset=0;}}
  }else if(c.phase==='media'){
   const rows=await env.DB.prepare("SELECT object_key FROM media_assets WHERE status='ready' UNION SELECT object_key FROM revision_archives ORDER BY object_key LIMIT 1 OFFSET ?").bind(c.offset).all();
   if(rows.results.length){const key=rows.results[0].object_key,object=await env.MEDIA.get(key);if(!object)throw Error('A referenced media object is missing');
    const bytes=await object.arrayBuffer();if(bytes.byteLength>8*1024*1024)throw Error('Backup object exceeds the bounded part limit');await env.BACKUPS.put(prefix+'object-'+c.objects,bytes,{customMetadata:{originalKey:key}});
    await env.BACKUPS.put(prefix+'object-'+c.objects+'.json',JSON.stringify({key,bytes:bytes.byteLength,sha256:await digest(bytes)}));c.objects++;c.offset++;
   }else{
    await env.BACKUPS.put(prefix+'manifest.json',JSON.stringify({format:1,consistency:'Logical snapshot collected over the start/end time window; use D1 Time Travel for an exact database point.',tables,id:run.id,createdAt:run.created_at,completedAt:now(),tableParts:c.part,objects:c.objects,secretRecovery:'AUTH_PEPPER is held separately; sessions are deliberately not restored.'}));
    await env.DB.prepare("UPDATE operational_runs SET status='complete',lease_until=NULL,completed_at=CURRENT_TIMESTAMP,cursor=? WHERE id=?").bind(JSON.stringify(c),run.id).run();console.log(JSON.stringify({event:'backup_complete',id:run.id,objects:c.objects}));return;
   }
  }
  await env.DB.prepare('UPDATE operational_runs SET cursor=?,lease_until=NULL WHERE id=?').bind(JSON.stringify(c),run.id).run();
 }catch(error){await env.DB.prepare("UPDATE operational_runs SET status='failed',lease_until=NULL,completed_at=CURRENT_TIMESTAMP,detail=? WHERE id=?").bind(String(error.message).slice(0,200),run.id).run();console.error(JSON.stringify({event:'backup_failed',id:run.id}));}
}
export async function advanceBackups(env,steps=8){
 for(let i=0;i<steps;i++){const run=await env.DB.prepare("SELECT * FROM operational_runs WHERE kind='backup' AND status='running' ORDER BY created_at LIMIT 1").first();if(!run)break;await backupStep(env,run);}
}
export async function archiveHistory(env,limit=4){
 if(!env.MEDIA)return;if(await env.DB.prepare("SELECT id FROM operational_runs WHERE kind='backup' AND status='running'").first())return;
 const rows=await env.DB.prepare('SELECT r.* FROM card_revisions r WHERE (SELECT COUNT(*) FROM card_revisions newer WHERE newer.card_id=r.card_id AND newer.version>r.version)>=20 AND NOT EXISTS(SELECT 1 FROM revision_archives a WHERE a.card_id=r.card_id AND a.version=r.version) ORDER BY r.created_at LIMIT ?').bind(limit).all();
 for(const row of rows.results){
  const key='revision-archives/'+row.card_id+'/'+row.version+'.json',profile=JSON.parse(row.profile_json),paths=[];
  const visit=v=>{if(typeof v==='string'&&v.startsWith('/media/'))paths.push(v);else if(v&&typeof v==='object')for(const x of Object.values(v))visit(x);};visit(profile);
  await env.MEDIA.put(key,JSON.stringify(row),{httpMetadata:{contentType:'application/json'}});
  // Content is archived durably before its hot database row is removed.
  await env.DB.batch([
   env.DB.prepare('INSERT OR IGNORE INTO revision_archives(card_id,version,object_key,template_id,template_version,schema_version,media_paths_json,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(row.card_id,row.version,key,row.template_id||profile.theme,row.template_version,row.schema_version,JSON.stringify(paths),row.created_at),
   env.DB.prepare('DELETE FROM card_revisions WHERE card_id=? AND version=? AND EXISTS(SELECT 1 FROM revision_archives WHERE card_id=? AND version=?)').bind(row.card_id,row.version,row.card_id,row.version)
  ]);
 }
}
export async function archivedRevision(env,cardId,version){const record=await env.DB.prepare('SELECT object_key FROM revision_archives WHERE card_id=? AND version=?').bind(cardId,version).first();if(!record)return null;const object=await env.MEDIA?.get(record.object_key);if(!object)throw Error('Archived version unavailable');return object.json();}
export async function storageUsage(env,organizationId){return env.DB.prepare("SELECT (SELECT COALESCE(SUM(byte_size),0) FROM media_assets WHERE organization_id=?) bytes,(SELECT COUNT(*) FROM media_assets WHERE organization_id=?) objects,(SELECT COUNT(*) FROM revision_archives a JOIN cards c ON c.id=a.card_id WHERE c.organization_id=?) archived_versions,media_limit_bytes,media_object_limit FROM organizations WHERE id=?").bind(organizationId,organizationId,organizationId,organizationId).first();}
export async function healthSummary(env){
 const backup=await env.DB.prepare("SELECT id,status,created_at,completed_at,detail FROM operational_runs WHERE kind='backup' ORDER BY created_at DESC LIMIT 1").first();
 const stats=await env.DB.prepare('SELECT (SELECT COUNT(*) FROM organizations) companies,(SELECT COUNT(*) FROM cards) cards,(SELECT COUNT(*) FROM revision_archives) archived_versions').first();
 return {ok:true,backupOverdue:!backup||Date.now()-Date.parse((backup.status==='complete'?backup.completed_at:backup.created_at).replace(' ','T')+'Z')>26*60*60*1000,environment:env.ENVIRONMENT||'local',backup:backup||null,stats,backupConfigured:!!env.BACKUPS,secretRecovery:'Store the production AUTH_PEPPER recovery file privately. Backups do not include secret values.'};
}
export async function scheduledMaintenance(env){
 const recent=await env.DB.prepare("SELECT id FROM operational_runs WHERE kind='backup' AND created_at>datetime('now','-1 day') LIMIT 1").first();if(!recent&&env.BACKUPS)await startBackup(env);
 await advanceBackups(env,6);await archiveHistory(env,2);
}

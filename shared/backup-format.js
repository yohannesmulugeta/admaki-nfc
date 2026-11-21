export const BACKUP_TABLES=['organizations','users','memberships','cards','card_revisions','audit_events','media_assets','revision_archives','security_events'];
export const hashBytes=async data=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',typeof data==='string'?new TextEncoder().encode(data):data))).map(n=>n.toString(16).padStart(2,'0')).join('');
export async function restoreBackup(manifest,read,db,media){
 if(manifest.format!==1||!Number.isInteger(manifest.tableParts)||!Number.isInteger(manifest.objects)||manifest.tableParts>100000||manifest.objects>100000)throw Error('Unsupported backup');
 for(const table of BACKUP_TABLES){const count=await db.prepare('SELECT COUNT(*) n FROM '+table).first();if(count.n)throw Error('Restore target must be empty');}
 const seen=new Set();let rows=0;
 for(let i=0;i<manifest.tableParts;i++){
  const part=JSON.parse(await read('table-'+i+'.json','text'));if(await hashBytes(part.payload)!==part.sha256)throw Error('Backup part integrity check failed');const data=JSON.parse(part.payload);
  if(!BACKUP_TABLES.includes(data.table)||!Array.isArray(data.rows)||data.rows.length>50)throw Error('Invalid backup table');seen.add(data.table);
  for(const row of data.rows){const keys=Object.keys(row);if(!keys.length||keys.some(k=>!/^[_a-z]+$/.test(k)))throw Error('Invalid column');await db.prepare('INSERT INTO '+data.table+' ('+keys.join(',')+') VALUES('+keys.map(()=>'?').join(',')+')').bind(...keys.map(k=>row[k])).run();rows++;}
 }
 const expected=manifest.tables||BACKUP_TABLES.filter(t=>t!=='security_events');if(expected.some(t=>!BACKUP_TABLES.includes(t)||!seen.has(t))||BACKUP_TABLES.filter(t=>t!=='security_events').some(t=>!seen.has(t)))throw Error('Incomplete backup tables');
 for(let i=0;i<manifest.objects;i++){const meta=JSON.parse(await read('object-'+i+'.json','text')),bytes=await read('object-'+i,'bytes');if(!meta.key||meta.key.startsWith('/')||meta.key.includes('..')||bytes.byteLength!==meta.bytes||await hashBytes(bytes)!==meta.sha256)throw Error('Backup media integrity check failed');await media.put(meta.key,bytes);}
 const invalid=await db.prepare('PRAGMA foreign_key_check').all();if(invalid.results.length)throw Error('Restore has inconsistent references');await db.prepare('DELETE FROM sessions').run();return {rows,objects:manifest.objects};
}

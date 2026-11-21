// Restore only into a new local database/directory. Never overwrites a live DB.
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,readdirSync,mkdirSync,existsSync,chmodSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {restoreBackup} from '../shared/backup-format.js';
const [input,output]=process.argv.slice(2);if(!input||!output)throw Error('Usage: node scripts/recover-backup.mjs BACKUP_DIRECTORY NEW_OUTPUT_DIRECTORY');
if(existsSync(output))throw Error('Choose a new output directory');mkdirSync(output,{recursive:true,mode:0o700});const sql=new DatabaseSync(join(output,'recovered.sqlite'));
for(const file of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('migrations/'+file,'utf8'));
class Statement{constructor(query,values=[]){this.query=query;this.values=values;}bind(...values){return new Statement(this.query,values);}async first(){return sql.prepare(this.query).get(...this.values);}async all(){return {results:sql.prepare(this.query).all(...this.values)};}async run(){return sql.prepare(this.query).run(...this.values);}}
const db={prepare:q=>new Statement(q)},media={put:async(key,bytes)=>{const path=resolve(output,'media',key);if(!path.startsWith(resolve(output,'media')+'/'))throw Error('Invalid object key');mkdirSync(dirname(path),{recursive:true});writeFileSync(path,new Uint8Array(bytes));}};
const manifest=JSON.parse(readFileSync(join(input,'manifest.json'),'utf8'));
const result=await restoreBackup(manifest,async(name,type)=>{const bytes=readFileSync(join(input,name));return type==='text'?bytes.toString('utf8'):bytes;},db,media);console.log(JSON.stringify({...result,output}));sql.close();chmodSync(join(output,'recovered.sqlite'),0o600);

import {readFileSync,readdirSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadCompanies} from './company-registry.mjs';
import {compileTemplate} from './compile-template.mjs';
const profiles=loadCompanies().flatMap(c=>c.profiles),catalog=[];
for(const dir of readdirSync('templates')){
 if(!existsSync('templates/'+dir+'/manifest.json'))continue;
 const manifest=JSON.parse(readFileSync('templates/'+dir+'/manifest.json','utf8'));
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.id)||!/^[1-9][0-9]*$/.test(manifest.version))throw Error('Invalid template identity');
 const baseline=manifest.example?JSON.parse(readFileSync(manifest.example,'utf8')):profiles.find(p=>p.slug===manifest.exampleSlug);
 if(!baseline)throw Error('Missing template example: '+manifest.id);
 const html=readFileSync(manifest.sourceHTML||'public/'+manifest.exampleSlug+'/index.html','utf8');
 const compiled=compileTemplate(html,manifest,baseline);
 // Pin stylesheet bytes with each release so a later CSS change cannot alter old cards.
 const release='templates/releases/'+manifest.id+'/'+manifest.version;mkdirSync(release,{recursive:true});mkdirSync('public/templates/'+manifest.id,{recursive:true});
 compiled.html=compiled.html.replace(/href="(\/[^"]+\.css)"/g,(_,path)=>{const css=readFileSync('public'+path),hash=createHash('sha256').update(css).digest('hex').slice(0,16),name='style-'+hash+'.css';writeFileSync(release+'/'+name,css);writeFileSync('public/templates/'+manifest.id+'/'+name,css);return 'href="/templates/'+manifest.id+'/'+name+'"';});
 const snapshot=release+'/template.json',serialized=JSON.stringify(compiled);if(existsSync(snapshot)&&readFileSync(snapshot,'utf8')!==serialized)throw Error('Released template '+manifest.id+'/'+manifest.version+' changed. Increment its version; keep the prior release.');writeFileSync(snapshot,serialized);
 writeFileSync('public/templates/'+manifest.id+'/'+manifest.version+'.json',serialized);
 catalog.push({id:manifest.id,version:manifest.version,schemaVersion:manifest.schemaVersion,name:manifest.name,reusable:manifest.reusable,organizationId:manifest.organizationId,schema:manifest.schema});
}
// Retain every old release for pinned published cards, drafts and rollback.
for(const id of readdirSync('templates/releases'))for(const version of readdirSync('templates/releases/'+id)){const release='templates/releases/'+id+'/'+version;mkdirSync('public/templates/'+id,{recursive:true});writeFileSync('public/templates/'+id+'/'+version+'.json',readFileSync(release+'/template.json'));for(const f of readdirSync(release).filter(f=>f.endsWith('.css')))writeFileSync('public/templates/'+id+'/'+f,readFileSync(release+'/'+f));}
writeFileSync('public/templates/catalog.json',JSON.stringify({templates:catalog}));
mkdirSync('public/shared',{recursive:true});for(const f of ['template-renderer.js','content-schema.js'])writeFileSync('public/shared/'+f,readFileSync('shared/'+f));
console.log('Built '+catalog.length+' versioned templates with shared rendering.');

const preview='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><script type="module" src="/dashboard/preview.js"></script></head><body></body></html>';
mkdirSync('public/dashboard/preview',{recursive:true});writeFileSync('public/dashboard/preview/index.html',preview);
for(const template of catalog){mkdirSync('public/dashboard/preview/'+template.id,{recursive:true});writeFileSync('public/dashboard/preview/'+template.id+'/index.html',preview);}

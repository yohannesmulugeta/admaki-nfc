import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {JSDOM} from 'jsdom';
const base=process.cwd();
const original=JSON.parse(readFileSync('profiles/maison-debrah.json','utf8'));
const tick=()=>new Promise(resolve=>setTimeout(resolve,10));
async function until(predicate){for(let i=0;i<200;i++){if(predicate())return;await tick();}assert.fail('Timed out waiting for UI state');}
function environment(path,url){const dom=new JSDOM(readFileSync(path,'utf8'),{url});const w=dom.window;w.scrollTo=()=>{};for(const key of ['window','document','location','history','FormData'])globalThis[key]=w[key];w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(value=''){this.returnValue=value;this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};w.document.addEventListener('submit',event=>{if(event.target.getAttribute('method')==='dialog'){event.preventDefault();event.target.closest('dialog').close(event.submitter.value);}});return w;}
async function loadScript(path){let code=readFileSync(path,'utf8').replace("from '/manager/ui.js'",`from '${pathToFileURL(base+'/public/manager/ui.js')}'`).replace("from './media.js'",`from '${pathToFileURL(base+'/public/dashboard/media.js')}'`);return import('data:text/javascript;base64,'+Buffer.from(code+'\n// '+Math.random()).toString('base64'));}
function response(data,status=200){return {ok:status<400,status,json:async()=>structuredClone(data)};}
function fill(w,selector,value){const input=w.document.querySelector(selector);assert(input,selector);input.value=value;input.dispatchEvent(new w.Event('input',{bubbles:true}));}
function submit(w,id){w.document.getElementById(id).dispatchEvent(new w.Event('submit',{cancelable:true,bubbles:true}));}
function click(w,selector){const button=w.document.querySelector(selector);assert(button,selector);button.click();}
async function confirm(w){await until(()=>w.document.querySelector('dialog[open]'));click(w,'dialog[open] [value="confirm"]');}

test('client edits, private preview, draft, publish, history and safe navigation work through the actual UI',async()=>{
  const w=environment('public/dashboard/index.html','https://stage.example/dashboard/');let profile=structuredClone(original),draft=null,version=1,loggedIn=true;const calls=[];
  globalThis.fetch=async(url,options={})=>{calls.push({url,options});const payload=options.body?JSON.parse(options.body):null;
    if(url==='/api/auth/me')return response({displayName:'Maison Debrah',username:'maisondebrah',isPlatformAdmin:false});
    if(url==='/api/auth/logout'){loggedIn=false;return response({ok:true});}
    if(url==='/api/cards')return response({organization:'Maison Debrah',cards:[{id:'card1',label:'Showroom card',slug:'maison-debrah',version,has_draft:!!draft,cover:original.cover,updated_at:'2026-11-21 12:00:00'}]});
    if(url==='/api/cards/card1/media')return response({enabled:true,media:[]});
    if(url==='/api/cards/card1/history')return response({revisions:[{version:1,created_at:'2026-11-21 12:00:00'}]});
    if(url==='/api/cards/card1/draft'&&options.method==='PUT'){assert.equal(payload.version,version);draft=payload.profile;return response({version:++version});}
    if(url==='/api/cards/card1/publish'){assert.equal(payload.version,version);profile=draft;draft=null;return response({version:++version});}
    if(url==='/api/cards/card1/rollback'){profile=structuredClone(original);draft=null;return response({version:++version});}
    if(url==='/api/cards/card1')return response({id:'card1',label:'Showroom card',slug:'maison-debrah',version,published:profile,draft});
    throw Error('Unexpected endpoint '+url);
  };
  await loadScript('public/dashboard/dashboard.js');await until(()=>!w.document.getElementById('workspace').hidden);
  assert(w.document.querySelector('#cards .digital-card'));assert(w.document.getElementById('account').hidden);
  click(w,'#cards .button');await until(()=>!w.document.getElementById('editor').hidden&&w.document.querySelector('[data-key="name"]'));
  const preview=[];w.document.getElementById('previewFrame').contentWindow.postMessage=data=>preview.push(data);
  fill(w,'[data-key="name"]','Maison Premium');assert.equal(w.document.getElementById('publish').disabled,true);assert.equal(preview.at(-1).profile.name,'Maison Premium');assert.equal(profile.name,original.name);
  // Leaving prompts without silently losing changes; cancel keeps the editor.
  click(w,'#backCards');await until(()=>w.document.querySelector('dialog[open]'));click(w,'dialog[open] [value="cancel"]');await tick();assert.equal(w.document.getElementById('editor').hidden,false);
  submit(w,'form');await until(()=>draft?.name==='Maison Premium'&&!w.document.getElementById('publish').disabled);assert.equal(profile.name,original.name);assert.equal(w.document.getElementById('saveDraft').disabled,true);
  click(w,'#publish');await confirm(w);await until(()=>profile.name==='Maison Premium'&&w.document.getElementById('saveState').textContent==='Published content');assert.equal(draft,null);
  click(w,'#tab-contact');fill(w,'[data-key="email"]','bad-email');submit(w,'form');await tick();assert.equal(draft,null);assert.equal(w.document.getElementById('panel-contact').hidden,false);
  fill(w,'[data-key="email"]',original.email);click(w,'#tab-images');assert(w.document.querySelector('input[type="file"]'));click(w,'#tab-history');click(w,'[data-restore="1"]');await confirm(w);await until(()=>w.document.getElementById('saveState').textContent==='Published content'&&profile.name===original.name);
  click(w,'#backCards');await until(()=>!w.document.querySelector('[data-page="cards"]').hidden);click(w,'[data-nav="account"]');await until(()=>!w.document.getElementById('account').hidden);click(w,'#logout');await until(()=>!w.document.getElementById('login').hidden);assert.equal(loggedIn,false);assert.equal(w.document.getElementById('cards').children.length,0);
  assert(!calls.some(c=>c.url.startsWith('/api/public')),'editor must not send drafts to public APIs');w.close();
});

test('admin search, company access, account reset dialog and account navigation use real controls',async()=>{
  const w=environment('public/admin/index.html','https://stage.example/admin/');let resets=0;
  const card={id:'card1',label:'Showroom',slug:'maison-debrah',organization_id:'org',organization_name:'Maison Debrah',has_draft:1,updated_at:'2026-11-21 12:00:00',cover:original.cover};
  globalThis.fetch=async(url,options={})=>{
    if(url==='/api/auth/me')return response({username:'admin',displayName:'ADMAKI Admin',isPlatformAdmin:true});
    if(url==='/api/admin/organizations')return response({organizations:[{id:'org',name:'Maison Debrah',card_count:1}]});
    if(url==='/api/admin/cards')return response({cards:[card]});
    if(url==='/api/admin/organizations/org')return response({organization:{id:'org',name:'Maison Debrah'},cards:[card],users:[{id:'client',username:'client',display_name:'Maison Client',role:'owner'}]});
    if(url==='/api/admin/organizations/org/users/client/password'){resets++;return response({ok:true});}
    throw Error('Unexpected endpoint '+url);
  };
  await loadScript('public/admin/admin.js');await until(()=>!w.document.getElementById('workspace').hidden);assert.equal(w.document.getElementById('draftCount').textContent,'1');
  click(w,'[data-nav="companies"]');fill(w,'#companySearch','unknown');assert.match(w.document.getElementById('companies').textContent,/No companies/);fill(w,'#companySearch','Maison');click(w,'#companies [data-company]');await until(()=>!w.document.querySelector('[data-page="company"]').hidden);click(w,'#companyAccessTab');assert.equal(w.document.getElementById('companyAccessPanel').hidden,false);
  click(w,'[data-reset]');assert(w.document.getElementById('resetDialog').open);fill(w,'#resetPassword input','Temporary-password-123!');submit(w,'resetPassword');await until(()=>resets===1&&!w.document.getElementById('resetDialog').open);
  click(w,'[data-nav="account"]');assert.equal(w.document.querySelector('[data-page="account"]').hidden,false);click(w,'[data-nav="cards"]');fill(w,'#cardSearch','unknown');assert.match(w.document.getElementById('allCards').textContent,/No digital cards/);w.close();
});

test('shared card renderer treats malicious edits as text and rejects unsafe image and link schemes',async()=>{
  const w=environment('public/maison-debrah/index.html','https://stage.example/maison-debrah/');const {renderProfile}=await import(pathToFileURL(base+'/public/profiles/render-profile.js'));
  renderProfile({...original,name:'<img src=x onerror=alert(1)>',cover:'javascript:alert(1)',website:'javascript:alert(1)',social:[{name:'<script>bad</script>',url:'https://safe.example/'}]});assert.equal(w.document.querySelector('.identity h1').textContent,'<img src=x onerror=alert(1)>');assert(!w.document.querySelector('.identity h1 img'));assert(!w.document.querySelector('.cover img').src.startsWith('javascript:'));assert(!w.document.querySelector('.explore-links a:last-child').href.startsWith('javascript:'));assert.equal(w.document.querySelector('.social-link').textContent,'<script>bad</script>');w.close();
});

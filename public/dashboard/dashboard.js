import { configureMedia,enhanceImageField,refreshMediaLibrary,isUploading } from './media.js';
let selected,version,profile,dirty=false,hasDraft=false;
const $=id=>document.getElementById(id),status=text=>$('status').textContent=text;
const listFields={social:{name:'Social network',url:'Profile link'},collections:{name:'Collection name',url:'Collection link'},gallery:{title:'Photo title',image:'Image link',alt:'Image description'}};
const labels={companyDescription:'Company description',phoneLabel:'Phone display',salesEmail:'Sales email',showroomUrl:'Showroom map link',collectionUrl:'Collection link',consultationUrl:'Consultation link',coverAlt:'Cover image description',interiorAlt:'Interior image description',contactPhoto:'Saved contact photo',contactAddress:'Saved contact address'};
async function api(path,options={}){
  const response=await fetch('/api'+path,{credentials:'same-origin',headers:{'Content-Type':'application/json'},...options});
  const data=await response.json();if(!response.ok){if(response.status===401)clearSession();throw Error(data.error||'Request failed');}return data;
}
function clearSession(){selected=null;profile=null;dirty=false;$('editor').hidden=true;$('account').hidden=true;$('cards').replaceChildren();$('fields').replaceChildren();$('mediaItems').replaceChildren();$('mediaNote').textContent='';$('previewContent').textContent='';$('login').hidden=false;}
function setDirty(value){dirty=value;$('publish').disabled=value||!hasDraft;}
function readEdits(){
  const next={...profile};for(const input of $('fields').querySelectorAll('[data-key]'))next[input.dataset.key]=input.value;
  if(profile.contactAddress){next.contactAddress={};for(const input of $('fields').querySelectorAll('[data-address]'))next.contactAddress[input.dataset.address]=input.value;}
  for(const container of $('fields').querySelectorAll('[data-list]'))next[container.dataset.list]=Array.from(container.querySelectorAll('fieldset')).map(row=>{const item={};for(const input of row.querySelectorAll('[data-field]'))item[input.dataset.field]=input.value;if(container.dataset.list==='social')item.icon=(item.name||'').toLowerCase();return item;});
  return next;
}
function field(labelText,value,property){const label=document.createElement('label');label.textContent=labelText;const input=document.createElement(String(value).length>100?'textarea':'input');input.value=value||'';input.oninput=()=>setDirty(true);if(property)input.dataset.key=property;label.append(input);const entry={label,input};if(['logo','cover','interior','contactPhoto'].includes(property))enhanceImageField(entry,labelText);return entry;}
function listEntry(container,key,item={}){
  const row=document.createElement('fieldset');const legend=document.createElement('legend');legend.textContent=key==='gallery'?'Showroom photo':key==='social'?'Social profile':'Collection';row.append(legend);
  for(const [property,labelText]of Object.entries(listFields[key])){const entry=field(labelText,item[property]);entry.input.dataset.field=property;if(property==='image')enhanceImageField(entry,labelText);row.append(entry.label);}
  const remove=document.createElement('button');remove.type='button';remove.textContent='Remove';remove.onclick=()=>{row.remove();setDirty(true);};row.append(remove);container.append(row);
}
async function loadHistory(){const data=await api('/cards/'+selected+'/history');$('history').replaceChildren();for(const revision of data.revisions){const row=document.createElement('p');row.textContent='Version '+revision.version+' · '+revision.created_at+' ';const restore=document.createElement('button');restore.type='button';restore.textContent='Restore';restore.onclick=async()=>{if(isUploading()){status('Wait for the image upload to finish.');return;}if(!confirm('Restore this published version? Unsaved edits and the current draft will be discarded.'))return;try{await api('/cards/'+selected+'/rollback',{method:'POST',body:JSON.stringify({version,targetVersion:revision.version})});dirty=false;await select(selected);status('Previous version restored and published.');}catch(error){status(error.message);}};row.append(restore);$('history').append(row);}}
async function select(id){
  if(isUploading()){status('Wait for the image upload to finish.');return;}
  if(dirty&&!confirm('Discard unsaved edits and open this card?'))return;
  try{const data=await api('/cards/'+id);selected=id;version=data.version;profile=data.draft||data.published;hasDraft=!!data.draft;
    $('title').textContent=data.label;$('link').href=location.origin+'/'+data.slug+'/';$('editor').hidden=false;$('fields').replaceChildren();$('previewContent').hidden=true;
    await configureMedia(id,{status,changed:()=>setDirty(true)});
    for(const [key,value]of Object.entries(profile)){
      if(['slug','source','theme','featuredProducts'].includes(key))continue;
      if(listFields[key]){
        const section=document.createElement('section');const heading=document.createElement('h3');heading.textContent=key==='social'?'Social profiles':key==='gallery'?'Showroom gallery':'Collections';
        const container=document.createElement('div');container.dataset.list=key;for(const item of value)listEntry(container,key,item);
        const add=document.createElement('button');add.type='button';add.textContent=key==='gallery'?'Add photo':'Add '+(key==='social'?'social profile':'collection');add.onclick=()=>{listEntry(container,key);setDirty(true);};section.append(heading,container,add);$('fields').append(section);
      }else if(key==='contactAddress'){
        const section=document.createElement('fieldset');const title=document.createElement('legend');title.textContent='Saved contact address';section.append(title);
        for(const [property,labelText]of Object.entries({street:'Street',city:'City',region:'Region',postalCode:'Postal code',country:'Country'})){const entry=field(labelText,value[property]);entry.input.dataset.address=property;section.append(entry.label);}$('fields').append(section);
      }else{const entry=field(labels[key]||key.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase()),value,key);$('fields').append(entry.label);}
    }
    setDirty(false);await loadHistory();status('Editing '+data.label+' · version '+data.version+' · '+(hasDraft?'Saved draft available.':'Published content.'));
  }catch(error){status(error.message);}
}
async function init(){try{
  const params=new URLSearchParams(location.search);const query=params.get('organization')?'?organization='+encodeURIComponent(params.get('organization')):'';
  const data=await api('/cards'+query);$('cards').replaceChildren();
  for(const card of data.cards){const box=document.createElement('div');box.className='card';const title=document.createElement('h3');title.textContent=card.label;const button=document.createElement('button');button.textContent=card.has_draft?'Edit saved draft':'Edit';button.onclick=()=>select(card.id);box.append(title,button);$('cards').append(box);}
  $('login').hidden=true;$('account').hidden=false;status('Select a card.');const id=params.get('card');if(id)await select(id);
}catch(error){clearSession();status(error.message==='Unauthorized'?'Please sign in.':error.message);}}
$('form').onsubmit=async event=>{event.preventDefault();if(isUploading()){status('Wait for the image upload to finish.');return;}try{const next=readEdits();const data=await api('/cards/'+selected+'/draft',{method:'PUT',body:JSON.stringify({version,profile:next})});version=data.version;profile=next;hasDraft=true;setDirty(false);await refreshMediaLibrary().catch(()=>{});status('Draft saved. Publish it when ready.');}catch(error){status(error.message);}};
$('publish').onclick=async()=>{if(isUploading()){status('Wait for the image upload to finish.');return;}if(dirty){status('Save your edits before publishing.');return;}if(!confirm('Publish the saved draft?'))return;try{await api('/cards/'+selected+'/publish',{method:'POST',body:JSON.stringify({version})});await select(selected);status('Published. The public card and saved contact now use these details.');}catch(error){status(error.message);}};
$('discard').onclick=async()=>{if(isUploading()){status('Wait for the image upload to finish.');return;}if(!confirm('Discard all unpublished changes?'))return;try{await api('/cards/'+selected+'/draft',{method:'DELETE',body:JSON.stringify({version})});dirty=false;await select(selected);}catch(error){status(error.message);}};
$('preview').onclick=()=>{try{const next=readEdits();$('previewContent').textContent=[next.name,next.description,next.companyDescription,next.phoneLabel||next.phone,next.email,next.salesEmail,next.address,next.website].filter(Boolean).join('\n\n');$('previewContent').hidden=false;status('Preview of your current edits. Save and publish to update the public card.');}catch(error){status(error.message);}};
$('loginForm').onsubmit=async event=>{event.preventDefault();try{const form=new FormData(event.target);await api('/auth/login',{method:'POST',body:JSON.stringify({username:form.get('username'),password:form.get('password')})});event.target.reset();await init();}catch(error){status(error.message);}};
$('passwordForm').onsubmit=async event=>{event.preventDefault();try{const form=new FormData(event.target);await api('/auth/password',{method:'POST',body:JSON.stringify({currentPassword:form.get('currentPassword'),newPassword:form.get('newPassword')})});event.target.reset();clearSession();status('Password changed. Please sign in again.');}catch(error){status(error.message);}};
$('logout').onclick=async()=>{try{await api('/auth/logout',{method:'POST'});clearSession();status('Signed out.');}catch(error){status(error.message);}};
window.addEventListener('beforeunload',event=>{if(dirty||isUploading()){event.preventDefault();event.returnValue='';}});init();

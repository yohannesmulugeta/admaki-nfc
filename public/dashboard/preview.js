import {renderTemplate} from '/shared/template-renderer.js';
let sequence=0;
window.addEventListener('message',async event=>{
 if(event.origin!==location.origin||event.source!==parent)return;
 if(event.data?.type==='admaki-preview-clear'){sequence++;document.body.replaceChildren();return;}
 if(event.data?.type!=='admaki-card-preview'||!event.data.profile)return;
 const token=++sequence,{profile,template}=event.data,identity=template||{id:profile.theme,version:'1'};
 if(!/^[a-z0-9-]+$/.test(identity.id)||!/^[1-9][0-9]*$/.test(String(identity.version)))return;
 try{
  const response=await fetch('/templates/'+identity.id+'/'+identity.version+'.json');if(!response.ok)throw Error('Preview unavailable');const definition=await response.json();if(token!==sequence)return;
  const html=renderTemplate(definition,profile,{origin:location.origin,preview:true});const parsed=new DOMParser().parseFromString(html,'text/html');
  document.head.replaceChildren(...Array.from(parsed.head.childNodes).map(node=>document.importNode(node,true)));
  document.body.replaceChildren(...Array.from(parsed.body.childNodes).map(node=>document.importNode(node,true)));
 }catch{if(token===sequence){document.body.textContent='The preview is unavailable. Your edits remain in the editor.';}}
});
document.addEventListener('click',event=>{if(event.target.closest('a,button'))event.preventDefault();},true);
document.addEventListener('submit',event=>event.preventDefault());
parent.postMessage({type:'admaki-preview-ready'},location.origin);

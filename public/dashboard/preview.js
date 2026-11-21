import {renderProfile} from '/profiles/render-profile.js';
// A preview accepts data only from its same-origin parent. No draft is fetched,
// stored, or broadcast. Links are inert so the frame stays inside the editor.
const card=document.querySelector('main');
card.hidden=true;
window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==parent)return;
  if(event.data?.type==='admaki-preview-clear'){card.hidden=true;return;}
  if(event.data?.type!=='admaki-card-preview'||!event.data.profile)return;
  renderProfile(event.data.profile);card.hidden=false;
});
document.addEventListener('click',event=>{if(event.target.closest('a,button'))event.preventDefault();},true);
document.addEventListener('submit',event=>event.preventDefault());
parent.postMessage({type:'admaki-preview-ready'},location.origin);

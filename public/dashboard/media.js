let activeCard,enabled=false,pending=0,callbacks={};
const $=id=>document.getElementById(id);
export const isUploading=()=>pending>0;
async function api(path,options={}){
  const response=await fetch('/api/cards/'+path,{credentials:'same-origin',...options});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Image request failed');return data;
}
export async function configureMedia(card,handlers){
  activeCard=card;callbacks=handlers;enabled=false;
  try{await refreshMediaLibrary();}catch{ $('mediaNote').textContent='Image uploads are temporarily unavailable. Existing image links still work.';$('mediaItems').replaceChildren();}
}
export async function refreshMediaLibrary(){
  const card=activeCard,data=await api(card+'/media');if(card!==activeCard)return;
  enabled=data.enabled;$('mediaItems').replaceChildren();
  $('mediaNote').textContent=enabled?'Uploads stay private until you save and publish the card. Unused uploads expire after seven days.':'Image uploads are not enabled yet. You can still use existing image links.';
  for(const image of data.media){
    const row=document.createElement('div');row.className='uploaded-image';
    if(image.status==='ready'){const preview=document.createElement('img');preview.src=image.url;preview.alt='Uploaded card image';preview.loading='lazy';row.append(preview);}
    const detail=document.createElement('p');detail.textContent=Math.ceil(image.bytes/1024)+' KB · '+(image.in_use?'Saved in this card or its history':image.status==='ready'?'Not saved in a card yet':'Upload awaiting cleanup');
    const remove=document.createElement('button');remove.type='button';remove.textContent='Delete unused image';remove.disabled=!!image.in_use;
    remove.onclick=async()=>{if(!confirm('Delete this unused upload? Any unsaved form using it will need a replacement.'))return;try{await api(card+'/media/'+image.id,{method:'DELETE'});await refreshMediaLibrary();callbacks.status('Unused image deleted.');}catch(error){callbacks.status(error.message);}};
    row.append(detail,remove);$('mediaItems').append(row);
  }
}
async function prepareImage(file){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Choose a JPEG, PNG or WebP image.');
  if(file.size>5*1024*1024)throw Error('Choose an image smaller than 5 MB.');
  const bitmap=await createImageBitmap(file);
  try{
    if(bitmap.width>8000||bitmap.height>8000||bitmap.width*bitmap.height>24000000)throw Error('Choose an image under 24 megapixels.');
    const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const context=canvas.getContext('2d');if(!context)throw Error('Your browser could not prepare the image.');context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Your browser could not prepare the image.')),'image/webp',0.86));
  }finally{bitmap.close();}
}
export function enhanceImageField(entry,label){
  const group=document.createElement('div');group.className='image-field';group.append(entry.label);entry.label=group;
  const preview=document.createElement('img');preview.className='image-preview';preview.alt=label+' preview';preview.loading='lazy';
  const render=()=>{preview.hidden=!entry.input.value;preview.src=entry.input.value||'';};entry.input.addEventListener('input',render);render();entry.label.append(preview);
  if(!enabled)return;
  const chooserLabel=document.createElement('label');chooserLabel.className='upload-label';chooserLabel.textContent='Choose image from your device';
  const chooser=document.createElement('input');chooser.type='file';chooser.accept='image/jpeg,image/png,image/webp';chooser.setAttribute('aria-label','Upload '+label.toLowerCase());
  const help=document.createElement('small');help.textContent='JPEG, PNG or WebP, up to 5 MB. Images are resized for faster loading.';
  chooser.onchange=async()=>{
    const file=chooser.files?.[0],card=activeCard;if(!file)return;if(pending){callbacks.status('Wait for the current upload to finish.');chooser.value='';return;}
    pending++;chooser.disabled=true;callbacks.status('Preparing and uploading image…');
    try{
      const blob=await prepareImage(file);const data=await api(card+'/media',{method:'POST',headers:{'Content-Type':blob.type},body:blob});
      if(activeCard===card&&entry.input.isConnected){entry.input.value=data.url;render();callbacks.changed();callbacks.status('Image uploaded privately. Save the draft, then publish when ready.');await refreshMediaLibrary().catch(()=>{});}
    }catch(error){callbacks.status(error.message||'The image could not be uploaded.');}finally{pending--;chooser.disabled=false;chooser.value='';}
  };
  chooserLabel.append(chooser);entry.label.append(chooserLabel,help);
}

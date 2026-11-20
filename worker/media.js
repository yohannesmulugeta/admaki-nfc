export class MediaError extends Error { constructor(message,status=400){super(message);this.status=status;} }
const fail=(message,status)=>{throw new MediaError(message,status);};
export const MAX_IMAGE_BYTES=5*1024*1024;
const MAX_COMPANY_BYTES=100*1024*1024;
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const referenceCheck=`EXISTS(SELECT 1 FROM cards c,json_tree(c.published_json) j WHERE c.id=media_assets.card_id AND j.type='text' AND j.value=media_assets.public_path)
 OR EXISTS(SELECT 1 FROM cards c,json_tree(c.draft_json) j WHERE c.id=media_assets.card_id AND j.type='text' AND j.value=media_assets.public_path)
 OR EXISTS(SELECT 1 FROM card_revisions r,json_tree(r.profile_json) j WHERE r.card_id=media_assets.card_id AND j.type='text' AND j.value=media_assets.public_path)`;
// Rechecked within the card UPDATE transaction, so cleanup cannot race a draft save.
export const availableMediaSQL=`NOT EXISTS(SELECT 1 FROM json_tree(?) ref WHERE ref.type='text' AND ref.value GLOB '/media/*'
 AND NOT EXISTS(SELECT 1 FROM media_assets a WHERE a.public_path=ref.value AND a.card_id=? AND a.status='ready'))`;
async function bytes(req){
  if(Number(req.headers.get('content-length'))>MAX_IMAGE_BYTES)fail('Choose an image smaller than 5 MB',413);
  const reader=req.body?.getReader();if(!reader)fail('Choose an image');
  const chunks=[];let total=0;
  while(true){const {value,done}=await reader.read();if(done)break;total+=value.byteLength;if(total>MAX_IMAGE_BYTES){await reader.cancel();fail('Choose an image smaller than 5 MB',413);}chunks.push(value);}
  const data=new Uint8Array(total);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.byteLength;}return data;
}
export function imageInfo(data,type){
  const view=new DataView(data.buffer,data.byteOffset,data.byteLength);let width=0,height=0,extension;
  const text=(at,size)=>String.fromCharCode(...data.slice(at,at+size));
  if(type==='image/png'&&data.length>=33&&text(1,3)==='PNG'&&data[0]===137&&data[4]===13&&data[5]===10&&data[6]===26&&data[7]===10&&view.getUint32(8)===13&&text(12,4)==='IHDR'){
    width=view.getUint32(16);height=view.getUint32(20);extension='png';
  }else if(type==='image/jpeg'&&data.length>10&&data[0]===255&&data[1]===216&&data.at(-2)===255&&data.at(-1)===217){
    extension='jpg';let offset=2;
    while(offset+4<data.length){if(data[offset++]!==255)break;while(data[offset]===255)offset++;const marker=data[offset++];if(marker===0xda||marker===0xd9)break;if(marker===0x01||marker>=0xd0&&marker<=0xd7)continue;const length=view.getUint16(offset);if(length<2||offset+length>data.length)break;
      if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)&&length>=8){height=view.getUint16(offset+3);width=view.getUint16(offset+5);break;}offset+=length;
    }
  }else if(type==='image/webp'&&data.length>=30&&text(0,4)==='RIFF'&&text(8,4)==='WEBP'&&view.getUint32(4,true)+8===data.length){
    extension='webp';const chunk=text(12,4);
    if(chunk==='VP8X'){width=1+data[24]+(data[25]<<8)+(data[26]<<16);height=1+data[27]+(data[28]<<8)+(data[29]<<16);}
    else if(chunk==='VP8 '&&data[23]===0x9d&&data[24]===1&&data[25]===0x2a){width=view.getUint16(26,true)&0x3fff;height=view.getUint16(28,true)&0x3fff;}
    else if(chunk==='VP8L'&&data[20]===0x2f){const bits=view.getUint32(21,true);width=1+(bits&0x3fff);height=1+((bits>>>14)&0x3fff);}
  }
  if(!extension||!width||!height)fail('This file is not a valid JPEG, PNG or WebP image',415);
  if(width>8000||height>8000||width*height>24000000)fail('Image dimensions are too large. Choose an image under 24 megapixels',413);
  return {width,height,extension};
}
export async function validateMediaReferences(env,card,profile){
  const result=await env.DB.prepare('SELECT '+availableMediaSQL+' AS valid').bind(JSON.stringify(profile),card.id).first();
  if(!result.valid)fail('One of the uploaded images is unavailable or belongs to another card');
}
export async function uploadMedia(req,env,user,card){
  if(!env.MEDIA||!env.MEDIA_LIMITER)fail('Image uploads are not enabled yet',503);
  if(!(await env.MEDIA_LIMITER.limit({key:'upload:'+user.id})).success)fail('Too many uploads. Please try again shortly.',429);
  const type=(req.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
  if(!['image/jpeg','image/png','image/webp'].includes(type))fail('Choose a JPEG, PNG or WebP image',415);
  const data=await bytes(req),info=imageInfo(data,type),id=crypto.randomUUID(),url=`/media/${id}.${info.extension}`;
  const key=`organizations/${card.organization_id}/cards/${card.id}/${id}.${info.extension}`;
  // Reserve quota in one SQLite statement before writing the object, including pending uploads.
  const reserved=await env.DB.prepare(`INSERT INTO media_assets(id,organization_id,card_id,created_by,object_key,public_path,content_type,byte_size)
    SELECT ?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM media_assets WHERE card_id=?)<100
    AND (SELECT COALESCE(SUM(byte_size),0) FROM media_assets WHERE organization_id=?)<=?`).bind(id,card.organization_id,card.id,user.id,key,url,type,data.length,card.id,card.organization_id,MAX_COMPANY_BYTES-data.length).run();
  if(!reserved.meta.changes)fail('Image storage is full. Remove unused uploads before adding more.',409);
  try{
    await env.MEDIA.put(key,data,{httpMetadata:{contentType:type}});
    await env.DB.batch([
      env.DB.prepare("UPDATE media_assets SET status='ready',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'").bind(id),
      env.DB.prepare('INSERT INTO audit_events(id,actor_user_id,organization_id,card_id,action) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),user.id,card.organization_id,card.id,'media.upload:'+id)
    ]);
  }catch{
    // Keep the reservation if object deletion fails; daily cleanup can safely retry it.
    try{await env.MEDIA.delete(key);await env.DB.prepare('DELETE FROM media_assets WHERE id=?').bind(id).run();}catch{}
    fail('Upload could not be completed. Please try again.',503);
  }
  return json({id,url,contentType:type,bytes:data.length,width:info.width,height:info.height},201);
}
export async function listMedia(env,card){
  if(!env.MEDIA)return json({enabled:false,media:[]});
  const rows=await env.DB.prepare(`SELECT id,public_path AS url,byte_size AS bytes,status,created_at,(${referenceCheck}) AS in_use FROM media_assets WHERE card_id=? ORDER BY created_at DESC LIMIT 100`).bind(card.id).all();
  return json({enabled:true,media:rows.results});
}
export async function deleteMedia(env,card,id,user){
  if(!env.MEDIA)fail('Image uploads are not enabled yet',503);
  const row=await env.DB.prepare('SELECT * FROM media_assets WHERE id=? AND card_id=?').bind(id,card.id).first();if(!row)fail('Image not found',404);
  const result=await env.DB.prepare(`UPDATE media_assets SET status='deleting',updated_at=CURRENT_TIMESTAMP WHERE id=? AND card_id=? AND NOT (${referenceCheck})`).bind(id,card.id).run();
  if(!result.meta.changes)fail('This image is used by a draft, public card or saved version',409);
  try{await env.MEDIA.delete(row.object_key);}catch{fail('Image removal could not be completed. Please try again.',503);}
  const statements=[env.DB.prepare("DELETE FROM media_assets WHERE id=? AND status='deleting'").bind(id)];
  if(user)statements.push(env.DB.prepare('INSERT INTO audit_events(id,actor_user_id,organization_id,card_id,action) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),user.id,card.organization_id,card.id,'media.delete:'+id));
  await env.DB.batch(statements);return json({ok:true});
}
export async function serveMedia(req,env,sessionUser){
  const path=new URL(req.url).pathname;if(!/^\/media\/[a-f0-9-]{36}\.(?:jpg|png|webp)$/.test(path)||!env.DB||!env.MEDIA)fail('Image not found',404);
  const row=await env.DB.prepare(`SELECT a.*,EXISTS(SELECT 1 FROM cards c,json_tree(c.published_json) j WHERE c.id=a.card_id AND j.type='text' AND j.value=a.public_path) AS is_published FROM media_assets a WHERE a.public_path=? AND a.status='ready'`).bind(path).first();
  if(!row)fail('Image not found',404);
  if(!row.is_published){const user=await sessionUser(req,env);if(!user)fail('Image not found',404);if(!user.is_platform_admin&&!await env.DB.prepare('SELECT 1 AS allowed FROM memberships WHERE user_id=? AND organization_id=?').bind(user.id,row.organization_id).first())fail('Image not found',404);}
  const object=await env.MEDIA[req.method==='HEAD'?'head':'get'](row.object_key);if(!object)fail('Image not found',404);
  return new Response(req.method==='HEAD'?null:object.body,{headers:{'content-type':row.content_type,'content-length':String(object.size),'cache-control':'no-store','vary':'Cookie','etag':object.httpEtag,'x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; sandbox",'cross-origin-resource-policy':'same-origin'}});
}
export async function cleanupMedia(env){
  if(!env.MEDIA||!env.DB)return;
  const rows=await env.DB.prepare(`SELECT id,card_id,organization_id FROM media_assets WHERE ((status='pending' AND created_at<datetime('now','-1 day')) OR (status='ready' AND created_at<datetime('now','-7 days')) OR (status='deleting' AND updated_at<datetime('now','-1 hour'))) AND NOT (${referenceCheck}) ORDER BY created_at LIMIT 25`).all();
  let deleted=0;for(const row of rows.results){try{await deleteMedia(env,{id:row.card_id,organization_id:row.organization_id},row.id,null);deleted++;}catch{}}
  if(rows.results.length)console.log(JSON.stringify({event:'media_cleanup',checked:rows.results.length,deleted}));
}

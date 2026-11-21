import {vcard} from './profile.js';
import {imageInfo} from './media.js';
export async function embeddedPhoto(env,profile,cardId){
 let path=profile.contactPhoto;if(!path)return undefined;
 if(!path.startsWith('/')||path.startsWith('//'))throw Error('Saved contact photo must be stored in this platform');
 let bytes,type;
 if(path.startsWith('/media/')){
  const media=await env.DB.prepare("SELECT object_key,content_type,byte_size FROM media_assets WHERE public_path=? AND card_id=? AND status='ready'").bind(path,cardId).first();
  if(!media||media.byte_size>524288)throw Error('Saved contact photo is unavailable or too large');
  const object=await env.MEDIA?.get(media.object_key);if(!object)throw Error('Saved contact photo unavailable');bytes=new Uint8Array(await object.arrayBuffer());type=media.content_type;
 }else{
  // Explicit static asset aliases keep old saved revisions compatible with JPEG contact imports.
  if(path.endsWith('.webp')){const response=await env.ASSETS.fetch(new Request('https://assets.local/profiles/contact-photo-aliases.json'));if(response.ok){const aliases=await response.json();path=aliases[path]||path;}}
  if(!/^\/(?:profiles|brand)\/[a-zA-Z0-9_./-]+$/.test(path))throw Error('Unsupported contact photo path');
  const response=await env.ASSETS.fetch(new Request('https://assets.local'+path));if(!response.ok)throw Error('Saved contact photo unavailable');
  if(Number(response.headers.get('content-length'))>524288)throw Error('Saved contact photo is too large');bytes=new Uint8Array(await response.arrayBuffer());
  type=path.toLowerCase().endsWith('.png')?'image/png':'image/jpeg';
 }
 if(bytes.length>524288)throw Error('Saved contact photo is too large');
 if(!['image/jpeg','image/png'].includes(type))throw Error('Use a JPEG or PNG saved contact photo');imageInfo(bytes,type);
 let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return {type:type==='image/jpeg'?'JPEG':'PNG',base64:btoa(binary)};
}
export async function contactResponse(req,env,card){const profile=JSON.parse(card.published_json);const photo=await embeddedPhoto(env,profile,card.id);return new Response(req.method==='HEAD'?null:vcard(profile,new URL(req.url).origin,photo),{headers:{'content-type':'text/vcard; charset=utf-8','content-disposition':`attachment; filename="${card.slug.replaceAll('/','-')}.vcf"`,'cache-control':'no-store','x-content-type-options':'nosniff'}});}

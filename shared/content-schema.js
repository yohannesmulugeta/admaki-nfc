export const safeURL=(value,local=false)=>{
 if(!value)return true;if(typeof value!=='string'||/[\u0000-\u0020\\]/.test(value))return false;
 if(local&&value.startsWith('/')&&!value.startsWith('//'))return true;
 try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password;}catch{return false;}
};
const forbidden=new Set(['__proto__','constructor','prototype']);
export function validateContent(next,old,schema){
 if(!next||typeof next!=='object'||Array.isArray(next)||next.slug!==old.slug||next.source!==old.source||next.theme!==old.theme)throw Error('Permanent card address, source and template cannot change');
 const fields=schema.fields||{};
 for(const key of Object.keys(next))if(forbidden.has(key)||!['slug','source','theme'].includes(key)&&!Object.hasOwn(fields,key))throw Error('Unexpected profile field: '+key);
 function check(value,field,path){
  if(field.type==='array'){
   if(!Array.isArray(value)||value.length>(field.maxItems||30))throw Error('Invalid '+path);
   for(const [index,item]of value.entries()){if(!item||typeof item!=='object'||Array.isArray(item))throw Error('Invalid '+path);for(const [k,rule]of Object.entries(field.items))if(rule.required&&!Object.hasOwn(item,k))throw Error('Missing '+path+' '+k);for(const k of Object.keys(item)){if(forbidden.has(k)||!Object.hasOwn(field.items,k))throw Error('Unexpected '+path+' field');check(item[k],field.items[k],path+' '+index+' '+k);}}return;
  }
  if(field.type==='object'){if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid '+path);for(const k of Object.keys(value)){if(forbidden.has(k)||!Object.hasOwn(field.properties,k))throw Error('Unexpected '+path+' field');check(value[k],field.properties[k],path+' '+k);}return;}
  if(typeof value!=='string'||value.length>(field.maxLength||4000)||/[\u0000\r\n]/.test(value)&&field.type!=='textarea')throw Error('Invalid '+path);
  if(field.required&&!value.trim())throw Error(path+' is required');
  if(field.type==='email'&&value&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))throw Error('Invalid '+path);
  if(field.type==='tel'&&value&&!/^\+?[0-9 ()-]{5,30}$/.test(value))throw Error('Invalid phone');
  if(field.type==='digits'&&value&&!/^[0-9]{5,20}$/.test(value))throw Error('Use digits including the country code');
  if(['url','image','contactImage'].includes(field.type)&&!safeURL(value,field.type!=='url'))throw Error('Invalid link for '+path);
  if(field.type==='contactImage'&&value&&!/^\/(?!\/)/.test(value))throw Error('Upload the saved contact photo here so it can be embedded reliably');
 }
 for(const [key,field]of Object.entries(fields)){if(field.required&&!(key in next))throw Error(key+' is required');if(field.readOnly&&JSON.stringify(next[key])!==JSON.stringify(old[key]))throw Error(key+' is read only');if(key in next)check(next[key],field,key);}
 if(new TextEncoder().encode(JSON.stringify(next)).length>65000)throw Error('Profile is too large');
}

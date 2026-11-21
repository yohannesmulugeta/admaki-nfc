import {JSDOM} from 'jsdom';
export function compileTemplate(html,manifest,baseline={}){
 const dom=new JSDOM(html),document=dom.window.document,slots=[];
 const marker=slot=>{const id=slots.push(slot)-1;return '@@ADMAKI_'+id+'@@';};
 function compile(root,bindings,values){
  for(const b of [...(bindings||[])].sort((a,b)=>({repeat:0,image:1,text:1,attribute:2,optionalHTML:3}[a.type]??1)-({repeat:0,image:1,text:1,attribute:2,optionalHTML:3}[b.type]??1))){const targets=b.selector==='$'?[root]:Array.from(root.querySelectorAll(b.selector));
   for(const el of targets){
    if(b.type==='repeat'){
     const rows=Array.from(el.children).map((row,i)=>{const local=compileFragment(row,b.bindings,(values[b.key]||[])[i]||{});return {...local,match:(values[b.key]||[])[i]?.name||(values[b.key]||[])[i]?.title};});
     if(!rows.length&&b.itemHTML){const tmp=document.createElement('div');tmp.innerHTML=b.itemHTML;rows.push(compileFragment(tmp.firstElementChild,b.bindings,{}));}
     el.innerHTML=marker({...b,rows});
    }else if(b.type==='image'){
     const clone=el.cloneNode(true);clone.removeAttribute('hidden');clone.setAttribute('src','@@IMAGE_SOURCE@@');clone.setAttribute('alt','@@IMAGE_ALT@@');
     el.replaceWith(document.createTextNode(marker({...b,html:clone.outerHTML,alt:b.alt||el.getAttribute('alt')||''})));
    }else if(b.type==='optionalHTML'){el.replaceWith(document.createTextNode(marker({...b,html:el.outerHTML})));}
    else if(b.type==='attribute')el.setAttribute(b.attribute,marker(b));
    else if(b.type==='optional'){const local=compileFragment(el,b.bindings||[],values);el.replaceWith(document.createTextNode(marker({...b,...local})));}
    else {const val=String(b.key||'').split('.').reduce((v,k)=>v?.[k],values);el.innerHTML=marker({...b,defaultHTML:el.innerHTML,defaultValue:val});}
   }
  }
 }
 function compileFragment(el,bindings,values){const save=slots.splice(0);compile(el,bindings,values);const local={html:el.outerHTML,slots:slots.splice(0)};slots.push(...save);return local;}
 compile(document,manifest.bindings,baseline);
 // Canonical URLs, contact downloads and QR destinations always follow this card.
 for(const el of document.querySelectorAll('link[rel=canonical],meta[property="og:url"],[data-card-url]')){
  const attr=el.tagName==='META'?'content':el.tagName==='LINK'?'href':'data-card-url';el.setAttribute(attr,marker({type:'attribute',attribute:attr,compute:'cardUrl'}));
 }
 for(const el of document.querySelectorAll('a[href$=".vcf"]'))el.setAttribute('href',marker({type:'attribute',attribute:'href',compute:'contactUrl'}));
 for(const el of document.querySelectorAll('img.qr-image'))el.setAttribute('src',marker({type:'attribute',attribute:'src',compute:'qrUrl'}));
 for(const el of document.querySelectorAll('a[href$="qr.svg"],a[href$="qr.png"]'))el.setAttribute('href',marker({type:'attribute',attribute:'href',compute:el.getAttribute('href').endsWith('.png')?'qrPng':'qrUrl'}));
 for(const el of document.querySelectorAll('title,meta[property="og:title"],meta[name="twitter:title"]')){const slot={type:el.tagName==='META'?'attribute':'text',attribute:'content',compute:'title'};if(el.tagName==='META')el.setAttribute('content',marker(slot));else el.textContent=marker(slot);}
 for(const el of document.querySelectorAll('meta[name=description],meta[property="og:description"]'))el.setAttribute('content',marker({type:'attribute',attribute:'content',key:'description',fallback:'companyDescription'}));
 for(const el of document.querySelectorAll('[data-card-name]'))el.setAttribute('data-card-name',marker({type:'attribute',attribute:'data-card-name',key:'name'}));
 for(const el of document.querySelectorAll('#card-url'))el.setAttribute('value',marker({type:'attribute',attribute:'value',compute:'cardUrl'}));
 for(const el of document.querySelectorAll('#qr-title'))el.textContent=marker({type:'text',key:'name'});
 const output={...manifest,html:dom.serialize(),slots};delete output.bindings;return output;
}

import { readFileSync, writeFileSync } from 'node:fs';
const escape=(s)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const data=JSON.parse(readFileSync(new URL('./items.json',import.meta.url),'utf8'));
const buttonSvg=(left)=>'<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="'+(left?'m15 5-7 7 7 7':'m9 5 7 7-7 7')+'"/></svg>';
const sections=data.categories.map(group=>{
 const cards=group.items.map(item=>{
  const label=escape(item.label),url=escape(data.imageBase+item.file);
  return '<figure class="gtg-card"><button type="button" class="gtg-view" data-gallery-open="'+url+'" data-gallery-label="'+label+'" aria-label="Enlarge '+label+'"><img src="'+url+'" alt="'+label+'" loading="lazy" decoding="async"></button><figcaption class="gtg-caption">'+label+'</figcaption></figure>';
 }).join('\n');
 return '<section class="gtg-group" aria-labelledby="gtg-'+group.id+'"><div class="gtg-head"><h3 id="gtg-'+group.id+'">'+escape(group.title)+'<span class="gtg-count">'+group.items.length+' photos</span></h3><div class="gtg-arrows"><button type="button" class="gtg-arrow" data-gallery-prev aria-label="Scroll '+group.id+' left">'+buttonSvg(true)+'</button><button type="button" class="gtg-arrow" data-gallery-next aria-label="Scroll '+group.id+' right">'+buttonSvg(false)+'</button></div></div><div class="gtg-track" tabindex="0" role="region" aria-label="'+escape(group.title)+' photo carousel">'+cards+'</div></section>';
}).join('\n');
const output='<section class="gtg" aria-labelledby="gtg-title"><p class="gtg-kicker">Trade portfolio</p><h2 class="gtg-title" id="gtg-title">'+escape(data.title)+'</h2><p class="gtg-intro">'+escape(data.description)+'</p>'+sections+'<p class="gtg-hint">← <strong>Swipe left</strong> to explore more →</p></section><dialog class="gtg-dialog" id="gtg-photo-dialog" aria-label="Product photo"><form method="dialog"><button type="submit" class="gtg-close" aria-label="Close">×</button></form><img alt=""><p data-gallery-caption></p></dialog>';
writeFileSync(new URL('./gallery.fragment.html',import.meta.url),output+'\n');
console.log('GESAGIS gallery markup generated: '+data.categories.reduce((sum,g)=>sum+g.items.length,0)+' photos.');

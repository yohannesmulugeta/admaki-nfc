(() => {
 const root=document.querySelector('.gtg'); if(!root) return;
 root.querySelectorAll('.gtg-group').forEach(group=>{
  const track=group.querySelector('.gtg-track'),prev=group.querySelector('[data-gallery-prev]'),next=group.querySelector('[data-gallery-next]');
  if(!track||!prev||!next)return;
  const state=()=>{prev.disabled=track.scrollLeft<3;next.disabled=track.scrollLeft+track.clientWidth>=track.scrollWidth-3;};
  const shift=(direction)=>{const card=track.querySelector('.gtg-card');const gap=parseFloat(getComputedStyle(track).gap)||11;track.scrollBy({left:direction*((card?.getBoundingClientRect().width||160)+gap),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};
  prev.addEventListener('click',()=>shift(-1));next.addEventListener('click',()=>shift(1));
  track.addEventListener('scroll',state,{passive:true});
  track.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();shift(e.key==='ArrowRight'?1:-1);}});
  if('ResizeObserver'in window)new ResizeObserver(state).observe(track);else addEventListener('resize',state);
  state();
 });
 const dialog=document.querySelector('#gtg-photo-dialog');if(!dialog)return;
 const img=dialog.querySelector('img'),caption=dialog.querySelector('[data-gallery-caption]');
 root.querySelectorAll('[data-gallery-open]').forEach(button=>button.addEventListener('click',()=>{
  img.src=button.dataset.galleryOpen;img.alt=button.dataset.galleryLabel||'Product photo';caption.textContent=button.dataset.galleryLabel||'';dialog.showModal();
 }));
 dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
 dialog.addEventListener('close',()=>img.removeAttribute('src'));
})();
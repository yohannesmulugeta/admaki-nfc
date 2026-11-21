const dialog = document.querySelector('#qr-dialog');
const feedback = document.querySelector('.feedback');
const share = document.querySelector('[data-share]');
document.querySelectorAll('[data-open-qr]').forEach((button) => {
  button.addEventListener('click', () => dialog.showModal());
});
dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
share.addEventListener('click', async () => {
  const url = share.dataset.cardUrl;
  if (navigator.share) {
    try { await navigator.share({ title: share.dataset.cardName, url }); return; }
    catch (error) { if (error.name === 'AbortError') return; }
  }
  try {
    await navigator.clipboard.writeText(url);
    feedback.textContent = 'Card link copied. Ready to share.';
  } catch {
    const fallback = document.querySelector('.copy-fallback');
    fallback.hidden = false;
    fallback.querySelector('input').focus();
    fallback.querySelector('input').select();
    feedback.textContent = 'Select and copy the link below to share this card.';
  }
});


// Apply published content to the existing card without changing permanent links.
(async function refreshPublishedCard(){
  const slug=location.pathname.split('/').filter(Boolean).join('/');
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/.test(slug))return;
  try{
    const response=await fetch('/api/public/cards/'+slug,{cache:'no-store'});
    if(!response.ok)return;
    const {profile:p}=await response.json();
    const {renderProfile}=await import('/profiles/render-profile.js');
    renderProfile(p);
  }catch(error){console.warn('Published profile unavailable; showing static card.',error)}
})();

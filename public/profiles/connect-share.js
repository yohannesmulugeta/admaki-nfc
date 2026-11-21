document.getElementById('share-card')?.addEventListener('click', async () => {
  const url = document.querySelector('link[rel="canonical"]').href;
  const status = document.getElementById('share-status');
  try {
    if (navigator.share) await navigator.share({ title: document.title, url });
    else {
      await navigator.clipboard.writeText(url);
      if (status) status.textContent = 'Contact page link copied.';
    }
  } catch (error) {
    if (error.name === 'AbortError') return;
    if (status) status.textContent = `Share this link: ${url}`;
  }
});

(async()=>{try{const slug=location.pathname.split('/').filter(Boolean).join('/');const response=await fetch('/api/public/cards/'+slug,{cache:'no-store'});if(!response.ok)return;const {profile}=await response.json();const {renderProfile}=await import('/profiles/render-profile.js');renderProfile(profile);}catch{ /* The verified static card remains available during an API outage. */ }})();

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

export const $ = id => document.getElementById(id);
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths = {
  overview:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  companies:'<path d="M4 21V5l8-2v18M12 8h8v13M2 21h20M7 8h2m-2 4h2m-2 4h2m6-4h2m-2 4h2"/>',
  cards:'<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="8" cy="11" r="2"/><path d="M6 16h4m4-6h4m-4 4h3"/>',
  account:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  arrow:'<path d="m7 17 10-10M7 7h10v10"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  back:'<path d="m12 5-7 7 7 7M5 12h14"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  logout:'<path d="M9 4H4v16h5m5-13 5 5-5 5m-5-5h11"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  globe:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  edit:'<path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15v5Z"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1"/><path d="m3 16 5-5 5 5 3-3 5 5"/>'
};
export const icon = name => `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.cards}</svg>`;
export function icons(){document.querySelectorAll('[data-icon]').forEach(el => {el.innerHTML=icon(el.dataset.icon);});}
export function formatDate(value){if(!value)return 'No recent changes';const date=new Date(value.endsWith('Z')?value:value.replace(' ','T')+'Z');return Number.isNaN(+date)?value:new Intl.DateTimeFormat('en',{month:'short',day:'numeric',year:'numeric'}).format(date);}
export function badge(draft){return `<span class="badge ${draft?'draft':'published'}"><span></span>${draft?'Draft saved':'Published'}</span>`;}
export function setupShell(){
  icons();const toggle=$('menuToggle'),backdrop=$('navBackdrop');
  const close=()=>{document.body.classList.remove('nav-open');toggle?.setAttribute('aria-expanded','false');};
  toggle?.addEventListener('click',()=>{const open=document.body.classList.toggle('nav-open');toggle.setAttribute('aria-expanded',String(open));if(open)document.querySelector('.sidebar nav button')?.focus();});
  backdrop?.addEventListener('click',close);document.addEventListener('keydown',event=>{if(event.key==='Escape')close();});
  document.querySelectorAll('.sidebar nav button').forEach(button=>button.addEventListener('click',close));
}
export function navigate(name){document.querySelectorAll('[data-page]').forEach(page=>page.hidden=page.dataset.page!==name);document.querySelectorAll('[data-nav]').forEach(button=>{const active=button.dataset.nav===name;button.classList.toggle('active',active);if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});}
export async function confirmAction(title,description,action='Continue',danger=false){
  const dialog=document.createElement('dialog');dialog.className='modal confirm-modal';
  dialog.innerHTML=`<form method="dialog"><div class="modal-heading"><span class="eyebrow">PLEASE CONFIRM</span><button class="icon-button" value="cancel" aria-label="Close confirmation">${icon('close')}</button></div><h2>${escapeHTML(title)}</h2><p>${escapeHTML(description)}</p><div class="dialog-actions"><button class="button secondary" value="cancel">Cancel</button><button class="button ${danger?'danger':''}" value="confirm">${escapeHTML(action)}</button></div></form>`;
  document.body.append(dialog);return new Promise(resolve=>{dialog.addEventListener('close',()=>{const accepted=dialog.returnValue==='confirm';dialog.remove();resolve(accepted);},{once:true});dialog.showModal();dialog.querySelector('[value="cancel"]').focus();});
}
export function cardMarkup(card,org){
  const url='/'+card.slug+'/',edit='/dashboard/?organization='+encodeURIComponent(org||card.organization_id)+'&card='+encodeURIComponent(card.id);
  const image=card.cover&&(/^(\/(?!\/)|https:\/\/)/).test(card.cover)?card.cover:'/profiles/maison-debrah/showroom.webp';
  return `<article class="digital-card"><a class="card-cover" href="${escapeHTML(edit)}" tabindex="-1"><img src="${escapeHTML(image)}" alt="" loading="lazy">${badge(card.has_draft)}</a><div class="digital-card-body"><p class="eyebrow">${escapeHTML(card.organization_name||'DIGITAL CARD')}</p><h3>${escapeHTML(card.label)}</h3><a class="card-url" href="${escapeHTML(url)}" target="_blank" rel="noopener">/${escapeHTML(card.slug)}/ ${icon('arrow')}</a><p class="updated">Updated ${escapeHTML(formatDate(card.updated_at))}</p><a class="button secondary full" href="${escapeHTML(edit)}">${icon('edit')} Edit card</a></div></article>`;
}

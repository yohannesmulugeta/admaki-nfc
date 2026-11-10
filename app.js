const profiles = {
  personal: {
    heading: 'Make your next introduction personal.',
    description: 'A place for your name, what you do, and the links that help people get to know your work.',
    cover: 'A LITTLE INTRODUCTION.', avatar: 'YN', name: 'Your name',
    role: 'Your role · Your next chapter',
    bio: 'A little about you, the work you love, and what you bring to the table.',
    link: 'Explore my work', contact: 'Sample Personal Profile',
    work: 'Your portfolio, social profile, or personal website can open here. This is an illustrative preview.'
  },
  business: {
    heading: 'Give your business a memorable introduction.',
    description: 'Bring your company story, key contacts, services, and website together in a profile that reflects your brand.',
    cover: 'GOOD BUSINESS STARTS HERE.', avatar: 'YB', name: 'Your business',
    role: 'Your industry · Your brand',
    bio: 'Introduce what you do, what makes your business different, and how to reach you.',
    link: 'Discover our services', contact: 'Sample Business Profile',
    work: 'Your company website, catalogue, or services page can open here. This demo is not a real business listing.'
  },
  team: {
    heading: 'One team. A consistent first impression.',
    description: 'Keep the brand consistent while giving each person a profile with their own role, contact details, and links.',
    cover: 'PART OF SOMETHING GREAT.', avatar: 'TM', name: 'Your team member',
    role: 'Their role · Your company',
    bio: 'A professional introduction with individual contact details and your company’s identity.',
    link: 'Meet our company', contact: 'Sample Team Member',
    work: 'Your team member’s company page or a relevant service can open here. This preview does not manage real staff accounts.'
  }
};

const $ = (selector) => document.querySelector(selector);
let currentProfile = 'personal';
const tabs = [...document.querySelectorAll('[data-profile]')];
const panel = $('#profile-preview');

function selectProfile(key, focus = false) {
  if (!Object.hasOwn(profiles, key)) return;
  const p = profiles[key];
  currentProfile = key;
  const values = { 'demo-heading': p.heading, 'demo-description': p.description, 'demo-cover-text': p.cover, 'demo-avatar': p.avatar, 'demo-name': p.name, 'demo-role': p.role, 'demo-bio': p.bio, 'demo-link-label': p.link };
  for (const [id, value] of Object.entries(values)) document.getElementById(id).textContent = value;
  panel.dataset.theme = key;
  panel.setAttribute('aria-labelledby', `tab-${key}`);
  for (const tab of tabs) {
    const selected = tab.dataset.profile === key;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected && focus) tab.focus();
  }
  $('#demo-feedback').textContent = 'Try the buttons to preview your contact options.';
}

for (const [index, tab] of tabs.entries()) {
  tab.addEventListener('click', () => selectProfile(tab.dataset.profile));
  tab.addEventListener('keydown', (event) => {
    let next;
    if (['ArrowRight', 'ArrowDown'].includes(event.key)) next = (index + 1) % tabs.length;
    if (['ArrowLeft', 'ArrowUp'].includes(event.key)) next = (index + tabs.length - 1) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next !== undefined) {
      event.preventDefault();
      selectProfile(tabs[next].dataset.profile, true);
    }
  });
}

const actionMessages = {
  phone: 'Your phone button would open the phone’s dialler. This sample does not place a call.',
  whatsapp: 'Your WhatsApp button would open a conversation with you. This sample does not send a message.',
  email: 'Your email button would open an email addressed to you. This sample does not send email.'
};
document.querySelectorAll('[data-demo-action]').forEach((button) => button.addEventListener('click', () => {
  $('#demo-feedback').textContent = actionMessages[button.dataset.demoAction];
}));
$('#demo-work').addEventListener('click', () => { $('#demo-feedback').textContent = profiles[currentProfile].work; });

$('#save-sample').addEventListener('click', () => {
  const p = profiles[currentProfile];
  // Deliberately use reserved example details, never a real person's information.
  const vcard = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${p.contact}`, `N:${p.contact};;;;`, 'ORG:Example Company (Demonstration)', 'EMAIL;TYPE=WORK:hello@example.com', 'URL:https://example.com', 'NOTE:Illustrative ADMAKI demo contact. Not a real person or company.', 'END:VCARD', ''].join('\r\n');
  const url = URL.createObjectURL(new Blob([vcard], { type: 'text/vcard;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `admaki-${currentProfile}-sample.vcf`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  $('#demo-feedback').textContent = 'Sample contact downloaded. Open the .vcf file to preview it; your phone will ask before saving.';
});

const toggle = $('.menu-toggle');
const navigation = $('#navigation');
function closeMenu() { navigation.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); }
toggle.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') !== 'true';
  navigation.classList.toggle('is-open', open);
  toggle.setAttribute('aria-expanded', String(open));
});
navigation.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { closeMenu(); toggle.focus(); }
});
document.addEventListener('click', (event) => { if (!event.target.closest('.site-header')) closeMenu(); });
window.matchMedia('(min-width: 651px)').addEventListener('change', closeMenu);

$('#enquiry-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const nameInput = form.elements.namedItem('name');
  nameInput.setCustomValidity(nameInput.value.trim() ? '' : 'Please enter your name.');
  if (!form.reportValidity()) return;
  const fields = new FormData(form);
  const name = String(fields.get('name')).trim();
  const company = String(fields.get('company')).trim();
  const interest = String(fields.get('interest'));
  const quantity = String(fields.get('quantity'));
  const note = String(fields.get('message')).trim();
  const message = [ 'Hello ADMAKI Digital, I’m interested in NFC business cards.', '', `Name: ${name}`, ...(company ? [`Company: ${company}`] : []), `Interested in: ${interest}`, `Number of cards: ${quantity}`, ...(note ? ['', `Message: ${note}`] : []) ].join('\n');
  const url = `https://wa.me/251937928215?text=${encodeURIComponent(message)}`;
  const result = $('#form-result');
  result.replaceChildren(document.createTextNode('Your enquiry is ready. '));
  const fallback = document.createElement('a');
  fallback.href = url;
  fallback.target = '_blank';
  fallback.rel = 'noopener noreferrer';
  fallback.textContent = 'Open WhatsApp';
  result.append(fallback, document.createTextNode(' if it did not open. Review the message, then send it when you’re ready.'));
  window.open(url, '_blank', 'noopener,noreferrer');
});
$('#enquiry-form [name="name"]').addEventListener('input', (event) => event.target.setCustomValidity(''));
$('#year').textContent = String(new Date().getFullYear());

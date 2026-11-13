# ADMAKI Digital Card

NFC business-card marketing website and hosted customer cards for ADMAKI Digital. Prices are intentionally omitted.

## Development

Use Node 22.12+ (Node 24 recommended).

```sh
npm ci
npm run dev
npm run check
```

`npm run build` produces `dist/`. Deploy that directory as static assets. There is no database, login, enquiry storage, or backend dependency.

## Experience

- Responsive black-card and phone illustrations built with CSS and local SVG icons.
- Personal, business, and team profile previews with keyboard-accessible tabs.
- Sample vCard download. Example records are clearly labelled and use reserved example.com addresses.
- Native FAQ accordions, responsive navigation, and reduced-motion support.
- Enquiry form opens a reviewable WhatsApp message to +251 93 792 8215. It does not send automatically or store details.
- Self-hosted Manrope and Noto Sans Ethiopic font (SIL Open Font License included), local icons, canonical metadata, sitemap, and security headers.

## Content and operations

The homepage is the marketing website, with clearly labelled illustrative demonstrations. Published customer cards have separate stable URLs and real contact actions. There is no customer profile management dashboard. Card production, delivery and updates are arranged separately. Homepage illustrations are concepts rather than photographs of stocked products. Confirm the final physical design and availability before accepting an order.

## Published customer cards

| Card | Permanent URL |
| --- | --- |
| Maison Debrah 01 | `https://nfc.admakidigital.com/maison-debrah/` |
| Maison Debrah 02 | `https://nfc.admakidigital.com/maison-debrah/02/` |
| Universal 01 | `https://nfc.admakidigital.com/universal/01/` |
| Universal 02 | `https://nfc.admakidigital.com/universal/02/` |
| KKGT 01 | `https://nfc.admakidigital.com/kkgt/01/` |
| KKGT 02 | `https://nfc.admakidigital.com/kkgt/02/` |

- Each URL identifies an independent card. Never rename or repurpose an issued route when a salesperson changes; update its record in place. Keep ownership of the domain and hosting active. Stable URLs preserve printed QR codes and NFC tags while content changes.
- Content: `profiles/maison-debrah.json`. This is a company card using the official logo rather than an individual portrait.
- Shared layout generator: `scripts/generate-profiles.mjs`; presentation and sharing controls: `public/profiles/profile.css` and `profile.js`.
- The build generates the pages, UTF-8 vCards with CRLF line endings, and SVG/1024 px PNG QR codes encoding each canonical card URL. The first Maison HTML/vCard/SVG remain tracked for compatibility. Other generated card outputs are ignored by Git and recreated before Vite copies `public/` into `dist/`.
- Maison logo and showroom photography are copied from the official Maison website repository. Contact details, opening hours and social destinations match that website as checked 13 November 2026. Fonts are self-hosted with their OFL licenses.
- Keep the profile URL stable for printed QR codes and programmed NFC tags. Edit the content record to change contact details, then build and redeploy.
- The showroom action links to the official contact page. An exact map pin has not been supplied.
- Build checks validate files and contact values. Physical NFC tap and iPhone/Android contact import still need testing on actual devices.

### Existing Connect pages

Universal and KKGT preserve the live content and layouts from `https://universalelectronicet.com/connect/` and `https://kkgtcoffee.com/connect/firaol/` captured on 13 November 2026. Both Universal copies initially show Mesfin; both KKGT copies initially show Firaol Kelbesa, General Manager. The existing source sites are unchanged. Their published phone numbers, emails, portraits and social/website links are intentionally retained; the owner has not approved replacement identities yet.

- Edit only the selected card's independent JSON record, e.g. `profiles/universal-02.json` or `profiles/kkgt-02.json`. Update its `fields` for name, name parts, role, phone, phoneDisplay, whatsapp, email(s), portrait and contactPhoto as applicable. Do not change `slug`.
- The two source layouts live under `profiles/templates/`. Local assets retain their source appearance. Website/category links resolve to the original company sites; Save Contact downloads that individual card's generated file.
- The shared Share control reads the current card's canonical URL, never the original company Connect URL. The inline Universal script has been externalized to retain the existing content security policy.
- `scripts/generate-connect-cards.mjs` renders each independent record and generates all six QR sets. `scripts/check-cards.mjs` decodes every PNG to verify its exact destination, checks contact/image consistency, and protects fixed source copy while allowing contact fields to change.
- PNG/SVG QR files are available at `<permanent-card-url>qr.png` and `qr.svg`. Use the actual generated files for printing, rather than a QR pattern depicted in an image mockup.

Edit `index.html` for copy; `styles.css` for presentation; `app.js` for demo profiles and WhatsApp enquiry behaviour. Contact number appears in HTML and JavaScript. Hosting target: https://nfc.admakidigital.com/.

Technical NFC copy was checked against [Apple background tag reading](https://developer.apple.com/documentation/corenfc/adding-support-for-background-tag-reading), [NFC Forum technology overview](https://nfc-forum.org/learn/nfc-technology/), and [NXP NTAG21x documentation](https://www.nxp.com/products/NTAG213_215_216). No specific chip, material, speed, or universal phone compatibility is promised.

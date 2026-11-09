# AdMaki NFC

NFC business-card marketing website for AdMaki Digital. Prices are intentionally omitted.

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
- Self-hosted DM Sans font (SIL Open Font License included), local icons, canonical metadata, sitemap, and security headers.

## Content and operations

This is the marketing website, not a customer profile management system. Demonstrations do not place calls, send emails, or create real profiles. Customer cards, their profiles, production, delivery, and ongoing updates are arranged separately. Illustrations are concepts rather than photographs of stocked products. Confirm the final physical design and availability before accepting an order.

Edit `index.html` for copy; `styles.css` for presentation; `app.js` for demo profiles and WhatsApp enquiry behaviour. Contact number appears in HTML and JavaScript. Hosting target: https://nfc.admakidigital.com/.

Technical NFC copy was checked against [Apple background tag reading](https://developer.apple.com/documentation/corenfc/adding-support-for-background-tag-reading), [NFC Forum technology overview](https://nfc-forum.org/learn/nfc-technology/), and [NXP NTAG21x documentation](https://www.nxp.com/products/NTAG213_215_216). No specific chip, material, speed, or universal phone compatibility is promised.

# GESAGIS horizontal product gallery — implementation source
All 11 photos are supplied by the client. The 5 Export and 6 Import photo filenames are registered in `items.json`.

**Use**: Run `node features/gesagis-trade-gallery/build-gallery.mjs` to generate a semantic carousel fragment. Integrate the fragment between **What We Do** and **Contact & Location** in the GESAGIS template and include `gallery.css` and `gallery.js`. Preserve current client contact details, Save Contact and both distinct NFC/WeChat QR actions.

**Asset requirement**: The optimized original client photographs must first be uploaded as `public/profiles/gesagis/gallery/<file>`. They are prepared in the conversation-delivered gallery ZIP. Do NOT activate the fragment on production until all 11 original files exist and serve as HTTPS images. Never use stock substitutes.

**Deployment warning**: As of 22 Nov 2026, nfc.admakidigital.com serves cards from a separate new Workers + D1 multi-tenant platform and template assets. The old `admaki-nfc` GitHub build is not the live deployment pipeline. Integrate the gallery in the current platform template via its authorized deployment/admin workflow; do not overwrite the live Worker with old static code.

Styling: native overflow-x horizontal scroll, CSS scroll snap, two horizontally swipeable rows, lazy-loaded images, keyboard/arrow support and modal enlarge. The media display is not proof of vehicle inventory, specific chemical composition, export licenses, or product availability.

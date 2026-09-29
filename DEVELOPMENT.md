# Development Guidelines - Sweetheart Taart

## CSS/HTML Conventions

### Always Use Semantic IDs and Classes

When writing HTML/Astro/Svelte code, **always** use meaningful, semantic `id` and `class` names so they can be easily targeted with CSS and JavaScript.

#### Rules:

1. **Use descriptive names** - Describe the content/function, not the style
   - ✅ `#feest-hero`, `.product-card`, `.gallery-trigger`
   - ❌ `.pink-box`, `.big-text`, `.left-div`

2. **Use lowercase with hyphens** for multi-word names
   - ✅ `.order-form`, `.contact-info`
   - ❌ `.orderForm`, `.contactInfo`, `.OrderForm`

3. **Prefix section IDs/classes** with the page or feature name
   - ✅ `#feestcollectie-gallery`, `.feestcollectie-price`
   - ✅ `#mini-collectie-thumbnails`, `.koekjes-features`

4. **Use semantic HTML elements** alongside classes
   - `<section id="feestcollectie-gallery">`
   - `<nav class="header-nav">`
   - `<aside class="sidebar-info">`

5. **Targetable buttons and forms** - Always add IDs
   - ✅ `<button id="feest-submit">`, `<form id="order-form">`
   - ❌ `<button class="btn">`, `<form>`

#### Examples:

```astro
<!-- Good -->
<section id="feestcollectie-gallery" class="gallery-section">
  <h2 id="feestcollectie-gallery-title">Onze creaties</h2>
  <button id="feestcollectie-gallery-trigger">Bekijk foto's</button>
</section>

<!-- Bad -->
<section class="section">
  <h2>Bekijk foto's</h2>
  <button class="btn-primary">Click</button>
</section>
```

```css
/* Good - targetable */
#feestcollectie-gallery {
  padding: 4rem 0;
}

#feestcollectie-gallery-title {
  font-size: 2rem;
  color: var(--color-primary);
}

#feestcollectie-gallery-trigger {
  background: linear-gradient(135deg, #E8788A, #F2A0AA);
}

/* Bad - not targetable */
/* These generic classes could match anything */
.section {}
.btn-primary {}
```

---

## File Structure

```
src/
├── components/
│   ├── Header.astro
│   ├── Footer.astro
│   ├── GalleryModal.svelte
│   ├── CollectionCard.astro
│   ├── TestimonialCard.astro
│   └── ContactCTA.astro
├── layouts/
│   └── Layout.astro
├── pages/
│   ├── index.astro
│   ├── feestcollectie.astro
│   ├── mini-collectie.astro
│   ├── koekjescollectie.astro
│   └── bestellen.astro
├── styles/
│   ├── tokens.css
│   └── global.css
└── data/
    ├── collections.json
    └── testimonials.json
```

---

## Color Palette (Pink Theme)

```css
--color-primary: #E8788A;
--color-primary-light: #F2A0AA;
--color-primary-dark: #D45A6A;
--color-secondary: #FDEEF0;
--color-accent: #E8A0B0;
--color-background: #FFF9FA;
--color-surface: #FFFFFF;
--color-text: #4A3A3D;
--color-text-muted: #7A6A6D;
--color-border: #F0E0E2;
```

---

## Deployment (Cloudflare Workers)

The site runs as a Cloudflare Worker (`@astrojs/cloudflare`, config in `wrangler.toml`,
entry `src/worker.ts`). Pushing to `master` builds and deploys via Workers Builds:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`

```bash
npm run build     # Build to dist/ (dist/server = Worker, dist/client = static assets)
npm run preview   # Run the built Worker locally (workerd)
npx wrangler deploy
```

- **Variables & secrets** (see `.env.example`) are set in the Cloudflare dashboard
  (Worker → Settings → Variables and Secrets) or with `npx wrangler secret put NAME`.
  Locally they come from `.env`.
- **Background jobs** (review mails, reminders, privacy clean-up) run from the hourly
  cron trigger in `wrangler.toml` → `runScheduledJobs()` in `src/lib/scheduler.ts`.
- The Worker runs in UTC: use the helpers in `src/lib/dates.ts` (`todayIso`,
  `belgianNow`, `belgianHour`, …) for anything that depends on "today" or "now".

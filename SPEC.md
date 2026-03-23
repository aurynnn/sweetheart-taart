# Sweetheart Taart — Website Specification

## 1. Concept & Vision

A charming Belgian bakery website for Nathalie's custom cakes, cookies, and pastries. The site should feel warm, inviting, and artisanal—like stepping into a cozyOostende bakery where every creation is made with love. The personality is gentle, celebratory, and personal, reflecting Nathalie's passion for baking and her willingness to accommodate special dietary needs.

---

## 2. Design Systems (5 Options)

### Design System 1: "Botanical Elegance"
**Mood:** Soft, feminine, garden-inspired elegance
**Typography:**
- Headings: Cormorant Garamond (serif, elegant)
- Body: Nunito Sans (warm, readable)

**Colors:**
- Primary: `#8B5A5A` (dusty rose)
- Secondary: `#E8D5C4` (warm cream)
- Accent: `#6B8E6B` (sage green)
- Background: `#FDF8F5` (warm white)
- Text: `#3D3D3D` (soft charcoal)

**Visual Elements:** Delicate floral illustrations, soft watercolor textures, rounded organic shapes

---

### Design System 2: "Modern Artisan"
**Mood:** Clean, contemporary craft aesthetic
**Typography:**
- Headings: DM Serif Display (bold, editorial)
- Body: Work Sans (geometric, modern)

**Colors:**
- Primary: `#D4A574` (warm caramel)
- Secondary: `#2C2C2C` (rich black)
- Accent: `#E8B4B8` (blush pink)
- Background: `#FAFAFA` (pure white)
- Text: `#1A1A1A` (true black)

**Visual Elements:** Clean geometric shapes, generous whitespace, subtle grain textures, bold typography contrast

---

### Design System 3: "Playful Confectionery"
**Mood:** Whimsical, colorful, joyful celebration
**Typography:**
- Headings: Fredoka (rounded, friendly)
- Body: Quicksand (soft, approachable)

**Colors:**
- Primary: `#FF6B9D` (bright pink)
- Secondary: `#FFD93D` (sunny yellow)
- Accent: `#6BCB77` (mint green)
- Background: `#FFF9F0` (cream)
- Text: `#4A4A4A` (warm gray)

**Visual Elements:** Bouncy rounded corners, polka dots, sprinkle patterns, hand-drawn doodle accents

---

### Design System 4: "Rustic Warmth"
**Mood:** Farmhouse charm, handcrafted authenticity
**Typography:**
- Headings: Playfair Display (classic serif)
- Body: Lora (readable serif)

**Colors:**
- Primary: `#A0522D` (sienna brown)
- Secondary: `#F5DEB3` (wheat)
- Accent: `#CD853F` (peru/golden)
- Background: `#FFFAF5` (off-white linen)
- Text: `#3E3E3E` (warm black)

**Visual Elements:** Linen textures, wheat/straw motifs, vintage badge styling, hand-stamped aesthetics

---

### Design System 5: "Minimal Luxury"
**Mood:** Sophisticated, understated European elegance
**Typography:**
- Headings: Librebaskerville (timeless serif)
- Body: Inter (clean sans)

**Colors:**
- Primary: `#1C1C1C` (near black)
- Secondary: `#C9A96E` (champagne gold)
- Accent: `#8B7355` (taupe)
- Background: `#FFFFFF` (white)
- Text: `#2D2D2D` (dark gray)

**Visual Elements:** Ultra-minimal layouts, gold accent lines, elegant dividers, generous negative space

---

## 3. Theme Systems (3 Options)

### Theme A: "Warm Neutrals"
Light background with warm undertones. Ideal for showcasing colorful cake photography.
- Background: Warm white tones
- Cards: Soft cream with subtle shadows
- Borders: Muted taupe

### Theme B: "Soft Pastels"
Gentle pastel palette for a dreamy, feminine feel.
- Background: Blush pink undertones
- Cards: White with colored borders
- Accents: Multiple soft pastels

### Theme C: "High Contrast"
Bold contrast for dramatic visual impact.
- Background: Deep rich colors
- Cards: Inverted colors
- Accents: Bright highlights

---

## 4. Motion Systems (3 Options)

### Motion A: "Gentle Float"
- Soft, subtle floating animations on elements
- Ease: `cubic-bezier(0.25, 0.46, 0.45, 0.94)`
- Timing: 400-600ms
- Ideal for: Elegant, calm presentation

### Motion B: "Playful Bounce"
- Bouncy, spring-like animations
- Use: `cubic-bezier(0.68, -0.55, 0.265, 1.55)`
- Timing: 300-500ms
- Ideal for: Fun, celebratory feel

### Motion C: "Smooth Slide"
- Horizontal/vertical slide entrances
- Staggered reveals
- Timing: 200-400ms per element
- Ideal for: Modern, editorial flow

---

## 5. Selection

**Selected:** Design System 1 "Botanical Elegance" + Theme A "Warm Neutrals" + Motion A "Gentle Float"

This combination creates a warm, inviting, elegant bakery website that matches the artisanal Belgian bakery vibe while being modern and scalable.

---

## 6. Site Architecture

```
/                     → Home (intro, collections grid, testimonials, contact CTA)
/feestcollectie       → Party Cakes collection page
/mini-collectie       → Mini collection (cupcakes, tartelettes, pavlova)
/koekjescollectie     → Cookies collection
/afternoon-tea        → Afternoon tea info
/bestellen            → Order form (contact form)
/contact              → Contact page with map and info
```

---

## 7. Layout & Structure

### Navigation
- Logo left, menu right
- Sticky header on scroll
- Mobile hamburger menu with full-screen overlay

### Home Page Sections
1. **Hero** — Full-width with tagline "De prachtigste taarten..."
2. **Intro** — "Even voorstellen" with Nathalie's story
3. **Collections Grid** — 4 collection cards with hover effects
4. **Testimonials** — Customer reviews carousel
5. **Contact CTA** — Pickup info and contact button
6. **Footer** — Full contact details, social links, copyright

### Visual Pacing
- Hero: Full viewport height, bold statement
- Sections alternate between image-heavy and text-focused
- Generous padding between sections
- Breathing room around content

---

## 8. Features & Interactions

### Navigation
- Smooth scroll for anchor links
- Active state indicator for current page
- Mobile menu slides in from right with backdrop blur

### Collection Cards
- Default: Soft shadow, cream background
- Hover: Slight lift (translateY -4px), enhanced shadow, accent border glow
- Click: Scale down slightly (0.98) then navigate

### Testimonials
- Auto-rotating carousel (5s intervals)
- Manual navigation dots
- Pause on hover
- Fade transition between testimonials

### Order Form
- Multi-step form with progress indicator
- Date picker for preferred pickup date
- Form validation with inline error messages
- Success state with confirmation message

### Page Transitions
- Fade in on page load
- Staggered reveal for content sections

### Scroll Animations
- Fade up + slide on scroll into view
- Intersection Observer based triggers

---

## 9. Component Inventory

### Header
- Logo (SVG or image)
- Desktop nav links
- Mobile menu toggle
- States: Default, scrolled (with background blur), mobile menu open

### HeroSection
- Full-width container
- Large heading
- Subtitle
- CTA button

### CollectionCard
- Image thumbnail
- Title
- Description
- Link to collection
- States: Default, hover, focus

### TestimonialCard
- Quote text
- Author name
- Optional avatar
- Rating stars (optional)

### Button
- Primary (filled), Secondary (outlined), Ghost (text only)
- Sizes: Small, Medium, Large
- States: Default, hover, active, disabled, loading

### ContactInfo
- Address block
- Phone with tel: link
- Email with mailto: link
- Social media icons
- Opening hours

### Footer
- Multi-column layout
- Contact info
- Quick links
- Social links
- Copyright

---

## 10. Technical Approach

### Stack
- **Framework:** Astro 4.x
- **UI Framework:** Svelte 5
- **Styling:** Tailwind CSS 4 + CSS design tokens
- **Fonts:** Google Fonts (Cormorant Garamond, Nunito Sans)
- **Icons:** Lucide (via lucide-svelte)

### CSS Architecture
```
/src/styles/
  tokens.css      → Design tokens (colors, typography, spacing)
  global.css      → Global styles and Tailwind imports
```

### Design Tokens (CSS Variables)
```css
:root {
  /* Colors */
  --color-primary: #8B5A5A;
  --color-secondary: #E8D5C4;
  --color-accent: #6B8E6B;
  --color-background: #FDF8F5;
  --color-surface: #FFFFFF;
  --color-text: #3D3D3D;
  --color-text-muted: #6B6B6B;
  
  /* Typography */
  --font-heading: 'Cormorant Garamond', serif;
  --font-body: 'Nunito Sans', sans-serif;
  
  /* Spacing */
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;
  --space-2xl: 3rem;
  --space-3xl: 4rem;
  
  /* Radii */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 1rem;
  --radius-xl: 1.5rem;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.07);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.1);
  
  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-normal: 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
  --transition-slow: 500ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
}
```

### Content Structure
- Static pages with Astro content collections
- JSON data for collections and testimonials
- No CMS required (static site)

### Performance
- Static site generation (SSG)
- Image optimization with Astro's built-in image processing
- Font preloading
- Minimal JavaScript (only for interactive Svelte components)
- CSS animations over JS where possible

# E. M. Andor Builders and Associates Dev't. Corp. — Corporate Website Design

Date: 2026-08-16
Status: Approved

## 1. Purpose

A modern, professional, responsive single-page corporate website for
E. M. Andor Builders and Associates Dev't. Corp., a construction and
development company in Batangas City, Philippines. Communicates trust,
quality, stability, professionalism, construction expertise, and modern
development.

## 2. Tech Stack

- React 19 + Vite (SPA, single-page scroll navigation)
- Tailwind CSS v4 (design tokens via CSS `@theme`)
- Self-hosted fonts: `@fontsource/archivo` (display), `@fontsource/inter` (body)
- Scroll reveal via a lightweight IntersectionObserver `Reveal` component
  (no animation library dependency)

## 3. Brand System

### Colors
| Token | Hex |
| --- | --- |
| Primary dark green | `#006B3C` |
| Secondary green | `#009B4D` |
| Deep green (hovers/dark sections) | `#00452A` |
| Accent gold | `#F6D21A` |
| Gold hover (darker) | `#D9B800` |
| White | `#FFFFFF` |
| Light background | `#F5F7F5` |
| Ink (body text) | `#12352A` |

Gold is reserved for CTAs, icons, highlights, and key accents only.

### Typography
- Display/headings: Archivo (bold, geometric)
- Body: Inter
- Scale: responsive clamp-based fluid scale

### Geometric language
- Subtle angular roof/girder SVG line patterns
- Diagonal section dividers
- Hard-edge corner accents

### Motion
- `Reveal`: fade + slide-up on scroll (IntersectionObserver), respects
  `prefers-reduced-motion`
- Navbar: shrink + shadow on scroll
- Smooth anchor scrolling with `scroll-margin-top`

## 4. Architecture

```
src/
  main.jsx, App.jsx, index.css
  assets/logo.png          (user-provided; SVG monogram fallback)
  data/site.js             (all editable content)
  components/
    shared/Logo.jsx Button.jsx SectionHeading.jsx Reveal.jsx
    layout/Navbar.jsx Footer.jsx
    sections/Hero.jsx Stats.jsx About.jsx Services.jsx
             Projects.jsx WhyChooseUs.jsx CTA.jsx Contact.jsx
public/
  images/ (hero, about, 6 project photos, cta bg)
  favicon.svg, og-image
```

### Sections (single scrolling page)
1. Navbar (sticky; hamburger on mobile)
2. Hero
3. Stats
4. About
5. Services
6. Projects (filterable)
7. Why Choose Us
8. CTA
9. Contact (+ form, + map)
10. Footer

## 5. Content

### Contact
- Phone: (043) 980 7189
- Email: emandorbuilders27@gmail.com
- Address: 250-G, P Burgos St., Poblacion, Brgy 12, Batangas City

### Stats (editable placeholders)
- 100+ Projects Completed
- 15+ Years of Experience
- 50+ Satisfied Clients
- Batangas City Location

### Services
Residential Construction, Commercial Construction, Renovation & Improvement,
Design & Build.

### Projects
Six portfolio cards across categories Residential, Commercial, Renovation,
Development, each with name, category, location, short description, photo.
Category filter tabs (All + the four categories).

## 6. Key Behaviors

- Contact form: client-side validation (name, email, phone, message);
  submits via `mailto:` with pre-filled body and shows a success state.
- Google Maps embed iframe (no API key) for Batangas City with styled fallback.
- Images: royalty-free construction/architecture photos in `public/images/`;
  descriptive alt text; easy swap point for real project photos.
- SEO: semantic HTML, single H1, meta/OpenGraph/Twitter tags, lang attribute.
- Accessibility: skip link, focus-visible rings, labeled form fields,
  accessible contrast, keyboard-navigable mobile menu.

## 7. Out of Scope

- Backend/contact form service (mailto only)
- Multi-page routing
- Real company statistics (placeholders kept editable)

## 8. Verification

- `npm run build` and `npm run preview`
- Responsive review at desktop / tablet / mobile breakpoints
- A11y pass: heading order, labels, contrast, keyboard navigation

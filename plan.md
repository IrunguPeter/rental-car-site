# Aurora Rental Editorial Redesign

## Design movement

A Nairobi travel-editorial interface: warm paper, oversized serif headlines, cobalt utility accents, immersive vehicle photography, and quiet but confident motion. The site borrows the reference sites' use of strong art direction and conversion-first structure without copying their branding or layouts.

## Core principles

1. Lead with the trip and the vehicle, not generic rental-company language.
2. Use editorial whitespace and large type to make the brand feel premium.
3. Keep booking actions persistent and obvious, especially WhatsApp on mobile.
4. Animate transitions with restrained, purposeful movement that respects reduced-motion preferences.

## Color philosophy

Warm ivory makes the photography and dark ink feel tactile. Cobalt signals trust and action. Aurora orange remains the ownable booking accent, used sparingly for prices, active states and conversion CTAs.

## Layout paradigm

A sequence of editorial chapters rather than a uniform card grid: immersive hero, trust strip, selected fleet, trip pathways, rental terms, reviews and FAQ. Fleet cards use a horizontal rhythm and strong image-first hierarchy.

## Signature elements

- A thin cobalt trust rail with three business outcomes.
- Oversized chapter numbering and eyebrow labels.
- Floating WhatsApp action that remains visible without competing with the primary content.

## Interaction and animation

- Hero content enters with a staggered fade/translate sequence.
- Fleet image panels reveal with a gentle scale and parallax-like transform on hover.
- Section chapters reveal on scroll using IntersectionObserver.
- FAQ uses native details for accessible disclosure.
- Buttons lift subtly on hover; no distracting infinite loops.
- `prefers-reduced-motion` disables nonessential transitions.

## Typography

Use a high-contrast serif for the editorial headlines and Space Grotesk/Inter for utility text. Headlines are large and compact; labels are small, uppercase and tracked. Prices and CTAs use the display face for visual authority.

## Brand essence

Aurora makes Nairobi car hire feel clear, calm and considered for travellers who want the right car without rental-counter friction.

Personality: assured, warm, practical.

## Brand voice

Headlines are direct and visual: “Take the scenic route.” CTAs are specific: “Check availability on WhatsApp.” Avoid empty superlatives and unsupported scale claims.

## Wordmark and mark

Keep the existing Aurora mark, but increase the spacing between the mark and wordmark and use the orange accent only on the location descriptor.

## Scope of this redesign pass

- Generate and integrate a hero image plus four fleet images.
- Rework the homepage to an editorial, image-led hierarchy.
- Add motion classes and scroll choreography.
- Preserve booking, lead capture, FAQ, admin and API behavior.
- Verify desktop and mobile layouts and the WhatsApp/admin paths.

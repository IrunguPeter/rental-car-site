# Aurora Redesign TODO

- [x] Replace placeholder car glyphs with generated vehicle photography and editorial treatments where a dedicated asset was not needed.
- [x] Rework hero into an editorial image-led composition with a cleaned, compressed Nairobi image.
- [x] Add cobalt trust rail and numbered content chapters.
- [x] Add fleet image hover motion and selected-car states.
- [x] Add scroll reveal choreography with reduced-motion support.
- [x] Verify WhatsApp links and mobile booking actions with a headless responsive pass.
- [x] Verify admin route and back-to-site navigation from the existing branch changes.
- [x] Run JavaScript, CSS, asset, link-integrity and responsive browser checks.
- [x] Commit and push the redesign branch.

## Validation note

The static preview confirms no horizontal overflow at 390px or 1440px, the fleet images load at their scroll position, the cleaned hero has no accidental generated lettering, and the optimized WebP assets reduce the new image payload to under 1 MB. API routes still require the Vercel runtime and are expected to return 404s on the static preview server.

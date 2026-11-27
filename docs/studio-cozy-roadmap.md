# Mira Studio · Cozy Functional

First increment of the Studio redesign. The existing compiler, editor, worker,
and lab routes remain authoritative. No framework or runtime dependency is added.
Prisma is the initial visual direction: soft surfaces, gentle depth, readable
controls, semantic color, and mobile-first layouts that expand on larger screens.

## Information architecture

The workbench is the primary entry point. Labs are discoverable below it.
The guide exposes language features, runnable examples, generated Haxe APIs,
and the additional capabilities catalog. Search includes category, feature,
feature introduction version and canonical call selectors extracted at PWA build time from the real compiler AST. Sections are indexed separately, and record keys are not calls. Library-prefix definitions are excluded; parse failures are marked explicitly. The index is not a whole-program call graph. Introduction version is not a syntax compatibility guarantee. The canonical example fixtures are still tested by CI.

## Remaining acceptance work

- Extend compiler-derived call metadata to resolved higher-order callees and add explicit syntax validity ranges.
- Document all standard library/host contracts with typed signatures, target
  availability, error cases and runnable fixtures. Additional capabilities link
  to source docs until those entries are migrated to the structured guide.
- The shared highlighter now covers explicitly tagged source editors, lab code blocks and fenced notebook snippets. Audit mixed-language reports, untagged snippets and editor alignment across browsers.
- Shared cozy-labs.css now coordinates legacy lab surfaces; the experimental Theme Lab remains isolated. Review per-lab layouts, keyboard, screen-reader, contrast and offline navigation.
- Review CI screenshots of all routes, add WebKit and Firefox, and approve
  intentional visual baselines before automatic pixel regression testing.
- Preserve performance on low-resource phones and TVs; measure bundle size,
  first interaction, and search/render time against the existing Studio.

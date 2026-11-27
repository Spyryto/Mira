# Mira Studio · Cozy Functional

First increment of the Studio redesign. The existing compiler, editor, worker,
and lab routes remain authoritative. No framework or runtime dependency is added.
Prisma is the initial visual direction: soft surfaces, gentle depth, readable
controls, semantic color, and mobile-first layouts that expand on larger screens.

## Information architecture

The workbench is the primary entry point. Labs are discoverable below it.
The guide exposes language features, runnable examples, generated Haxe APIs,
and the additional capabilities catalog. Search includes category, feature,
feature introduction version and explicit selector mentions. Introduction version
is not a syntax compatibility guarantee. Selector mentions are lexical,
not resolved call graphs; record keys can also appear. Natural selectors can be
found via full-text search. The canonical example fixtures are still tested by CI.

## Remaining acceptance work

- Use compiler-derived call metadata and explicit syntax validity ranges.
- Document all standard library/host contracts with typed signatures, target
  availability, error cases and runnable fixtures. Additional capabilities link
  to source docs until those entries are migrated to the structured guide.
- Extend shared highlighting to every editable and static snippet in every lab
  and the generated notebook, preserving language labels and source text.
- Migrate lab-specific layouts and preview chrome to the same design tokens;
  add keyboard, screen-reader, contrast and offline navigation checks.
- Review CI screenshots of all routes, add WebKit and Firefox, and approve
  intentional visual baselines before automatic pixel regression testing.
- Preserve performance on low-resource phones and TVs; measure bundle size,
  first interaction, and search/render time against the existing Studio.

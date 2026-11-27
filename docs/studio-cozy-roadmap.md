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

## First visual review

The Ubuntu 24.04 Chromium job passed and produced 39 screenshots at five viewport sizes (run 46062633163). Review found inconsistent lab chrome, low-contrast projection tokens, collapsed independent source editors, too much mobile header space, and an example screenshot taken before search state settled. The follow-up scopes editor CSS to its workbench, coordinates the lab surfaces, groups type examples, compacts the mobile header, hides the hero in guide mode, and waits for the actual route and filter state in browser tests. Re-review the new screenshots before merging; no pixel baseline has yet been approved.

Second review: the revised 39 screenshots (run 46063157066) confirmed compact guide, expanded independent editors, consistent projection contrast and grouped type experiments. The desktop GUI benchmark revealed a margin/background reset regression; search also placed incidental textual matches before direct GUI examples. Follow-up restores benchmark centering and prioritizes category/feature matches ahead of incidental source matches. Browser tests check centering, category relevance and the AST fold call facet.

## Native API reference, first increment

The PWA build derives Services/Data interfaces from the compiler's public surface report, not from handwritten signatures. GUI, Grammar and checked GUI styles are source-level legacy libraries and do not claim a public typed interface. Provider implementations and the historical ConstantData style example are excluded. The native API page links to the labs and matching catalog selectors. Per-symbol editorial explanations, verified examples and compatibility/target matrices remain to be completed. No runtime compiler or framework dependency is introduced for searching the catalog.

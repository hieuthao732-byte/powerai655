# Source consolidation

The RC8.9–RC9.7 post-build mutation chain has been materialized into the checked-in web source.

## Stable source of truth
- `app.js`
- `index.html`
- `style.css`
- `auth.js`

## Build
`npm run build` now runs only `node build.mjs`.
`build.mjs` performs a deterministic copy of static source files into `dist/`; it no longer patches application code.

## Removed post-build files
All `rc*.mjs` migration/patch scripts are removed from the stabilization branch after their behavior is materialized.

## Compatibility constraints preserved
- existing localStorage key names
- existing Supabase/auth integration
- lock/log object formats
- A/B/C/L algorithms and generated portfolios
- manual verification guard
- replay semantics
- Jackpot 1/2 + prize board logic
- green main-hit and gold special-ball rendering
- Number Intelligence anti-leakage rule
- Performance Center official-feed-only aggregation

This branch must still pass browser smoke tests before merging to `main`.

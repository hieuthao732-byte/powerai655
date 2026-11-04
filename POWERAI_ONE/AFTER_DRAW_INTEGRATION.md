# PowerAI ONE — Post-draw evaluation integration

## Contract

`after-draw-evaluation.js` evaluates the exact ONE portfolio that was locked for a target draw. It requires:
- matching `portfolio.targetDrawId` and official draw ID;
- `source: "official"` and `verified: true`;
- all six main numbers plus the Power 6/55 special number;
- a valid generation/lock timestamp strictly earlier than the draw-result timestamp;
- the locked ticket list and the prior chronological evaluation records.

Example (CommonJS/service wiring):

```js
const Domain = require("./domain.js");
const Governor = require("./adaptive-governor.js");
const AfterDraw = require("./after-draw-evaluation.js").create(Domain, Governor);

const report = AfterDraw.evaluate({
  portfolio: lockedOnePortfolio,
  draw: verifiedOfficialDraw,
  priorRecords: previousOfficialEvaluationRecords,
  threshold: 10
});
```

## Output and safety

The report contains each ticket's six-main-number hits, separate special-number hit flags, the portfolio's maximum main hits, and the governor's current streak/trigger event.

The governor triggers a shadow review after the configured consecutive miss threshold (default 10). The trigger is not a model update, ticket regeneration, or promotion.

This module is pure and returns `statePersisted: false`. The host application still needs a trusted official-result ingestion path and a persistence adapter to retain evaluation records across sessions. This change intentionally does not modify Supabase schema, RLS, existing user data, production deployment, or `main`.

## Evidence path

After the governor trigger, `adaptive-shadow-runner.js` replays the challenger from the following draw onward. The paired outcomes can be passed to `challenger-evidence-gate.js`. The gate requires 200 consecutive paired official/verified prospective draws and only recommends human review; it cannot auto-promote.

## Single runtime facade

`one-runtime.js` composes the unified portfolio pipeline, post-draw evaluator, shadow replay, and evidence gate behind one API. A/B/C/L/D remain providers; the pipeline still owns exactly one final selector.

The host can initialize the facade with the canonical modules, register providers, call `buildPortfolio()`, then call `evaluateAfterDraw()` after a verified official result is ingested. `runShadowReplay()` and `evaluateChallengerEvidence()` use the same runtime boundary.

This is the integration surface for the app layer. It does not yet enable automatic cloud persistence or change the current RC9 UI.

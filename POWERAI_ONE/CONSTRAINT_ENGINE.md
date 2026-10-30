# PowerAI ONE — Constraint Engine

## Ownership

ONE remains the only final selector. Candidate providers contribute ticket candidates and source-local scores; they do not publish a competing final portfolio.

## Hard constraints

The unified selector accepts an explicit `constraints` object:

- `requireCoverage: true`: all 55 main numbers must appear in the selected portfolio.
- `minExposure: 2`: every number must appear at least twice.
- `maxExposure: 3`: no number may appear more than three times.
- `maxRepeatedPairs: 0`: no pair may occur in more than one ticket.

The existing `maxOverlap` option separately limits the largest intersection between any two tickets. For the A7 geometry profile use `maxOverlap: 1`.

Example:

```js
const result = await pipeline.build({
  targetDrawId,
  draws,
  providerIds: ["A7"],
  count: 20,
  maxOverlap: 1,
  constraints: {
    requireCoverage: true,
    minExposure: 2,
    maxExposure: 3,
    maxRepeatedPairs: 0
  }
});
```

## Enforcement

The selector rejects a candidate before selection when it violates the configured per-ticket overlap, exposure, or repeated-pair constraints. It audits the completed portfolio and throws a named hard-constraint error if coverage or exposure invariants are not met. A failure is explicit; ONE does not silently relax a hard constraint.

## Important limitation

This is a constrained bounded beam search selector, not a complete combinatorial solver. It can report infeasible when a valid portfolio exists but the bounded beam search path cannot construct it. It does not guarantee that arbitrary mixed A/B/C/L/D candidate pools can reproduce A7/C's complete 20-ticket geometry. Until a portfolio-level bundle/constraint solver is implemented and tested, A7/C geometry should be evaluated with their complete candidate sets and explicit hard constraints; mixed-source selection must not be described as preserving those invariants unless its final audit proves it.

## Current status

- Implemented: hard max-overlap, max-exposure, repeated-pair filtering, and final coverage/min-exposure/max-exposure/pair audits.
- Implemented: pipeline forwards the caller's constraint profile to the single selector.
- Pending: portfolio-level bundle support, feasibility-aware search/backtracking, mixed-provider stress tests, and end-to-end CI confirmation.
- No provider is promoted by this change. C/L/D remain shadow.

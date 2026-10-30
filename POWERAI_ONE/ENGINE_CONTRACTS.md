# PowerAI ONE — Domain & Engine Contracts

Status: proposed compatibility contract. No existing algorithm is changed by this document.

## 1. Design rule
The ONE shell must not make algorithms depend on UI. Engines receive normalized history and a target draw ID, then return a canonical portfolio with provenance. Wrap existing engines first; do not rewrite them during extraction.

## 2. Canonical draw

    type Draw = {
      id: number;
      date?: string;
      main: number[];              // exactly six unique integers, 1..55
      special: number | null;      // separate from main
      source: "official" | "imported" | "manual";
      sourceRef?: string;
      validated: boolean;
    };

Validation:
- Exactly six distinct integer main numbers in [1,55], canonical ascending order.
- Special is nullable and separately validated against official game rules.
- Malformed/incomplete rows are excluded from inferential analyses and reported in import diagnostics.
- For target T, every historical draw used must have ID strictly less than T.
- Preserve original source fields for audit; do not silently coerce malformed rows.

## 3. Canonical ticket and portfolio

    type Ticket = { main: [number, number, number, number, number, number] };

    type Portfolio = {
      engineId: string;
      engineVersion: string;
      targetDrawId: number;
      cutoffDrawId: number;
      tickets: Ticket[];
      generatedAt: string;
      seed?: number;
      modelHash?: string;
      portfolioHash?: string;
      audit?: PortfolioAudit;
      provenance: {
        mode: "prospective" | "retrospective" | "shadow" | "manual";
        sourceDrawIds: number[];
        configFingerprint?: string;
      };
    };

Current A/B/C/L/D flows generally use 20 tickets; keep that as a legacy adapter invariant, not an undocumented universal limit. A ticket has six main numbers; special is never a ticket member.

## 4. Audit contract

    type PortfolioAudit = {
      ticketCount: number;
      coverage: number;
      minExposure: number;
      maxExposure: number;
      repeatedPairs: number;
      maxOverlap: number;
      valid: boolean;
      errors: string[];
    };

Legacy audit field names may differ. Adapters map fields without changing calculations and retain original audit payload for comparison.

## 5. Engine adapter

    interface EngineAdapter {
      readonly id: string;
      readonly version: string;
      readonly status: "enabled" | "shadow" | "retired";
      generate(input: {
        draws: Draw[];
        targetDrawId: number;
        config?: Record<string, unknown>;
        seed?: number;
      }): Promise<Portfolio> | Portfolio;
      audit?(portfolio: Portfolio): PortfolioAudit;
    }

- A/B/C/L are compatibility adapters; golden fixtures prove exact output parity before replacing legacy call paths.
- D is an adaptive research engine with separate official prospective, shadow challenger and retrospective validation lanes.
- Research/shadow outputs never appear as official champion performance.
- Engine failure is visible; never silently substitute another engine.
- Scores are internal rankings, not winning probabilities.

## 6. Immutable lock

    type PortfolioLock = {
      targetDrawId: number;
      engineId: string;
      engineVersion: string;
      lockedAt: string;
      portfolio: Portfolio;
      snapshotHash: string;
      integrity: "verified" | "invalid" | "unverified";
    };

A lock is immutable. Regeneration is blocked after lock or official result, matching current behavior. Read old A/B/C/L/D payloads through adapters; do not rewrite historical snapshots merely to fit the new shape.

## 7. Result and scoring

    type DrawResult = {
      drawId: number;
      main: [number, number, number, number, number, number];
      special: number | null;
      source: "official" | "manual" | "replay";
      recordedAt: string;
    };

    type TicketScore = {
      mainHits: number;
      specialHit: boolean;
      prizeTier?: string | null;
    };

Main matches and special matches are independent. Manual/replay results may support local inspection but cannot enter official prospective evaluation. Delegate prize mapping to existing authoritative rules.

## 8. Evaluation lanes

| Lane | Eligible data | Permitted effect |
|---|---|---|
| Official prospective | Pre-draw lock + subsequent official feed | Official performance ledger |
| Retrospective walk-forward | Chronological replay with strict cutoff | Research report only |
| Shadow challenger | Prospective shadow lock + official feed outcome | Challenger comparison only |
| Manual/replay | User-entered/replayed result | Local preview only |

No lane writes into another lane. Promotion requires independent evidence and explicit gates.

## 9. Track D boundaries
- adaptive-d.js: deterministic D1–D4 model and portfolio core.
- adaptive-d-ui.js: lock integrity and official prospective integration.
- adaptive-d-cycle.js: feed-only drift/challenger lifecycle.
- adaptive-d-validation.js: retrospective-only walk-forward lab.
- Keep powerai_rc6_d_* storage separate during compatibility phase.

## 10. Compatibility checklist
- [ ] Draw parser preserves six main numbers and special separately.
- [ ] Historical cutoff is strict and deterministic.
- [ ] A/B/C/L golden portfolios match legacy output.
- [ ] D lock rebuild/hash integrity passes.
- [ ] Ticket and portfolio hashes remain stable.
- [ ] Official/manual/replay/shadow lanes remain isolated.
- [ ] Guest read-only and per-user ownership remain intact.

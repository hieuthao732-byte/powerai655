# PowerAI 6/55 — RC6.6 Learning Portfolio

Learning now outputs its own 20-ticket experimental portfolio: L01–L20.

## How L is built
- Uses the same historical feature components as frozen B:
  Heat, Pair, Odd/Even, Small/Big, Sum.
- Base weights start from B:
  40 / 30 / 10 / 10 / 10.
- Learning modifies these weights only slightly.
- Maximum learning influence grows gradually with the number of learning draws:
  alpha = min(25%, n / 20 × 25%).
- With very little data, L stays very close to B to reduce overfitting.
- Candidate generation is separate and deterministic for the target draw.
- 50,000 valid candidates are scored with learned weights.
- The same portfolio diversity selector chooses 20 tickets.
- L01–L20 are ranked by Learning score.

## Modes
- <5 draws: PREVIEW
- 5–9: HỌC SƠ BỘ
- 10–19: CHALLENGER
- >=20: VALIDATION CANDIDATE

## Prospective lock
L has its own independent lock.
A/B/C can still be locked normally even if L is not ready.
If L is locked before the result, the next result scoring records L alongside A/B/C.

## Important
L is experimental.
It does not replace A, B, or C automatically.
Its score is not a calibrated lottery probability.

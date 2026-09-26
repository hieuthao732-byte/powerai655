# RC6.2.1 Interaction QA

Audited interactive surfaces:
- Refresh data
- Lock all 3 tracks
- Manual result input/button
- Enter-to-submit manual result
- Sequential next-draw navigation
- A/B/C main tabs
- A/B/C hero track pills
- Copy A/B/C portfolio
- Rebuild B
- Rebuild C
- RC5 archive details/summary
- Recent prospective draw cards
- Export log JSON

Fixes:
1. Controls are disabled until prerequisites exist, instead of appearing clickable and doing nothing.
2. Copy has Clipboard API + legacy fallback and toast feedback.
3. Manual result supports Enter.
4. Manual result cannot overwrite a result already present in the official feed.
5. Next-draw button now advances from the currently viewed target and disables at latest+1.
6. Hero A/B/C pills now switch to their corresponding tabs.
7. Recent draw cards now open the corresponding locked/logged target.
8. Export is disabled when there are no logs and provides feedback.
9. Toast feedback was added for lock/copy/manual/export/no-op navigation.

No algorithm changes were made.

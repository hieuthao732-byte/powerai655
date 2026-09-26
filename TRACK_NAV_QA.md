# RC6.2.2 Track Navigation Fix

Issue:
The hero A/B/C pills changed the active tab while the user remained at the top of the page.
Because the real tab content is lower down, it looked like the click did nothing.

Fix:
- One shared activateTrack() function now controls all A/B/C navigation.
- Clicking a hero A/B/C pill:
  1. activates the matching tab,
  2. updates hero selected state,
  3. scrolls to the actual tab content,
  4. flashes the opened panel,
  5. shows a toast.
- Clicking the sticky tabs uses the same activation function.
- Last selected tab is still restored from localStorage.
- scroll-margin prevents the sticky header/tabs from hiding the opened panel.

No A/B/C algorithm changes.

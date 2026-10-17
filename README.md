# LifeOS 2.1

Free offline-capable personal tracker for schedule, habits, food, workouts, and expenses.

## Run locally
From this folder, run `python3 -m http.server 8000` and open `http://localhost:8000`.

## Publish
Publish the repository root with GitHub Pages (`main` branch, `/ (root)`).

## Storage
Entries are stored in this browser's localStorage. Export JSON backups regularly. The app does not sync devices automatically.


## Automatic food nutrition estimates (v2.2)
The Food & Calories page estimates calories and protein offline for common foods when you enter a food name and quantity in grams. Estimates use approximate values per 100 g and are not a complete nutrition database. Unknown foods are not saved until a supported food is selected. For mixed meals, log ingredients separately.


## LifeOS 2.4 workspace icon update
- Replaced text-symbol navigation icons with consistent inline SVG line icons.
- Added matching icons to dashboard metric cards and the theme toggle.
- Improved icon backgrounds, active navigation states, spacing, and mobile sizing.
- Updated the service-worker cache version so the refreshed interface can load offline.
- Retains LifeOS 2.2 automatic food nutrition estimates and existing local-storage data keys.


## Body weight tracker (2.4)
- Log body weight in kilograms with a date and optional note.
- See latest weight, change from the previous entry, and a trend chart.
- Weight entries are stored in the same local LifeOS backup and can be exported/imported.
- Existing records are retained; weightLogs is added as a new list.


## LifeOS 2.5 PRO — advanced UI refresh
- Added a refined glass-style workspace with subtle grid texture, ambient gradients, and cleaner contrast.
- Improved navigation, cards, metric hierarchy, forms, charts, buttons, and responsive mobile navigation.
- Respects dark/light theme and reduced-motion preferences.
- Updated service worker cache to v6 for offline refresh.
- Preserves the LifeOS data storage keys and existing tracking features.

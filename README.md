# MyDailyApp

Write the day **in the app**: tabs for Log, Med, Food, Movement; **+** opens time + text, then **Save to timeline** or **Cancel**. Food is only timed **ate/drank** lines (no macros/symptoms UI here). Flow adds Quick Snapshot, TaskScore, emoji, and any extra Food lines.

## Export

- Notes: plain `- 9:30 AM: text` (you add emoji in Flow).
- Food: meals/snacks from Food events; macros/symptoms/notes lines export empty or `—` for you to fill in Flow if needed.

## JSON

`DayRecord`: `date`, `events[]` (`kind`, `at`, `fuzzy`, `text`, `symbol` empty).

## Scripts

```bash
npm install
npm run dev          # HTTP — use http://localhost:5170/ (incl. Cursor Simple Browser)
npm run dev:https   # HTTPS — phone on Wi‑Fi; open https://192.168… from the terminal
npm run build
```

Use another port (when 5170 is busy or you prefer a fixed one):

```bash
VITE_DEV_PORT=5180 npm run dev
# or
PORT=5180 npm run dev
```

`VITE_DEV_PORT` wins if both are set. The same port applies to `npm run preview`.

By default the dev server **does not fall back** to the next port if the chosen port is busy (so the URL stays predictable). If something else is using **5170**, either stop that process or pick a port explicitly, e.g. `VITE_DEV_PORT=5174 npm run dev`. To restore Vite’s old behavior (try the next port, …), run with `VITE_ALLOW_PORT_FALLBACK=1`.

### Troubleshooting: “neither URL works”

- **Cursor Simple Browser:** default **`npm run dev`** serves **HTTP**. Open **`http://localhost:5170/`** (same scheme as the terminal “Local” line). Do not use **`https://`** here unless you ran **`npm run dev:https`**.
- **Phone on Wi‑Fi:** run **`npm run dev:https`**, then open **`https://192.168…`** from the terminal (not `http://`). Accept the certificate warning once.
- If you previously saw a **different port** because 5170 was taken, your bookmark may be wrong — use the exact port Vite prints, or free 5170, or set `VITE_DEV_PORT` explicitly.

## Preview inside Cursor (Simple Browser)

**Command Palette** (`Cmd+Shift+P` / `Ctrl+Shift+P`) → **Simple Browser: Show** → **`http://localhost:5170/`** while **`npm run dev`** is running (HTTP).

`localhost` still allows `localStorage` in the embedded browser. For **phone on Wi‑Fi**, use **`npm run dev:https`** and the **`https://192.168…`** URL (see below).

## Phone on the same Wi‑Fi

Run **`npm run dev:https`** so the dev server uses **HTTPS** (self-signed). On your phone, open the **`https://192.168…`** URL Vite prints under **Network** — not `http://`. Chrome on Android does not persist `localStorage` on plain `http://` LAN origins, so the app would look like it “doesn’t save.” Accept the browser’s certificate warning once (Advanced → proceed).

Dev HTTPS uses a **self-signed cert that lists your LAN IPv4 in the cert as IP addresses** (not only `localhost`), so Chrome accepts `https://192.168.…` after you tap through the warning. If your Mac’s Wi‑Fi IP changes, run **`npm run dev:https`** again (certs are cached under `node_modules/.vite/dev-https/` by IP set). If anything is stuck, delete `node_modules/.vite` and restart.

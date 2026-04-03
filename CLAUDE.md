# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

**Amp Connect** is a browser-based signal path design tool for Origin Acoustics ProA amplifiers and speakers. Users drag devices from a sidebar onto a canvas, wire ports together, and export a Bill of Materials.

The active codebase is a React + Vite app deployed to Vercel. A legacy standalone HTML version lives in `legacy/` and `AMP BIBLE/` for reference only — do not edit those.

## Commands

```bash
npm run dev      # Start dev server (Vite, hot reload)
npm run build    # Production build to dist/
npm run preview  # Preview the production build locally
npm run lint     # ESLint (max-warnings 0 — lint must be clean)
```

## Architecture

### Source layout

```
src/
  App.jsx              # Root component — layout, BOM modal, zoom controls, drag-drop orchestration
  main.jsx             # React DOM entry point
  index.css            # Tailwind base + CSS custom properties (design tokens)
  data/catalog.js      # ALL_MODELS catalog + buildRows() layout helper
  utils/signal.js      # WIRE_COLORS, TYPE_COMPAT, checkCompat()
  hooks/useStore.js    # Zustand store — all runtime state and actions
  components/
    DeviceCard.jsx     # Individual device on the canvas (ports, drag-to-move, delete)
    Wire.jsx           # SVG bezier wire between two ports (click to delete)
```

### State (Zustand — `useStore`)

All runtime state lives in a single Zustand store:

- `devices` — plain object map of `{ id, model, x, y, n }`. `model` is a key into `ALL_MODELS`.
- `wires` — plain object map of `{ id, from, to, type, connId }`. `from`/`to` are port keys like `"dev3::ch2"`.
- `canvas` — `{ scale, ox, oy }` — CSS transform applied to the workspace `div`.
- `ui` — ephemeral interaction state (active port during wiring, panning, toasts, context menu).

Key actions: `addDevice`, `updateDevicePos`, `deleteDevice`, `addWire`, `deleteWire`, `getPortInfo`, `setCanvasScale`, `setCanvasOffset`, `clearCanvas`, `resetView`.

### Port keys

Ports are addressed as `"<deviceId>::<portId>"` (e.g. `"dev1::ain1"`). `getPortInfo(portKey)` resolves the port to canvas coordinates `{ x, y, side, type, devId }` by re-computing layout from `buildRows()` on demand — there is no stored port position state.

### Wiring flow

1. `mousedown` on a port dot → `setUi({ activePort: portKey })` + dashed animated wire follows cursor (`ActiveWire` in `App.jsx`)
2. `mouseup` on a compatible port → `addWire(from, to)` → `checkCompat()` validates direction and type → wire is stored or a toast error is shown
3. Click a rendered `Wire` → `deleteWire(id)`

### Canvas transform

The canvas `div` uses `transform: translate(ox, oy) scale(scale)` with `origin-top-left`. Device positions are stored in canvas-space, so `getPortInfo` returns canvas-space coordinates directly. Mouse events in `App.jsx` convert screen coords to canvas-space via `(clientX - rect.left - canvas.ox) / canvas.scale`.

## Data: catalog

`src/data/catalog.js` exports `ALL_MODELS` (keyed by model ID) and `buildRows(ports)`.

**Model shape:**
```js
'ModelId': {
  name: 'Display Name',
  subtitle: 'Power · Channels · Form Factor',
  badge: 'BADGE',
  isAmp: true,           // false for passive speakers/subs
  cat: 'Category Name',  // sidebar grouping: 'Pro Series', 'Composer Series', 'Subwoofer', etc.
  dealer: 1234,
  msrp: 2345,
  ports: [ ... ]
}
```

**Port shape:** `{ id, label, side: 'left'|'right', type: 'analog'|'speaker'|'digital'|'network'|'power'|'gpio'|'utility' }`

**Helpers in catalog.js:** `commonInputPorts()` (standard amp inputs), `proAOutPorts(loZCount, hiZCount)` (amp outputs), `mkSpkr()`, `mkSub()` (speaker/sub factories).

`buildRows(ports)` pairs left/right ports into `{ left, right }` rows for card layout — used in `DeviceCard` and `getPortInfo`.

## Signal compatibility

`checkCompat(p1, p2)` in `src/utils/signal.js` enforces:
- Same device → rejected
- Same side (two inputs or two outputs) → rejected
- Type mismatch per `TYPE_COMPAT` → rejected
- Power (`AC Mains`) ports → always rejected (cannot be patched)

## Reference data

`AMP BIBLE/` — PDFs, datasheets, and CSV product snapshots for Origin PRO amps. Use these to verify or update device specs in `catalog.js`. `AVIATOR_Consolidated_Updated.csv` and `AVIATOR_XV1.xlsx` in the root are the primary product data sources.

## Deployment

Deployed via Vercel. `vercel.json` rewrites all routes to `index.html` for SPA routing. `.vercel/project.json` holds the linked project ID.

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health

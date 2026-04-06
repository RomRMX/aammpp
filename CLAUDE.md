# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

**Amp Connect** is a browser-based signal path design tool for Origin Acoustics ProA amplifiers and speakers. Users drag devices from a sidebar onto a canvas, wire channels together, and export a Bill of Materials.

The active codebase is a React + Vite + TypeScript app built on **ReactFlow** (`@xyflow/react`), deployed to Vercel.

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
  App.tsx               # Root: ReactFlow canvas, sidebar, BOM modal, drag-drop, zone drawing
  main.tsx              # React DOM entry point
  index.css             # Tailwind base + design tokens
  data/catalog.ts       # AmpModel/SpeakerModel/SourceModel types + full product catalog
  utils/validation.ts   # Impedance/power validation, SPL estimation, channel status logic
  hooks/useStore.ts     # Zustand store — all runtime state, actions, catalog exports
  constants/theme.ts    # Color tokens and status styling maps
  components/
    AmpNode.tsx         # Amplifier canvas node (channels, load bars, wiring mode toggle)
    SpeakerNode.tsx     # Speaker canvas node (impedance/tap selection, mode toggle)
    ZoneNode.tsx        # Zone container node (group label, auto-wire trigger)
    Sidebar.tsx         # Left panel — catalog browser, search, drag-to-canvas
    BomModal.tsx        # Bill of materials export dialog
    DeletableEdge.tsx   # Custom ReactFlow edge with delete button on hover
    SourceNode.tsx      # Fixed audio source node
```

### State (Zustand — `useStore`)

All runtime state is in a single persisted Zustand store (`localStorage`). Key slices:

- `nodes` / `edges` — ReactFlow graph state (nodes carry domain data in `node.data`)
- `_nodeCounter` — monotonically increasing ID seed, rehydrated on load
- Catalog slices exported from store: `CATALOG_AMPS`, `CATALOG_SUB_AMPS`, `CATALOG_SPEAKERS`, `CATALOG_SUBS`, `CATALOG_SOURCE`

Key actions: `addAmp`, `addSpeaker`, `addSource`, `autoDropSpeaker`, `deleteNode`, `addEdge`, `deleteEdge`, `clearCanvas`.

### Node types and data shapes

| Node type | `node.data` key fields |
|-----------|------------------------|
| `AmpNode` | `model: AmpModel`, `channelWiring: Record<string, 'parallel'\|'series'>` |
| `SpeakerNode` | `model: SpeakerModel`, `selectedMode?: 'loz'\|'hiz'`, `selectedTap?: number` |
| `ZoneNode` | `label: string` |
| `SourceNode` | `model: SourceModel` |

Handles follow a convention: `amp-ch{n}-out`, `spk-in-loz`, `spk-in-hiz` — string matching is used in validation and auto-wiring.

### Catalog data model

`src/data/catalog.ts` defines:

```ts
AmpModel   { id, name, series, channels: AmpChannel[], msrp, dealer, badge }
AmpChannel { id, outputMode: 'lo-z'|'hi-z', ratedPower, minImpedance, ... }
SpeakerModel { id, name, collection, speakerType: 'lo-z'|'hi-z'|'tappable',
               impedance, sensitivity, maxWatts, coverageAngle, ... }
```

`src/data/catalog.ts` **is the source of truth** — edit it directly to add or update products. Find the right array (`AMPS`, `SPEAKERS`, or `SUBS`), copy an existing entry, and fill in the fields. TypeScript will flag missing required fields.

### Validation engine (`utils/validation.ts`)

This is where most domain complexity lives.

**Lo-Z channels**: computes parallel/series equivalent impedance from connected speakers per `channelWiring` setting. Status:
- RED: load impedance < channel `minImpedance` (overload)
- AMBER: within 15% of min, or series impedance > 2× rated
- GREEN: safe

**Hi-Z channels**: sums watt taps. RED > rated power, AMBER > 80% or > 25 devices (NEC limit), GREEN otherwise.

**SPL estimation**: voltage-source model using `ratedPower`, `minImpedance`, and speaker `sensitivity`.

**`pickBestAmpModel(requirements)`**: selects smallest amp with enough channels and appropriate headroom. Prefers ProA125 series for compactness.

**BOM export** is blocked when any channel is RED.

### Drag-drop and auto-wiring

1. Sidebar items set `dataTransfer` with model ID + type on `dragStart`
2. `App.tsx` `onDrop` converts screen → flow coords via `screenToFlowPosition`
3. `autoDropSpeaker` finds a free matching amp channel or creates a new amp, then wires source → amp → speaker automatically

### Zone drawing

Custom drag-select rectangle drawn in screen space over the ReactFlow canvas. Converts selection rect to flow coords, gathers enclosed speaker nodes, creates a `ZoneNode` with auto-wiring. Minimum 50×50px to prevent accidental zones.

### Wiring modes (lo-Z channels only)

Visible only when ≥2 speakers are connected to a lo-Z channel. Toggle between `parallel` (lower impedance, more power per speaker) and `series` (higher impedance, safer for borderline loads). Stored in `node.data.channelWiring`.

### Tappable speakers

Have dual modes: lo-z (8Ω) or hi-z (70V). Mode must be selected before the correct handle appears and a connection can be made. 70V mode requires a watt tap selection that feeds into hi-Z validation.

## Reference data

`AMP BIBLE/` — PDFs and CSV snapshots for Origin PRO amps. Use these to verify specs when editing `catalog.ts`.

## Deployment

Deployed via Vercel. `vercel.json` rewrites all routes to `index.html` for SPA routing.

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

# Quantum Circuit Compiler — Problem & Solution

## Problem Statement

When running the app and switching mapper selection, the visualization canvas initially appears completely black/empty for some mappers (notably the "Genetic Algorithm"). This results in no visible qubit layout or edges until an additional action (e.g. switching mappers again) forces a redraw.

## Root Causes

- The app originally only executed two mappers (Greedy and Look-Ahead) in `runOptimization`, so selecting `Genetic Algorithm` produced no `results` for that mapper and `currentResult` was undefined.
- The canvas drawing code in `QubitVisualizer` relied on the canvas element's raw `width` and `height` attributes and on object identity changes to `currentResult.steps`. Two issues resulted:
  - Device Pixel Ratio (DPR) / CSS size mismatch could make the canvas appear blank or blurry (no correct scaling applied at initial draw).
  - The parent code mutated `currentResult.steps` or other nested arrays in-place; React props kept the same reference so the `useEffect` drawing hook sometimes did not re-run for those in-place updates.

## Fix Summary

1. Ensure the Genetic mapper is executed so the visualizer actually receives data for it:
   - Added `GeneticSwapOptimizer` to the list of mappers executed in `runOptimization` so the Genetic Algorithm produces a `result` object.
   - File changed: [src/QuantumCompiler.tsx](src/QuantumCompiler.tsx)

2. Make canvas rendering robust and trigger on in-place updates:
   - `QubitVisualizer` now:
     - Reads the canvas CSS size via `getBoundingClientRect()` and sets the canvas `width`/`height` to CSS size * `window.devicePixelRatio` for crisp rendering.
     - Calls `ctx.setTransform(1,0,0,1,0,0)` and `ctx.scale(dpr, dpr)` to ensure consistent transforms each draw.
     - Uses safer checks for `hardware.graph` and `positions` to avoid exceptions if data is missing.
     - Expands the `useEffect` dependency list to include `currentResult?.steps?.length` and `currentResult?.steps?.[step]?.layout?.length` so the effect re-runs when steps are populated or modified in-place.
   - File changed: [visualization/QubitVisualizer.tsx](visualization/QubitVisualizer.tsx)

## How the Solution Works

- Running the Genetic mapper produces a `result` with a `steps` array so selecting the Genetic Algorithm sets `currentResult` and the visualizer has meaningful data to draw.
- The canvas initialization logic ensures the pixel buffer matches the displayed size and device pixel ratio; this prevents an initial blank/low-resolution canvas.
- Watching the steps length + current step layout length allows the visualizer to detect mutations made in-place (no new object identity) and redraw accordingly.

## Files Modified

- [visualization/QubitVisualizer.tsx](visualization/QubitVisualizer.tsx) — DPR, safe draws, and improved effect dependencies.
- [src/QuantumCompiler.tsx](src/QuantumCompiler.tsx) — include `GeneticSwapOptimizer` in `runOptimization` so genetic results are present.

## How to Test Locally

1. Install / start the dev server:

```bash
npm install
npm run dev
```

2. In the app UI:
- Choose a topology and a benchmark.
- Click **Run All Mappers**.
- Select **Genetic Algorithm** in the Mapper selection.
- The visualization should render the qubit graph (nodes, edges) immediately.

If the canvas still appears blank, try resizing the window or switching mapper and back; if that fixes it, the app is receiving results but the drawing effect still needs a trigger — please report the exact steps and I will add an explicit force-update.

## Recommended Next Steps

- Move heavy optimization (especially Genetic) into a Web Worker so the UI remains responsive while mapping runs.
- Prefer immutable updates for `results`/`currentResult` (i.e., replace arrays/objects instead of mutating) to avoid dependence on deep-change detection logic.
- Add unit or integration tests around the mapping pipeline to ensure every mapper produces a `result` with the expected shape (`steps`, `depth`, `insertedSwaps`, etc.).

## Contact / Notes

If you'd like, I can:
- Move the Genetic mapping into a worker now.
- Add a small `useForceUpdate` hook to `QubitVisualizer` as a fallback.
- Add visual placeholders and a loading state for mappers that take longer.


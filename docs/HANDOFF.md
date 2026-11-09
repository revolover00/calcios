# Calcios — Engineering Handoff

## Architecture

- **Calculator state machine (`src/core/calculator.ts`)** — immutable reducer for the 12 available modes, setup and clear menus, editing prompts, result navigation, and save/hydrate persistence. The main keypad and display layouts remain in the established hardware design.
- **Expression engine (`src/core/expression.ts`, `src/core/value.ts`)** — tokenizer and Pratt parser backed by Decimal.js precision plus exact rational/symbolic values. It handles assignments, `CALC`/`SOLVE`, angle conversion, unit conversions, statistics, and numeric functions.
- **Complex math (`src/core/cmplx.ts`)** — rectangular/polar values, branch-aware arithmetic, trigonometric and hyperbolic functions, complex variable memory `A`–`F`, `M`, `X`, and `Y`, and complex `STO`/`RCL` and memory accumulation.
- **Math-mode engines** — `calculus.ts`, `eqn.ts`, `ineq.ts`, `ratio.ts`, `stat.ts`, `dist.ts`, `matrix.ts`, `vector.ts`, and `table.ts` implement mode-specific solvers and data structures.
- **LCD and hardware (`src/components/LcdScreen.tsx`, `NaturalMath.tsx`, `CalculatorHardware.tsx`, `src/styles/calculator.css`)** — custom dot-matrix fonts, 2D math renderer, menus/editors/prompts, physical key layout, and existing color themes.
- **Scanner (`src/core/visionScan.ts`) and PWA** — image math scanning with optional configured API, install/offline support, and session persistence.

## Current Operating Modes

`COMP`, `CMPLX`, `STAT`, `BASE-N`, `EQN`, `MATRIX`, `TABLE`, `VECTOR`, `INEQ`, `VERIF`, `DIST`, and `RATIO`.

Recent parity workflows include multi-variable and selectable-target SOLVE, optional tolerances in derivatives and definite integrals, complex variable memory, RATIO proportions, and cubic EQN local extrema. Complex circular and inverse circular trigonometry respect the selected `DEG`/`RAD`/`GRA` setup; inverse hyperbolic functions support complex arguments.

## Verification

```bash
npm run typecheck
npm test
npm run build
```

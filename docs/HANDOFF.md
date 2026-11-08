# Calcios — Engineering Handoff

## 1. Architecture Overview

- **Pure State Machine (`src/core/calculator.ts`)**: Deterministic reducer managing all 11 calculator modes (`COMP`, `CMPLX`, `STAT`, `BASE-N`, `EQN`, `MATRIX`, `TABLE`, `VECTOR`, `INEQ`, `VERIF`, `DIST`), setup flags (`MathIO`/`LineIO`, `Deg`/`Rad`/`Gra`, `Norm`/`Fix`/`Sci`, `a b/c`/`d/c`, `CMPLX` rectangular/polar), replay history, and variable registers (`A`–`F`, `X`, `Y`, `M`, `Ans`, `PreAns`).
- **2D Natural Math Tree (`src/core/exprTree.ts` + `src/components/NaturalMath.tsx`)**: Hierarchical token-list editor supporting stacked fractions, mixed fractions, arbitrary roots, superscripts, base-$a$ logarithms, definite integrals, derivatives, summations, and products with deterministic 4-way cursor traversal.
- **Symbolic & Numerical Engine (`src/core/bigintFrac.ts`, `symbolic.ts`, `parser.ts`, `solvers.ts`)**: Exact `BigInt` rational reduction, multi-radical canonical forms, nested square-root denesting, exact $\pi$-angle trigonometry, Cardano/quadratic root solvers, adaptive Gauss–Legendre quadrature, and Newton–Raphson `SOLVE`.
- **Dot-Matrix Display & Unified 3D Hardware (`scripts/build-calcios-fonts.mjs`, `src/components/CalculatorHardware.tsx`, `src/styles/calculator.css`)**:
  - Custom `CalciosLCDLarge` (`5×9`) and `CalciosLCDSmall` (`5×6`) TrueType pixel fonts rendered onto `#cfe3e6` FSTN glass with `#020405` pixel ink.
  - Unified physical handheld shell (`356 × 708` logical px) across **Onyx Black**, **Dusty Rose Pink**, and **Ice Steel Blue**, scaled cleanly via `--calc-scale` so the calculator always retains its authentic handheld proportions on desktop and mobile screens.

## 2. Verification Commands

```bash
npm run typecheck
npm test
npm run build
```

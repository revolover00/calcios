# Project Handoff: `fx-991ES PLUS C` Functionality, `fx-95ES PLUS` Appearance

Last updated: 2026-11-08.

## User's Objective & Design Constraints

- Standalone TypeScript + React web calculator implementing the modes, functions, and secondary functions of **Casio fx-991ES PLUS C**, styled after the black **Casio fx-95ES PLUS (2nd edition)** in `references/fx95-layout.jpg`.
- **Viewport shows ONLY the calculator hardware**—no external headers, sidebars, or floating banners.
- Hardware shell, keys, legends, and LCD are **100% code-drawn** (CSS/React); `references/fx95-layout.jpg` is never rendered in the app.
- Access to `fx-991ES PLUS C` secondary menus (`STAT`, `CMPLX`, `BASE`, `MATRIX`, `VECTOR`, `VERIFY`, `CONST 01–40`, `CONV 01–40`) works natively via `SHIFT + 1..8` on the keypad, while dedicated upper keys absent from the `fx-95ES PLUS` physical faceplate (`CALC`, `SOLVE`, `=`, `∫dx`, `d/dx`, `Σ(`, `Π(`) are accessible via a discreet `991+` bezel micro-popover inside the calculator frame (closed by default).

## Architecture & Implemented Modules

- `src/core/symbolic.ts`, `src/core/value.ts`, `src/core/format.ts`: 34-digit `decimal.js` arithmetic, `BigInt` exact rationals, exact quadratic surd algebra `(a + b√rad)/d` with denominator rationalization, exact `(n/d)π` multiples, special-angle trig/inverse-trig in `DEG`/`RAD`/`GRA`, `DMS`, `FACT`, `ENG`, `Pol`/`Rec`, `RanInt#`, and `Rnd`.
- `src/core/constants.ts`: 40 CODATA physical constants (`const01`–`const40`) and 40 unit conversions (`▸conv01`–`▸conv40`).
- `src/core/expression.ts` & `src/core/calculus.ts`: Custom Pratt parser/evaluator (zero `eval`), `STAT` variable/regression tokens, numerical `deriv`, adaptive Gauss-Legendre `integ`, `sigma`, `prod`, and Newton-Secant `SOLVE`.
- Mode engines:
  - `src/core/cmplx.ts` (`MODE 2: CMPLX`)
  - `src/core/stat.ts` (`MODE 3: STAT` — `1-VAR` + 7 regressions + frequency support)
  - `src/core/basen.ts` (`MODE 4: BASE-N` — 32-bit two's complement + bitwise ops)
  - `src/core/eqn.ts` (`MODE 5: EQN` — 2×2, 3×3, quadratic, cubic)
  - `src/core/matrix.ts` (`MODE 6: MATRIX` — up to 3×3 `MatA/B/C/Ans`, `det`, `Trn`, inverse, powers)
  - `src/core/table.ts` (`MODE 7: TABLE` — `f(X)` & `g(X)`)
  - `src/core/vector.ts` (`MODE 8: VECTOR` — 2D/3D `VctA/B/C/Ans`, dot & cross products, norm)
  - `src/core/ineq.ts` (`MODE ▼ 1: INEQ` — quadratic & cubic inequalities)
  - `src/core/verif.ts` (`MODE ▼ 2: VERIF` — `TRUE`/`FALSE` relational verification)
  - `src/core/dist.ts` (`MODE ▼ 3: DIST` — Normal PD/CD, Inverse Normal, Binomial PD/CD, Poisson PD/CD)
- `src/core/calculator.ts`: Pure state machine & reducer orchestrating all 11 modes, interactive LCD editors, `SETUP`, `CLR`, history, and persistence.
- `src/components/CalculatorHardware.tsx`, `src/components/LcdScreen.tsx`, `src/components/NaturalMath.tsx`, `src/styles/calculator.css`, `src/App.tsx`: Calculator-only UI and Natural-V.P.A.M. 2D LCD renderer.

## Honesty & Edge-Case Differences vs. Casio Hardware

- Clean-room implementation; no Casio ROM or proprietary decompiled firmware is used.
- `d/dx`, `∫dx`, and `SOLVE` use independent numerical algorithms rather than Casio's internal ROM stepping/stopping rules, so extreme ill-conditioned functions can differ in the last digits or convergence behavior.
- Symbolic surd simplification handles single-radical quadratic forms `(a + b√r)/d`; multi-radical linear combinations such as `(√6 − √2)/4` evaluate to high-precision decimals.
- Automated verification currently covers 86 unit & integration tests across `expression.test.ts`, `calculator.test.ts`, and `App.test.tsx`.

# Project Handoff: `fx-991ES PLUS C` Functionality, `fx-95ES PLUS` Appearance

Last updated: 2026-11-08.

## User's Objective & Design Constraints

- Standalone TypeScript + React web calculator implementing the modes, functions, and secondary functions of **Casio fx-991ES PLUS C**, styled after the black **Casio fx-95ES PLUS (2nd edition)** in `references/fx95-layout.jpg`.
- **Viewport shows ONLY the calculator hardware**—no external headers, sidebars, or floating banners.
- Hardware shell, keys, printed faceplate legends, and LCD are **100% code-drawn** (CSS/React); `references/fx95-layout.jpg` is never rendered in the app.
- Access to `fx-991ES PLUS C` secondary menus and functions works natively via `SHIFT + 1..9` and `ALPHA` key combinations (`STAT`, `CMPLX`, `BASE`, `MATRIX`, `VECTOR`, `VERIFY`, `CONST 01–40`, `CONV 01–40`, `GCD`, `LCM`, `Int`, `Intg`, `÷R`, `0.x̅`, `PreAns`), plus a discreet `991+` bezel micro-popover inside the calculator frame (closed by default).

## Architecture & Implemented Modules

- `src/core/symbolic.ts`, `src/core/value.ts`, `src/core/format.ts`: 34-digit `decimal.js` arithmetic, `BigInt` exact rationals, manual step-by-step fraction simplification `▸Simp` with divisor factor badge (`÷k`), single & multi-radical surd algebra `(∑ c_i √r_i)/d` with Galois prime-conjugation denominator rationalization, nested surd denesting `√(a+b√r)`, exact `(n/d)π` multiples, special-angle trig/inverse-trig (including `15°` and `75°`), exact recurring decimal parsing & period decomposition (`0.x̅`), `÷R` quotient/remainder, `GCD`/`LCM`/`Int`/`Intg`, `DMS`, `FACT`, `ENG`, `Pol`/`Rec`, `RanInt#`, and `Rnd`.
- `src/core/constants.ts`: 40 CODATA physical constants (`const01`–`const40`) and 40 unit conversions (`▸conv01`–`▸conv40`).
- `src/core/expression.ts` & `src/core/calculus.ts`: Custom Pratt parser/evaluator (zero `eval`) with exact token character-offset tracking for `[◀][▶]:Goto`, `▸Simp`, `PreAns`, `STAT` variable/regression/`Distr` tokens (`P(`, `Q(`, `R(`, `▸t`, `x̂₁`, `x̂₂`, `ŷ`), numerical `deriv`, adaptive Gauss-Legendre `integ`, `sigma`, `prod`, and Newton-Secant `SOLVE`.
- Mode engines:
  - `src/core/cmplx.ts` (`MODE 2: CMPLX` — rectangular & polar `∠`, 2D Natural-V.P.A.M. `complex-2d` formatting, `Re⇔Im` inspection, `arg`, `Conjg`, exact symbolic parts)
  - `src/core/stat.ts` (`MODE 3: STAT` — `1-VAR` with `Distr` & quartiles + 7 regressions including `_+CX²` higher sums and `x̂₁`/`x̂₂`)
  - `src/core/basen.ts` (`MODE 4: BASE-N` — 32-bit two's complement, bitwise ops, and `d`/`h`/`b`/`o` base prefixes)
  - `src/core/eqn.ts` (`MODE 5: EQN` — 2×2, 3×3, exact symbolic 2D real & complex quadratic roots + `Min/Max` vertex coordinates, analytic cubic)
  - `src/core/matrix.ts` (`MODE 6: MATRIX` — up to 3×3 `MatA/B/C/Ans`, `det`, `Trn`, `Ref`, `Rref`, inverse, powers)
  - `src/core/table.ts` (`MODE 7: TABLE` — `f(X)` & `g(X)` with overwrite-on-type range prompts)
  - `src/core/vector.ts` (`MODE 8: VECTOR` — 2D/3D `VctA/B/C/Ans`, dot & cross products, norm, `Angle(`)
  - `src/core/ineq.ts` (`MODE ▼ 1: INEQ` — quadratic & cubic inequalities with 2D Natural-V.P.A.M. `X<A, B<X` header + exact 2D roots)
  - `src/core/verif.ts` (`MODE ▼ 2: VERIF` — single & chained relational verification `TRUE`/`FALSE`)
  - `src/core/dist.ts` (`MODE ▼ 3: DIST` — Normal PD/CD, Inverse Normal, Binomial PD/CD, Poisson PD/CD in `Var` & dynamic 40-row `List` modes)
- `src/core/calculator.ts`: Pure state machine & reducer orchestrating all 11 modes, exact `[◀][▶]:Goto` error cursor jumping, `SHIFT + =` (`≈` decimal approximation & `Re⇔Im`), `M+`/`STO` immediate evaluation display, full 2-page `SETUP` (`MathO`/`LineO`, `ab/c`/`d/c`, `CMPLX`, `STAT`, `Disp` Dot/Comma, `TABLE`, `Recur`, `◀CONT▶`), interactive LCD editors, `CLR`, history, and full `localStorage` persistence.
- `src/components/CalculatorHardware.tsx`, `src/components/LcdScreen.tsx`, `src/components/NaturalMath.tsx`, `src/styles/calculator.css`, `src/App.tsx`: Calculator-only UI and Natural-V.P.A.M. 2D LCD renderer.

## Honesty & Edge-Case Differences vs. Casio Hardware

- Clean-room implementation; no Casio ROM or proprietary decompiled firmware is used.
- `d/dx`, `∫dx`, and `SOLVE` use independent numerical algorithms rather than Casio's internal ROM stepping/stopping rules, so extreme ill-conditioned functions can differ in the last digits or convergence behavior.
- Cubic equations in `EQN` use high-precision analytic roots with rational snapping rather than general Cardano radical formulas, whereas quadratic equations solve symbolically (`(a ± b√r)/d` and `a ± b√r i`).
- Automated verification covers 96 unit & integration tests across `expression.test.ts`, `calculator.test.ts`, and `App.test.tsx`.

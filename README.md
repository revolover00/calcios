<div align="center">

# CALCIOS

**Precision 2D Natural Math Scientific Calculator**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](#tech-stack)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=0b1016)](#tech-stack)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](#quick-start)
[![Tests](https://img.shields.io/badge/Vitest-112%20Passing-22c55e?logo=vitest&logoColor=white)](#quality--verification)

A realistic, handheld-scale 3D scientific calculator built entirely in code — featuring custom `5×9` and `5×6` TrueType dot-matrix LCD fonts, exact 2D symbolic rendering, 11 mathematical operating modes, and three unified anodized hardware editions (**Onyx Black**, **Dusty Rose Pink**, and **Ice Steel Blue**).

<br />

<img src="docs/screenshots/calcios-editions.png" alt="Calcios Scientific Calculator in Onyx Black, Dusty Rose Pink, and Ice Steel Blue" width="100%" />

</div>

---

## Mathematical Calculations Showcase

Calcios combines an exact symbolic algebra kernel (`BigInt` rationals, canonical surds, $\pi$ multiples, and polar complex phasors) with high-precision numerical solvers — rendered directly onto an FSTN dot-matrix display (`#cfe3e6` glass with `#020405` crisp pixel ink).

<p align="center">
  <img src="docs/screenshots/calcios-calculations.png" alt="Calculus, Symbolic Radicals, Complex Phasors, and Matrix Algebra on Calcios" width="100%" />
</p>

<p align="center">
  <img src="docs/screenshots/calcios-modes.png" alt="Discrete Summation, Prime Factorization, Equation Solver, and Programmer Base-N on Calcios" width="100%" />
</p>

---

## Highlights

- **Authentic Dot-Matrix 2D Display (`MathIO` & `LineIO`)**
  - Custom-compiled TrueType pixel fonts (`CalciosLCDLarge` `5×9` and `CalciosLCDSmall` `5×6`) paired with dedicated smooth top-row annunciators (`SHIFT`, `ALPHA`, `M`, `STO`, `RCL`, `STAT`, `CMPLX`, `MAT`, `VCT`, `[D]/[R]/[G]`, `FIX`, `SCI`, `Math`, `Re⇔Im`).
  - Multi-story 2D textbook fractions, nested radicals, superscripts, logarithms with arbitrary bases, definite integrals $\int_a^b f(X)\,dX$, derivatives $\frac{d}{dX}\big|_{X=a}$, summations $\sum$, and products $\prod$ with full 4-way structural cursor navigation (`◀` `▶` `▲` `▼`) and blinking `■` / `□` template placeholders.
- **Exact Symbolic Engine + Instant `S⇔D` Toggle**
  - Exact `BigInt` rational & mixed-fraction arithmetic, multi-term surd simplification (including nested square roots such as $\sqrt{3 + 2\sqrt{2}} = 1 + \sqrt{2}$ and exact trigonometric values every $15^\circ$ such as $\sin 75^\circ = \frac{\sqrt{6}+\sqrt{2}}{4}$), exact $\pi$ multiples, recurring decimals ($0.\overline{x}$), prime factorization (`FACT`), quotient-with-remainder (`÷R`), and fraction reduction (`▸Simp`).
- **Unified 3-Color Handheld Hardware**
  - True physical handheld footprint (`356 × 708` logical px) proportionally scaled to remain framed and centered on desktop, tablet, and mobile viewports without stretching edge-to-edge.
  - Instant one-tap switching between **Onyx Black**, **Dusty Rose Pink**, and **Ice Steel Blue** via the three color dots on the top-right bezel (persisted in `localStorage`).
- **Built-In Scientific Reference Library**
  - **40 CODATA physical constants** (`SHIFT` + `7` `CONST`) and **40 bidirectional unit conversions** (`SHIFT` + `8` `CONV`).

---

## 11 Operating Modes

Press **`MODE`** (and **`▼`** for page 2) to switch across all 11 specialized modes:

| Key | Mode | Capabilities |
| :-: | :--- | :--- |
| `1` | **`COMP`** | General 2D symbolic & numerical computation, `CALC` variable substitution, Newton–Raphson `SOLVE`, definite integration, differentiation, $\sum$, $\prod$, `FACT`, `GCD`, `LCM`, `Pol`, `Rec`, DMS (`° ’ ”`), and 9 memories (`A`–`F`, `X`, `Y`, `M`, `Ans`, `PreAns`). |
| `2` | **`CMPLX`** | Rectangular ($a + bi$) and polar ($r\angle\theta$) complex arithmetic, powers, conjugates (`Conj`), arguments (`Arg`), absolute values (`Abs`), and `Re⇔Im` toggling. |
| `3` | **`STAT`** | 1-variable and 2-variable statistical editor plus 8 regression models (`1-VAR`, `A+BX`, `_+CX²`, `ln X`, `e^X`, `A·B^X`, `A·X^B`, `1/X`). |
| `4` | **`BASE-N`** | 32-bit signed two's-complement programmer arithmetic across `DEC`, `HEX`, `BIN`, and `OCT` with bitwise `and`, `or`, `xor`, `xnor`, `not`, and `neg`. |
| `5` | **`EQN`** | Linear systems ($2\times2$ and $3\times3$) plus exact symbolic & complex roots for quadratic ($aX^2+bX+c=0$) and cubic ($aX^3+bX^2+cX+d=0$) equations. |
| `6` | **`MATRIX`** | Interactive matrix editor (`MatA`, `MatB`, `MatC`, `MatAns` up to $3\times3$) supporting addition, multiplication, determinants (`det`), transposes (`Trn`), and inverses ($A^{-1}$). |
| `7` | **`TABLE`** | Dual-function evaluation table for $f(X)$ and optional $g(X)$ over user-defined `Start`, `End`, and `Step` ranges. |
| `8` | **`VECTOR`** | 2D and 3D vector algebra (`VctA`, `VctB`, `VctC`, `VctAns`) with vector addition, scalar scaling, dot products (`Dot`), and cross products (`×`). |
| `▼` → `1` | **`INEQ`** | Symbolic quadratic and cubic inequality solver across `<`, `>`, `≤`, and `≥` with exact interval notation. |
| `▼` → `2` | **`VERIF`** | Mathematical equality and inequality verification (`TRUE` / `FALSE`). |
| `▼` → `3` | **`DIST`** | Normal (`P(t)`, `Q(t)`, `R(t)`, `InvN`), Binomial (`PD` / `CD`), and Poisson (`PD` / `CD`) probability distributions. |

---

## Keyboard Shortcuts

Every hardware key can be clicked directly or driven from a physical keyboard:

| Physical Key | Calculator Action |
| :--- | :--- |
| `0` – `9`, `.` | Digits & decimal point |
| `+`, `-`, `*`, `/` | Addition, subtraction, multiplication, division |
| `(`, `)`, `,` | Parentheses & argument separator |
| `^` | Exponent template ($x^{\blacksquare}$) |
| `Enter` / `=` | Evaluate (`=`) |
| `Backspace` | Delete (`DEL`) |
| `Escape` | All Clear (`AC`) |
| `ArrowUp` / `Down` / `Left` / `Right` | 4-way D-Pad cursor & replay history navigation |
| `s` / `a` / `m` | Toggle `SHIFT` / `ALPHA` / `MODE` |
| `d` | Toggle exact / decimal format (`S⇔D`) |
| `x` | Insert variable `X` |
| `p` | Insert $\pi$ |
| `r` | Insert square root ($\sqrt{\blacksquare}$) |
| `f` | Insert 2D fraction ($\frac{\blacksquare}{\square}$) |
| `i` | Insert imaginary unit $i$ (in `CMPLX`) or `sin(` |
| `c` / `t` / `l` / `n` | Insert `cos(` / `tan(` / `log(` / `ln(` |

---

## Quick Start

```bash
# Install dependencies
npm install

# Start the development server
npm run dev

# Build production bundle
npm run build
```

## Quality & Verification

```bash
# Strict TypeScript check
npm run typecheck

# Run the full 112-test Vitest suite (engine, parser, 2D cursor torture tests, UI & themes)
npm test

# Rebuild the custom 5×9 and 5×6 TrueType dot-matrix LCD fonts (optional)
node scripts/build-calcios-fonts.mjs
```

---

## Project Structure

```text
calcios/
├── docs/
│   ├── screenshots/              # High-resolution PNG showcases of calculations & editions
│   └── HANDOFF.md                # Architecture & engineering notes
├── scripts/
│   └── build-calcios-fonts.mjs   # Binary TrueType (.ttf) compiler for 5×9 & 5×6 LCD pixel fonts
├── src/
│   ├── assets/                   # Generated calcios-lcd-large.ttf & calcios-lcd-small.ttf
│   ├── components/
│   │   ├── CalculatorHardware.tsx # 3D anodized chassis, color-edition switcher, D-pad & keypad
│   │   ├── LcdScreen.tsx          # FSTN dot-matrix display, annunciators, wizards & editors
│   │   └── NaturalMath.tsx        # 2D textbook AST & interactive token renderer
│   ├── core/
│   │   ├── bigintFrac.ts          # Exact arbitrary-precision BigInt rational arithmetic
│   │   ├── symbolic.ts            # Canonical surds, nested root simplification & π multiples
│   │   ├── complex.ts             # Rectangular & polar complex math
│   │   ├── parser.ts              # Recursive-descent tokenizer & evaluator
│   │   ├── solvers.ts             # Adaptive Gauss-Legendre integration, SOLVE, EQN, INEQ, STAT, DIST
│   │   ├── matrixVector.ts        # 3×3 matrix & 2D/3D vector linear algebra
│   │   ├── constants.ts           # 40 CODATA scientific constants & 40 unit conversions
│   │   └── calculator.ts          # Pure immutable reducer driving all 11 modes
│   ├── data/
│   │   └── keyLayout.ts           # Hardware key definitions, legends & English accessibility labels
│   └── styles/
│       └── calculator.css         # Onyx Black, Dusty Rose Pink & Ice Steel Blue 3D hardware themes
└── package.json
```

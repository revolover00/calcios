# Calcios Architecture & Handoff

## Overview

- **Calcios** is a standalone TypeScript + React scientific calculator rendered 100% in code (HTML/CSS/SVG + custom generated dot-matrix TrueType fonts `CalciosLCDLarge` `5×9` and `CalciosLCDSmall` `5×6`, zero `<img>` tags).
- Displays at authentic handheld proportions (`356 × 708` logical px, uniformly scaled down only if a small screen has less room, always keeping surrounding margin) across mobile, tablet, and desktop viewports.
- Includes three unified injection-molded color editions (**Black**, **Pink**, and **Ice Blue**) sharing the exact same chassis, top-right solar window, 3D chamfered LCD bezel, spun-metal round buttons, diamond-knurled D-pad, and two-tone sculpted keypad.

## Core Modules

- `scripts/build-calcios-fonts.mjs`: Generates `src/assets/calcios-lcd-large.ttf` (`5×9`) and `src/assets/calcios-lcd-small.ttf` (`5×6`).
- `src/core/mathAst.ts`: Structural 2D template AST engine powering 4-way (`◀`/`▶`/`▲`/`▼`) cursor navigation, smart `DEL`/`INS`, and operand-to-numerator fraction wrapping.
- `src/core/expression.ts` & `src/core/calculus.ts`: Custom Pratt parser/evaluator with `Decimal.js` precision, exact symbolic surds/fractions/`π` multiples, numerical derivatives, adaptive Gauss-Legendre definite integrals, `∑`/`∏`, `CALC`, and Newton-Secant `SOLVE`.
- `src/core/{cmplx,stat,basen,eqn,matrix,table,vector,ineq,verif,dist,constants}.ts`: All 11 scientific modes plus 40 `CONST` and 40 `CONV` entries.
- `src/components/{CalculatorHardware,LcdScreen,NaturalMath}.tsx` & `src/styles/calculator.css`: Calcios hardware UI, color edition switcher, and 2D dot-matrix LCD renderer.

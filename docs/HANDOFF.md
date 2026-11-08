# Project handoff: fx-991ES PLUS C functionality, fx-95ES PLUS appearance

Last updated: 2026-11-08. This file is intended to let a new assistant continue the project without claiming that it can see the original conversation.

## User's objective and explicit choices

The user speaks Egyptian Arabic and wants a standalone web calculator with **all** functions and secondary functions of the Casio fx-991ES PLUS C. They want the visual design and button layout to resemble the uploaded black fx-95ES PLUS 2nd edition in `references/fx95-layout.jpg`, but the body, controls, and LCD must be **drawn in code**; the photograph must not be used as the actual calculator UI. Because that photographed layout has fewer/different keys than the target, the user explicitly chose an additional panel or menu for missing functions. Use TypeScript and standard web technologies; Python or Rust may be used if needed for performance. The user wants a senior-level process: clear scope, modular code, tests, genuine functionality, and incremental deliverables.

Target reference/oracle: https://github.com/kishyassin/casio-fx-991es-emulator . The repository and its release contain a compiled Windows installer, not the original Casio source. In the previous environment it was run under Wine, Xvfb and noVNC and basic interactions were verified. Do **not** assume that previous live preview, process, path, or files exist in the new environment. Official target manual: https://support.casio.com/pdf/004/fx-115_991ES_PLUS_C_E.pdf .

## Critical honesty and licensing notes

- No original Casio source code has been obtained. A memory inspection of the running original emulator identified the string `LY727XA` in its firmware region. That is **compiled machine code**, not source; no ROM or original emulator executable is included here. Do not claim that the physical calculator and the Windows emulator ROM are identical.
- https://codeberg.org/gwetm/gyx-decomp is community reconstruction of **GYX** family firmware, not Casio's original development source, and is not established to match LY727XA. The project's own README notes incomplete items; no clear project-wide reuse license was found. Do not incorporate it without checking rights.
- https://github.com/smkttl/CasioEmuWeb is independent GPL-3.0-or-later emulator source, not Casio's source; it requires compatible separately obtained model data and firmware. Its generic tests previously passed, but exact target compatibility was not established.
- The license accompanying the original Windows emulator expressly contains restrictions on reverse engineering, copying, modification, and distribution. Review rights before using or redistributing its code, firmware, or artwork. The intended implementation here is independent.
- Do not claim 100% parity or all functions complete until they are implemented and validated. Differentiate unsupported, approximated, and verified behavior.

## Current workspace and verification

The code in this repository is an **early foundation**, not a completed or runnable app. It has:

- `src/core/errors.ts` — typed calculator errors.
- `src/core/value.ts` — decimal.js arithmetic with guard digits, optional exact BigInt rationals, serialization, factorial, combinations/permutations, some real scientific functions and angle conversions.
- `src/core/expression.ts` — bounded, custom tokenizer/parser and evaluator (no JavaScript `eval`), implicit multiplication and function templates.
- `src/core/format.ts` — limited result display and fraction/decimal formatting.
- `src/core/calculator.ts` — a pure reducer for input, SHIFT/ALPHA, memory, answer, history, angle setting, menus, errors, and power state. Other modes are explicitly marked as in development; not silently simulated.
- `src/core/expression.test.ts` and `src/core/calculator.test.ts` — 54 unit tests in total.
- `index.html`, Vite/TypeScript config, and `package.json`/lockfile — skeleton only.

As last checked in the previous environment, `npm run typecheck` and `npm test` passed (54 tests). **There is no `src/main.tsx`, no React interface, no CSS, and no current rebuilt calculator preview.** Consequently, `npm run build`/the webpage cannot yet be expected to work. The tests verify small core cases only; they do not prove that the entire model or its rounding/formatting matches Casio.

Known limitations include, but are not limited to: no full natural textbook editor; no complete exact symbolic surd/pi output; no full scientific modes, statistics, matrix/vector, equation, table, inequality, verification, or distribution workflows; some physical keys such as DMS/ENG/INS are not implemented; and exact error, display, precision, and edge-case parity remain unverified. Inspect the code and tests rather than assuming this list is exhaustive.

## Recommended next steps

1. Run `npm ci`, `npm run typecheck`, and `npm test` and inspect existing code before changing architecture. The local project uses Node.js 20+.
2. Create a functional Vite/React entry point (`src/main.tsx`, `src/App.tsx`, CSS and components). Recreate the photo visually using CSS/SVG/code, including physical keys and an LCD, with responsive desktop/mobile behavior and accessible keyboard controls.
3. Wire the UI to the existing reducer. Provide the additional panel/menu for functions absent from the reference layout. Unimplemented features must be clearly identified rather than pretending to calculate.
4. Maintain an inventory derived from the exact model's official manual. Implement and test each mode and secondary function incrementally; extend the parser/state model as needed.
5. Build differential tests against the official emulator when an appropriately licensed copy and test environment are available. Use an isolated test instance; never interrupt a user's live calculator session. Validate ordinary and edge cases, display/rounding, memory, key sequences, and errors.
6. Run typecheck, unit tests, production build, and desktop/mobile browser interaction tests. Report tested coverage and remaining gaps honestly.

## Current user-facing expectation

The user explicitly asked to start building, but interrupted the build to transfer the conversation to a GitHub-connected chat. The prior estimate was roughly 85–160 hours of work for a full implementation and testing, not a guaranteed deadline. The next assistant should continue the work instead of treating this foundation as a completed calculator. Communicate naturally in Egyptian Arabic and explain progress concisely.

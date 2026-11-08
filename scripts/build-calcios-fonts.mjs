import fs from 'node:fs';
import path from 'node:path';

/**
 * Generates Calcios 96×31 dot-matrix TrueType (.ttf) fonts:
 *  1) src/assets/calcios-lcd-large.ttf — 5×9 tall slender main display font (+ 2 descender rows)
 *  2) src/assets/calcios-lcd-small.ttf — 5×6 small fraction / exponent / subscript font
 *
 * Every active dot '#' is emitted as a crisp 93×93 square pixel inside a 100×100 dot pitch.
 */

// ============================================================================
// 1. CALCIOS LARGE FONT (5×9 cap/digit height + 2 descender rows = 11 rows)
//    Rows 0..8 sit above baseline (y = 800 down to 0); rows 9..10 sit at y = -100, -200.
// ============================================================================
const LARGE_GLYPHS = {
  ' ': { adv: 4, rows: [] },

  // Tall 5×9 LCD digits (open un-slashed 0, serifed 1, crisp diagonal 2, etc.)
  '0': [
    '.###.',
    '#...#',
    '#...#',
    '#...#',
    '#...#',
    '#...#',
    '#...#',
    '#...#',
    '.###.',
  ],
  '1': [
    '..#..',
    '.##..',
    '..#..',
    '..#..',
    '..#..',
    '..#..',
    '..#..',
    '..#..',
    '.###.',
  ],
  '2': [
    '.###.',
    '#...#',
    '....#',
    '....#',
    '...#.',
    '..#..',
    '.#...',
    '#....',
    '#####',
  ],
  '3': [
    '.###.',
    '#...#',
    '....#',
    '....#',
    '.###.',
    '....#',
    '....#',
    '#...#',
    '.###.',
  ],
  '4': [
    '...#.',
    '..##.',
    '.#.#.',
    '.#.#.',
    '#..#.',
    '#####',
    '...#.',
    '...#.',
    '...#.',
  ],
  '5': [
    '#####',
    '#....',
    '#....',
    '####.',
    '....#',
    '....#',
    '....#',
    '#...#',
    '.###.',
  ],
  '6': [
    '.###.',
    '#...#',
    '#....',
    '#....',
    '####.',
    '#...#',
    '#...#',
    '#...#',
    '.###.',
  ],
  '7': [
    '#####',
    '#...#',
    '....#',
    '...#.',
    '...#.',
    '..#..',
    '..#..',
    '..#..',
    '..#..',
  ],
  '8': [
    '.###.',
    '#...#',
    '#...#',
    '#...#',
    '.###.',
    '#...#',
    '#...#',
    '#...#',
    '.###.',
  ],
  '9': [
    '.###.',
    '#...#',
    '#...#',
    '#...#',
    '.####',
    '....#',
    '....#',
    '#...#',
    '.###.',
  ],

  // Tall 5×9 Uppercase A–Z (verified pixel-for-pixel against X<A,B<X in reference photo)
  A: [
    '.###.',
    '#...#',
    '#...#',
    '#...#',
    '#####',
    '#...#',
    '#...#',
    '#...#',
    '#...#',
  ],
  B: [
    '####.',
    '#...#',
    '#...#',
    '#...#',
    '####.',
    '#...#',
    '#...#',
    '#...#',
    '####.',
  ],
  C: [
    '.###.',
    '#...#',
    '#....',
    '#....',
    '#....',
    '#....',
    '#....',
    '#...#',
    '.###.',
  ],
  D: [
    '####.',
    '#...#',
    '#...#',
    '#...#',
    '#...#',
    '#...#',
    '#...#',
    '#...#',
    '####.',
  ],
  E: [
    '#####',
    '#....',
    '#....',
    '#....',
    '####.',
    '#....',
    '#....',
    '#....',
    '#####',
  ],
  F: [
    '#####',
    '#....',
    '#....',
    '#....',
    '####.',
    '#....',
    '#....',
    '#....',
    '#....',
  ],
  G: [
    '.###.',
    '#...#',
    '#....',
    '#....',
    '#..##',
    '#...#',
    '#...#',
    '#...#',
    '.####',
  ],
  H: [
    '#...#',
    '#...#',
    '#...#',
    '#...#',
    '#####',
    '#...#',
    '#...#',
    '#...#',
    '#...#',
  ],
  I: [
    '.###.',
    '..#..',
    '..#..',
    '..#..',
    '..#..',
    '..#..',
    '..#..',
    '..#..',
    '.###.',
  ],
  J: [
    '..###',
    '...#.',
    '...#.',
    '...#.',
    '...#.',
    '...#.',
    '#..#.',
    '#..#.',
    '.##..',
  ],
  K: [
    '#...#',
    '#..#.',
    '#.#..',
    '##...',
    '##...',
    '#.#..',
    '#..#.',
    '#...#',
    '#...#',
  ],
  L: [
    '#....',
    '#....',
    '#....',
    '#....',
    '#....',
    '#....',
    '#....',
    '#....',
    '#####',
  ],
  M: [
    '#...#',
    '##.##',
    '##.##',
    '#.#.#',
    '#.#.#',
    '#...#',
    '#...#',
    '#...#',
    '#...#',
  ],
  N: [
    '#...#',
    '##..#',
    '##..#',
    '#.#.#',
    '#.#.#',
    '#..##',
    '#..##',
    '#...#',
    '#...#',
  ],
  O: [
    '.###.',
    '#...#',
    '#...#',
    '#...#',
    '#...#',
    '#...#',
    '#...#',
    '#...#',
    '.###.',
  ],
  P: [
    '####.',
    '#...#',
    '#...#',
    '#...#',
    '####.',
    '#....',
    '#....',
    '#....',
    '#....',
  ],
  Q: [
    '.###.',
    '#...#',
    '#...#',
    '#...#',
    '#...#',
    '#...#',
    '#.#.#',
    '#..#.',
    '.##.#',
  ],
  R: [
    '####.',
    '#...#',
    '#...#',
    '#...#',
    '####.',
    '#.#..',
    '#..#.',
    '#...#',
    '#...#',
  ],
  S: [
    '.###.',
    '#...#',
    '#....',
    '.#...',
    '..#..',
    '...#.',
    '....#',
    '#...#',
    '.###.',
  ],
  T: [
    '#####',
    '..#..',
    '..#..',
    '..#..',
    '..#..',
    '..#..',
    '..#..',
    '..#..',
    '..#..',
  ],
  U: [
    '#...#',
    '#...#',
    '#...#',
    '#...#',
    '#...#',
    '#...#',
    '#...#',
    '#...#',
    '.###.',
  ],
  V: [
    '#...#',
    '#...#',
    '#...#',
    '#...#',
    '#...#',
    '.#.#.',
    '.#.#.',
    '..#..',
    '..#..',
  ],
  W: [
    '#...#',
    '#...#',
    '#...#',
    '#...#',
    '#.#.#',
    '#.#.#',
    '##.##',
    '##.##',
    '#...#',
  ],
  X: [
    '#...#',
    '#...#',
    '.#.#.',
    '..#..',
    '..#..',
    '.#.#.',
    '.#.#.',
    '#...#',
    '#...#',
  ],
  Y: [
    '#...#',
    '#...#',
    '.#.#.',
    '.#.#.',
    '..#..',
    '..#..',
    '..#..',
    '..#..',
    '..#..',
  ],
  Z: [
    '#####',
    '....#',
    '...#.',
    '...#.',
    '..#..',
    '.#...',
    '.#...',
    '#....',
    '#####',
  ],

  // Lowercase a–z (with true descenders on g, j, p, q, y into rows 9..10)
  a: [
    '.....',
    '.....',
    '.....',
    '.###.',
    '....#',
    '.####',
    '#...#',
    '#...#',
    '.####',
  ],
  b: [
    '#....',
    '#....',
    '#....',
    '####.',
    '#...#',
    '#...#',
    '#...#',
    '#...#',
    '####.',
  ],
  c: [
    '.....',
    '.....',
    '.....',
    '.###.',
    '#...#',
    '#....',
    '#....',
    '#...#',
    '.###.',
  ],
  d: [
    '....#',
    '....#',
    '....#',
    '.####',
    '#...#',
    '#...#',
    '#...#',
    '#...#',
    '.####',
  ],
  e: [
    '.....',
    '.....',
    '.....',
    '.###.',
    '#...#',
    '#####',
    '#....',
    '#...#',
    '.###.',
  ],
  f: [
    '..##.',
    '.#..#',
    '.#...',
    '####.',
    '.#...',
    '.#...',
    '.#...',
    '.#...',
    '.#...',
  ],
  g: [
    '.....',
    '.....',
    '.....',
    '.####',
    '#...#',
    '#...#',
    '#...#',
    '.####',
    '....#',
    '#...#',
    '.###.',
  ],
  h: [
    '#....',
    '#....',
    '#....',
    '####.',
    '#...#',
    '#...#',
    '#...#',
    '#...#',
    '#...#',
  ],
  i: [
    '.....',
    '..#..',
    '.....',
    '.##..',
    '..#..',
    '..#..',
    '..#..',
    '..#..',
    '.###.',
  ],
  j: [
    '.....',
    '...#.',
    '.....',
    '..##.',
    '...#.',
    '...#.',
    '...#.',
    '...#.',
    '...#.',
    '#..#.',
    '.##..',
  ],
  k: [
    '#....',
    '#....',
    '#....',
    '#..#.',
    '#.#..',
    '##...',
    '#.#..',
    '#..#.',
    '#...#',
  ],
  l: [
    '.##..',
    '..#..',
    '..#..',
    '..#..',
    '..#..',
    '..#..',
    '..#..',
    '..#..',
    '.###.',
  ],
  m: [
    '.....',
    '.....',
    '.....',
    '##.#.',
    '#.#.#',
    '#.#.#',
    '#.#.#',
    '#.#.#',
    '#...#',
  ],
  n: [
    '.....',
    '.....',
    '.....',
    '####.',
    '#...#',
    '#...#',
    '#...#',
    '#...#',
    '#...#',
  ],
  o: [
    '.....',
    '.....',
    '.....',
    '.###.',
    '#...#',
    '#...#',
    '#...#',
    '#...#',
    '.###.',
  ],
  p: [
    '.....',
    '.....',
    '.....',
    '####.',
    '#...#',
    '#...#',
    '#...#',
    '####.',
    '#....',
    '#....',
    '#....',
  ],
  q: [
    '.....',
    '.....',
    '.....',
    '.####',
    '#...#',
    '#...#',
    '#...#',
    '.####',
    '....#',
    '....#',
    '....#',
  ],
  r: [
    '.....',
    '.....',
    '.....',
    '#.##.',
    '##..#',
    '#....',
    '#....',
    '#....',
    '#....',
  ],
  s: [
    '.....',
    '.....',
    '.....',
    '.####',
    '#....',
    '.###.',
    '....#',
    '....#',
    '####.',
  ],
  t: [
    '.#...',
    '.#...',
    '.#...',
    '####.',
    '.#...',
    '.#...',
    '.#...',
    '.#..#',
    '..##.',
  ],
  u: [
    '.....',
    '.....',
    '.....',
    '#...#',
    '#...#',
    '#...#',
    '#...#',
    '#...#',
    '.####',
  ],
  v: [
    '.....',
    '.....',
    '.....',
    '#...#',
    '#...#',
    '#...#',
    '.#.#.',
    '.#.#.',
    '..#..',
  ],
  w: [
    '.....',
    '.....',
    '.....',
    '#...#',
    '#...#',
    '#.#.#',
    '#.#.#',
    '##.##',
    '#...#',
  ],
  x: [
    '.....',
    '.....',
    '.....',
    '#...#',
    '.#.#.',
    '..#..',
    '..#..',
    '.#.#.',
    '#...#',
  ],
  y: [
    '.....',
    '.....',
    '.....',
    '#...#',
    '#...#',
    '#...#',
    '#...#',
    '.####',
    '....#',
    '#...#',
    '.###.',
  ],
  z: [
    '.....',
    '.....',
    '.....',
    '#####',
    '...#.',
    '..#..',
    '.#...',
    '#....',
    '#####',
  ],

  // Operators & Punctuation (verified against reference photo!)
  '+': [
    '.....',
    '.....',
    '..#..',
    '..#..',
    '#####',
    '..#..',
    '..#..',
    '.....',
    '.....',
  ],
  '-': [
    '.....',
    '.....',
    '.....',
    '.....',
    '.###.',
    '.....',
    '.....',
    '.....',
    '.....',
  ],
  '−': [
    '.....',
    '.....',
    '.....',
    '.....',
    '.###.',
    '.....',
    '.....',
    '.....',
    '.....',
  ],
  '×': [
    '.....',
    '.....',
    '#...#',
    '.#.#.',
    '..#..',
    '.#.#.',
    '#...#',
    '.....',
    '.....',
  ],
  '*': [
    '.....',
    '.....',
    '#.#.#',
    '.###.',
    '#####',
    '.###.',
    '#.#.#',
    '.....',
    '.....',
  ],
  '÷': [
    '.....',
    '..#..',
    '.....',
    '.....',
    '#####',
    '.....',
    '.....',
    '..#..',
    '.....',
  ],
  '/': [
    '....#',
    '....#',
    '...#.',
    '...#.',
    '..#..',
    '.#...',
    '.#...',
    '#....',
    '#....',
  ],
  '=': [
    '.....',
    '.....',
    '.....',
    '#####',
    '.....',
    '#####',
    '.....',
    '.....',
    '.....',
  ],
  '≠': [
    '....#',
    '...#.',
    '#####',
    '..#..',
    '#####',
    '.#...',
    '#....',
    '.....',
    '.....',
  ],
  '<': {
    adv: 5,
    rows: [
      '....',
      '...#',
      '..#.',
      '.#..',
      '#...',
      '.#..',
      '..#.',
      '...#',
      '....',
    ],
  },
  '>': {
    adv: 5,
    rows: [
      '....',
      '#...',
      '.#..',
      '..#.',
      '...#',
      '..#.',
      '.#..',
      '#...',
      '....',
    ],
  },
  '≤': [
    '...#.',
    '..#..',
    '.#...',
    '#....',
    '.#...',
    '..#..',
    '...#.',
    '.....',
    '#####',
  ],
  '≥': [
    '.#...',
    '..#..',
    '...#.',
    '....#',
    '...#.',
    '..#..',
    '.#...',
    '.....',
    '#####',
  ],
  '(': {
    adv: 4,
    rows: [
      '..#',
      '.#.',
      '#..',
      '#..',
      '#..',
      '#..',
      '#..',
      '.#.',
      '..#',
    ],
  },
  ')': {
    adv: 4,
    rows: [
      '#..',
      '.#.',
      '..#',
      '..#',
      '..#',
      '..#',
      '..#',
      '.#.',
      '#..',
    ],
  },
  '[': {
    adv: 4,
    rows: [
      '###',
      '#..',
      '#..',
      '#..',
      '#..',
      '#..',
      '#..',
      '#..',
      '###',
    ],
  },
  ']': {
    adv: 4,
    rows: [
      '###',
      '..#',
      '..#',
      '..#',
      '..#',
      '..#',
      '..#',
      '..#',
      '###',
    ],
  },
  '|': {
    adv: 3,
    rows: [
      '.#',
      '.#',
      '.#',
      '.#',
      '.#',
      '.#',
      '.#',
      '.#',
      '.#',
    ],
  },
  '.': {
    adv: 4,
    rows: [
      '...',
      '...',
      '...',
      '...',
      '...',
      '...',
      '...',
      '.##',
      '.##',
    ],
  },
  ',': {
    adv: 5,
    rows: [
      '....',
      '....',
      '....',
      '....',
      '....',
      '....',
      '.##.',
      '.##.',
      '..#.',
      '.#..',
    ],
  },
  ':': {
    adv: 4,
    rows: [
      '...',
      '...',
      '.##',
      '.##',
      '...',
      '...',
      '.##',
      '.##',
      '...',
    ],
  },
  ';': {
    adv: 4,
    rows: [
      '...',
      '...',
      '.##',
      '.##',
      '...',
      '...',
      '.##',
      '.##',
      '..#',
      '.#.',
    ],
  },
  '?': [
    '.###.',
    '#...#',
    '....#',
    '...#.',
    '..#..',
    '..#..',
    '.....',
    '..#..',
    '..#..',
  ],
  '!': {
    adv: 4,
    rows: [
      '.#.',
      '.#.',
      '.#.',
      '.#.',
      '.#.',
      '.#.',
      '...',
      '.#.',
      '.#.',
    ],
  },
  '%': [
    '##..#',
    '##..#',
    '...#.',
    '..#..',
    '..#..',
    '.#...',
    '#..##',
    '#..##',
    '.....',
  ],
  '#': [
    '.#.#.',
    '.#.#.',
    '#####',
    '.#.#.',
    '.#.#.',
    '#####',
    '.#.#.',
    '.#.#.',
    '.....',
  ],
  '_': [
    '.....',
    '.....',
    '.....',
    '.....',
    '.....',
    '.....',
    '.....',
    '.....',
    '#####',
  ],
  '—': [
    '.....',
    '.....',
    '.....',
    '.....',
    '#####',
    '.....',
    '.....',
    '.....',
    '.....',
  ],
  '~': [
    '.....',
    '.....',
    '.....',
    '.#...',
    '#.#.#',
    '...#.',
    '.....',
    '.....',
    '.....',
  ],
  '^': [
    '..#..',
    '.#.#.',
    '#...#',
    '.....',
    '.....',
    '.....',
    '.....',
    '.....',
    '.....',
  ],

  // Exact dot-matrix π glyph (`-1/2 π`)
  'π': {
    adv: 7,
    rows: [
      '......',
      '......',
      '.#####',
      '#.#.#.',
      '..#.#.',
      '..#.#.',
      '..#.#.',
      '..#.#.',
      '..#.##',
    ],
  },

  // Sexagesimal ° ’ ” & primes
  '°': {
    adv: 5,
    rows: [
      '.##.',
      '#..#',
      '#..#',
      '.##.',
      '....',
      '....',
      '....',
      '....',
      '....',
    ],
  },
  '’': {
    adv: 4,
    rows: [
      '.##',
      '.##',
      '..#',
      '.#.',
      '...',
      '...',
      '...',
      '...',
      '...',
    ],
  },
  '\'': {
    adv: 4,
    rows: [
      '.#.',
      '.#.',
      '.#.',
      '...',
      '...',
      '...',
      '...',
      '...',
      '...',
    ],
  },
  '”': {
    adv: 6,
    rows: [
      '##.##',
      '##.##',
      '.#..#',
      '#..#.',
      '.....',
      '.....',
      '.....',
      '.....',
      '.....',
    ],
  },
  '"': {
    adv: 5,
    rows: [
      '#.#.',
      '#.#.',
      '#.#.',
      '....',
      '....',
      '....',
      '....',
      '....',
      '....',
    ],
  },

  // Phasor ∠, Line fraction ⌟, Arrows & scientific symbols
  '∠': [
    '....#',
    '...#.',
    '...#.',
    '..#..',
    '..#..',
    '.#...',
    '.#...',
    '#....',
    '#####',
  ],
  '⌟': [
    '....#',
    '....#',
    '....#',
    '....#',
    '....#',
    '....#',
    '....#',
    '....#',
    '#####',
  ],
  '▸': {
    adv: 5,
    rows: [
      '....',
      '#...',
      '##..',
      '###.',
      '####',
      '###.',
      '##..',
      '#...',
      '....',
    ],
  },
  '→': [
    '.....',
    '.....',
    '..#..',
    '...#.',
    '#####',
    '...#.',
    '..#..',
    '.....',
    '.....',
  ],
  '←': [
    '.....',
    '.....',
    '..#..',
    '.#...',
    '#####',
    '.#...',
    '..#..',
    '.....',
    '.....',
  ],
  '⇔': {
    adv: 7,
    rows: [
      '......',
      '..#.#.',
      '.#...#',
      '######',
      '......',
      '######',
      '.#...#',
      '..#.#.',
      '......',
    ],
  },
  '▲': [
    '.....',
    '..#..',
    '..#..',
    '.###.',
    '.###.',
    '#####',
    '#####',
    '.....',
    '.....',
  ],
  '▼': [
    '.....',
    '.....',
    '#####',
    '#####',
    '.###.',
    '.###.',
    '..#..',
    '..#..',
    '.....',
  ],
  '◀': [
    '....#',
    '...##',
    '..###',
    '.####',
    '#####',
    '.####',
    '..###',
    '...##',
    '....#',
  ],
  '▶': [
    '#....',
    '##...',
    '###..',
    '####.',
    '#####',
    '####.',
    '###..',
    '##...',
    '#....',
  ],

  // Big operators ∫, ∑, ∏
  '∫': {
    adv: 6,
    rows: [
      '...##',
      '..#..',
      '..#..',
      '..#..',
      '..#..',
      '..#..',
      '..#..',
      '..#..',
      '..#..',
      '..#..',
      '##...',
    ],
  },
  '∑': {
    adv: 6,
    rows: [
      '#####',
      '#...#',
      '.#...',
      '..#..',
      '...#.',
      '..#..',
      '.#...',
      '#...#',
      '#####',
    ],
  },
  '∏': {
    adv: 6,
    rows: [
      '#####',
      '.#.#.',
      '.#.#.',
      '.#.#.',
      '.#.#.',
      '.#.#.',
      '.#.#.',
      '.#.#.',
      '#...#',
    ],
  },

  // Superscript characters (⁻, ¹, ², ³, ᵈ, ʳ, ᵍ, ₀, ₁, ₂)
  '⁻': {
    adv: 4,
    rows: [
      '...',
      '...',
      '###',
      '...',
      '...',
      '...',
      '...',
      '...',
      '...',
    ],
  },
  '¹': {
    adv: 4,
    rows: [
      '.#.',
      '##.',
      '.#.',
      '.#.',
      '###',
      '...',
      '...',
      '...',
      '...',
    ],
  },
  '²': {
    adv: 5,
    rows: [
      '.##.',
      '#..#',
      '..#.',
      '.#..',
      '####',
      '....',
      '....',
      '....',
      '....',
    ],
  },
  '³': {
    adv: 5,
    rows: [
      '###.',
      '...#',
      '.##.',
      '...#',
      '###.',
      '....',
      '....',
      '....',
      '....',
    ],
  },
  'ᵈ': {
    adv: 5,
    rows: [
      '...#',
      '.###',
      '#..#',
      '#..#',
      '.###',
      '....',
      '....',
      '....',
      '....',
    ],
  },
  'ʳ': {
    adv: 5,
    rows: [
      '....',
      '#.##',
      '##..',
      '#...',
      '#...',
      '....',
      '....',
      '....',
      '....',
    ],
  },
  'ᵍ': {
    adv: 5,
    rows: [
      '.###',
      '#..#',
      '.###',
      '...#',
      '.##.',
      '....',
      '....',
      '....',
      '....',
    ],
  },
  '₀': {
    adv: 5,
    rows: [
      '....',
      '....',
      '....',
      '....',
      '.##.',
      '#..#',
      '#..#',
      '#..#',
      '.##.',
    ],
  },
  '₁': {
    adv: 4,
    rows: [
      '...',
      '...',
      '...',
      '...',
      '.#.',
      '##.',
      '.#.',
      '.#.',
      '###',
    ],
  },
  '₂': {
    adv: 5,
    rows: [
      '....',
      '....',
      '....',
      '....',
      '.##.',
      '#..#',
      '..#.',
      '.#..',
      '####',
    ],
  },
  '█': [
    '#####',
    '#####',
    '#####',
    '#####',
    '#####',
    '#####',
    '#####',
    '#####',
    '#####',
  ],
  '░': [
    '#.#.#',
    '.#.#.',
    '#.#.#',
    '.#.#.',
    '#.#.#',
    '.#.#.',
    '#.#.#',
    '.#.#.',
    '#.#.#',
  ],
};

// ============================================================================
// 2. CALCIOS SMALL FONT (5×6 fraction / exponent / subscript font)
//    Verified pixel-for-pixel against `1` and `2` in `-1/2 π` of user's photo!
// ============================================================================
const SMALL_GLYPHS = {
  ' ': { adv: 4, rows: [] },
  '0': [
    '.###.',
    '#...#',
    '#...#',
    '#...#',
    '#...#',
    '.###.',
  ],
  '1': [
    '..#..',
    '.##..',
    '..#..',
    '..#..',
    '..#..',
    '.###.',
  ],
  '2': [
    '.###.',
    '#...#',
    '....#',
    '..##.',
    '.#...',
    '#####',
  ],
  '3': [
    '####.',
    '....#',
    '.###.',
    '....#',
    '#...#',
    '.###.',
  ],
  '4': [
    '..##.',
    '.#.#.',
    '#..#.',
    '#####',
    '...#.',
    '...#.',
  ],
  '5': [
    '#####',
    '#....',
    '####.',
    '....#',
    '#...#',
    '.###.',
  ],
  '6': [
    '.###.',
    '#....',
    '####.',
    '#...#',
    '#...#',
    '.###.',
  ],
  '7': [
    '#####',
    '....#',
    '...#.',
    '..#..',
    '..#..',
    '..#..',
  ],
  '8': [
    '.###.',
    '#...#',
    '.###.',
    '#...#',
    '#...#',
    '.###.',
  ],
  '9': [
    '.###.',
    '#...#',
    '.####',
    '....#',
    '#...#',
    '.###.',
  ],
  '+': [
    '.....',
    '..#..',
    '#####',
    '..#..',
    '.....',
    '.....',
  ],
  '-': [
    '.....',
    '.....',
    '.###.',
    '.....',
    '.....',
    '.....',
  ],
  '−': [
    '.....',
    '.....',
    '.###.',
    '.....',
    '.....',
    '.....',
  ],
  '×': [
    '.....',
    '#...#',
    '.#.#.',
    '..#..',
    '.#.#.',
    '#...#',
  ],
  '÷': [
    '..#..',
    '.....',
    '#####',
    '.....',
    '..#..',
    '.....',
  ],
  '=': [
    '.....',
    '#####',
    '.....',
    '#####',
    '.....',
    '.....',
  ],
  '(': {
    adv: 4,
    rows: [
      '.#.',
      '#..',
      '#..',
      '#..',
      '#..',
      '.#.',
    ],
  },
  ')': {
    adv: 4,
    rows: [
      '.#.',
      '..#',
      '..#',
      '..#',
      '..#',
      '.#.',
    ],
  },
  '.': {
    adv: 3,
    rows: [
      '..',
      '..',
      '..',
      '..',
      '##',
      '##',
    ],
  },
  ',': {
    adv: 3,
    rows: [
      '..',
      '..',
      '..',
      '..',
      '##',
      '.#',
      '#.',
    ],
  },
  'π': [
    '#####',
    '.#.#.',
    '.#.#.',
    '.#.#.',
    '.#.#.',
    '.#..#',
  ],
  X: [
    '#...#',
    '.#.#.',
    '..#..',
    '..#..',
    '.#.#.',
    '#...#',
  ],
  Y: [
    '#...#',
    '.#.#.',
    '..#..',
    '..#..',
    '..#..',
    '..#..',
  ],
  A: [
    '.###.',
    '#...#',
    '#...#',
    '#####',
    '#...#',
    '#...#',
  ],
  B: [
    '####.',
    '#...#',
    '####.',
    '#...#',
    '#...#',
    '####.',
  ],
  C: [
    '.###.',
    '#...#',
    '#....',
    '#....',
    '#...#',
    '.###.',
  ],
  D: [
    '####.',
    '#...#',
    '#...#',
    '#...#',
    '#...#',
    '####.',
  ],
  E: [
    '#####',
    '#....',
    '####.',
    '#....',
    '#....',
    '#####',
  ],
  F: [
    '#####',
    '#....',
    '####.',
    '#....',
    '#....',
    '#....',
  ],
  H: [
    '#...#',
    '#...#',
    '#####',
    '#...#',
    '#...#',
    '#...#',
  ],
  O: [
    '.###.',
    '#...#',
    '#...#',
    '#...#',
    '#...#',
    '.###.',
  ],
  M: [
    '#...#',
    '##.##',
    '#.#.#',
    '#...#',
    '#...#',
    '#...#',
  ],
  c: [
    '.....',
    '.###.',
    '#....',
    '#....',
    '#....',
    '.###.',
  ],
  n: [
    '.....',
    '####.',
    '#...#',
    '#...#',
    '#...#',
    '#...#',
  ],
  t: [
    '.#...',
    '####.',
    '.#...',
    '.#...',
    '.#..#',
    '..##.',
  ],
  x: [
    '.....',
    '#...#',
    '.#.#.',
    '..#..',
    '.#.#.',
    '#...#',
  ],
  d: [
    '....#',
    '.####',
    '#...#',
    '#...#',
    '#...#',
    '.####',
  ],
  e: [
    '.....',
    '.###.',
    '#...#',
    '#####',
    '#....',
    '.###.',
  ],
  i: [
    '..#..',
    '.....',
    '.##..',
    '..#..',
    '..#..',
    '.###.',
  ],
};

// ============================================================================
// Binary TrueType (.ttf) Compiler
// ============================================================================
class Buf {
  constructor() {
    this.bytes = [];
  }
  u8(v) {
    this.bytes.push(v & 0xff);
  }
  i8(v) {
    this.u8(v < 0 ? v + 256 : v);
  }
  u16(v) {
    this.u8((v >>> 8) & 0xff);
    this.u8(v & 0xff);
  }
  i16(v) {
    this.u16(v < 0 ? v + 65536 : v);
  }
  u32(v) {
    this.u8((v >>> 24) & 0xff);
    this.u8((v >>> 16) & 0xff);
    this.u8((v >>> 8) & 0xff);
    this.u8(v & 0xff);
  }
  i64Zero() {
    this.u32(0);
    this.u32(0);
  }
  ascii(str) {
    for (let i = 0; i < str.length; i++) this.u8(str.charCodeAt(i));
  }
  utf16be(str) {
    for (let i = 0; i < str.length; i++) this.u16(str.charCodeAt(i));
  }
  pad4() {
    while (this.bytes.length % 4 !== 0) this.u8(0);
  }
  toBuffer() {
    return Buffer.from(this.bytes);
  }
}

function tableChecksum(buf) {
  let sum = 0;
  const paddedLen = Math.ceil(buf.length / 4) * 4;
  for (let i = 0; i < paddedLen; i += 4) {
    const b0 = buf[i] ?? 0;
    const b1 = buf[i + 1] ?? 0;
    const b2 = buf[i + 2] ?? 0;
    const b3 = buf[i + 3] ?? 0;
    const word = ((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) >>> 0;
    sum = (sum + word) >>> 0;
  }
  return sum;
}

function encodeGlyphOutline(rows, topRowIndex, dotPitch = 100, dotSize = 93) {
  const squares = [];
  for (let r = 0; r < rows.length; r++) {
    const line = rows[r];
    const y0 = (topRowIndex - r) * dotPitch;
    const y1 = y0 + dotSize;
    for (let c = 0; c < line.length; c++) {
      if (line[c] === '#') {
        const x0 = c * dotPitch;
        const x1 = x0 + dotSize;
        squares.push({ x0, y0, x1, y1 });
      }
    }
  }
  if (squares.length === 0) {
    return { data: Buffer.alloc(0), xMin: 0, yMin: 0, xMax: 0, yMax: 0, contours: 0, points: 0 };
  }

  let xMin = Infinity;
  let yMin = Infinity;
  let xMax = -Infinity;
  let yMax = -Infinity;
  for (const s of squares) {
    if (s.x0 < xMin) xMin = s.x0;
    if (s.y0 < yMin) yMin = s.y0;
    if (s.x1 > xMax) xMax = s.x1;
    if (s.y1 > yMax) yMax = s.y1;
  }

  const g = new Buf();
  g.i16(squares.length); // numberOfContours
  g.i16(xMin);
  g.i16(yMin);
  g.i16(xMax);
  g.i16(yMax);

  // endPtsOfContours (4 points per square)
  for (let i = 0; i < squares.length; i++) {
    g.u16(i * 4 + 3);
  }
  g.u16(0); // instructionLength = 0

  const pts = [];
  for (const s of squares) {
    // Clockwise outer contour in Y-up TrueType coordinates:
    // (x0, y0) -> (x0, y1) -> (x1, y1) -> (x1, y0)
    pts.push([s.x0, s.y0], [s.x0, s.y1], [s.x1, s.y1], [s.x1, s.y0]);
  }

  // flags: all on-curve (bit 0 = 1), 16-bit signed deltas (bits 1,2,4,5 = 0) => flag = 0x01
  for (let i = 0; i < pts.length; i++) {
    g.u8(0x01);
  }

  // xCoordinates (relative int16)
  let prevX = 0;
  for (const [x] of pts) {
    g.i16(x - prevX);
    prevX = x;
  }

  // yCoordinates (relative int16)
  let prevY = 0;
  for (const [, y] of pts) {
    g.i16(y - prevY);
    prevY = y;
  }

  g.pad4();
  return {
    data: g.toBuffer(),
    xMin,
    yMin,
    xMax,
    yMax,
    contours: squares.length,
    points: pts.length,
  };
}

function buildFont({ familyName, glyphMap, unitsPerEm, ascender, descender, topRowIndex }) {
  const entries = [];
  for (const [ch, spec] of Object.entries(glyphMap)) {
    const code = ch.codePointAt(0);
    if (code === undefined || code > 0xffff) continue;
    const rows = Array.isArray(spec) ? spec : spec.rows;
    const maxCols = rows.reduce((m, r) => Math.max(m, r.length), 5);
    const advDots = Array.isArray(spec) ? maxCols + 1 : spec.adv;
    entries.push({ code, rows, advanceWidth: advDots * 100 });
  }
  entries.sort((a, b) => a.code - b.code);

  // Glyph 0 = .notdef (hollow 5×7 box)
  const notdefOutline = encodeGlyphOutline(
    ['#####', '#...#', '#...#', '#...#', '#...#', '#...#', '#####'],
    topRowIndex,
  );
  const glyphs = [
    { code: -1, advanceWidth: 600, lsb: notdefOutline.xMin, outline: notdefOutline },
  ];

  for (const e of entries) {
    const outline = encodeGlyphOutline(e.rows, topRowIndex);
    glyphs.push({
      code: e.code,
      advanceWidth: e.advanceWidth,
      lsb: outline.contours > 0 ? outline.xMin : 0,
      outline,
    });
  }

  const numGlyphs = glyphs.length;
  let globalXMin = 0;
  let globalYMin = descender;
  let globalXMax = 600;
  let globalYMax = ascender;
  let maxPoints = 0;
  let maxContours = 0;
  let maxAdvance = 600;

  for (const gl of glyphs) {
    if (gl.advanceWidth > maxAdvance) maxAdvance = gl.advanceWidth;
    if (gl.outline.contours > 0) {
      globalXMin = Math.min(globalXMin, gl.outline.xMin);
      globalYMin = Math.min(globalYMin, gl.outline.yMin);
      globalXMax = Math.max(globalXMax, gl.outline.xMax);
      globalYMax = Math.max(globalYMax, gl.outline.yMax);
      maxPoints = Math.max(maxPoints, gl.outline.points);
      maxContours = Math.max(maxContours, gl.outline.contours);
    }
  }

  // glyf + loca (32-bit offsets)
  const loca = new Buf();
  const glyfParts = [];
  let offset = 0;
  for (const gl of glyphs) {
    loca.u32(offset);
    glyfParts.push(gl.outline.data);
    offset += gl.outline.data.length;
  }
  loca.u32(offset);
  const glyfBuf = Buffer.concat(glyfParts);

  // hmtx
  const hmtx = new Buf();
  for (const gl of glyphs) {
    hmtx.u16(gl.advanceWidth);
    hmtx.i16(gl.lsb);
  }

  // cmap (Format 4, platform 3 encoding 1 + platform 0 encoding 3)
  const segs = [];
  for (let i = 1; i < glyphs.length; i++) {
    const c = glyphs[i].code;
    const prev = segs[segs.length - 1];
    if (prev && prev.end + 1 === c && prev.endGlyph + 1 === i) {
      prev.end = c;
      prev.endGlyph = i;
    } else {
      segs.push({ start: c, end: c, startGlyph: i, endGlyph: i });
    }
  }
  segs.push({ start: 0xffff, end: 0xffff, startGlyph: 0, endGlyph: 0 });

  const segCount = segs.length;
  const segCountX2 = segCount * 2;
  const searchRange = 2 * Math.pow(2, Math.floor(Math.log2(segCount)));
  const entrySelector = Math.floor(Math.log2(segCount));
  const rangeShift = segCountX2 - searchRange;

  const fmt4 = new Buf();
  fmt4.u16(4); // format
  fmt4.u16(16 + segCount * 8); // length
  fmt4.u16(0); // language
  fmt4.u16(segCountX2);
  fmt4.u16(searchRange);
  fmt4.u16(entrySelector);
  fmt4.u16(rangeShift);
  for (const s of segs) fmt4.u16(s.end);
  fmt4.u16(0); // reservedPad
  for (const s of segs) fmt4.u16(s.start);
  for (const s of segs) {
    const delta = s.start === 0xffff ? 1 : (s.startGlyph - s.start) & 0xffff;
    fmt4.u16(delta);
  }
  for (let i = 0; i < segCount; i++) fmt4.u16(0);
  const fmt4Buf = fmt4.toBuffer();

  const cmap = new Buf();
  cmap.u16(0); // version
  cmap.u16(2); // numTables
  cmap.u16(0); cmap.u16(3); cmap.u32(20);
  cmap.u16(3); cmap.u16(1); cmap.u32(20);
  const cmapBuf = Buffer.concat([cmap.toBuffer(), fmt4Buf]);

  // head
  const head = new Buf();
  head.u32(0x00010000); // version 1.0
  head.u32(0x00010000); // fontRevision
  head.u32(0); // checkSumAdjustment (filled later)
  head.u32(0x5f0f3cf5); // magicNumber
  head.u16(0x000b); // flags
  head.u16(unitsPerEm);
  head.i64Zero(); // created
  head.i64Zero(); // modified
  head.i16(globalXMin);
  head.i16(globalYMin);
  head.i16(globalXMax);
  head.i16(globalYMax);
  head.u16(0); // macStyle Regular
  head.u16(8); // lowestRecPPEM
  head.i16(2); // fontDirectionHint
  head.i16(1); // indexToLocFormat = 1 (long 32-bit offsets)
  head.i16(0); // glyphDataFormat

  // hhea
  const hhea = new Buf();
  hhea.u32(0x00010000);
  hhea.i16(ascender);
  hhea.i16(descender);
  hhea.i16(0); // lineGap
  hhea.u16(maxAdvance);
  hhea.i16(0);
  hhea.i16(0);
  hhea.i16(globalXMax);
  hhea.i16(1);
  hhea.i16(0);
  hhea.i16(0);
  hhea.i16(0); hhea.i16(0); hhea.i16(0); hhea.i16(0);
  hhea.i16(0);
  hhea.u16(numGlyphs);

  // maxp
  const maxp = new Buf();
  maxp.u32(0x00010000);
  maxp.u16(numGlyphs);
  maxp.u16(maxPoints);
  maxp.u16(maxContours);
  maxp.u16(0); maxp.u16(0);
  maxp.u16(1); // maxZones
  maxp.u16(0); maxp.u16(0); maxp.u16(0); maxp.u16(0); maxp.u16(0); maxp.u16(0); maxp.u16(0); maxp.u16(0);

  // OS/2 (version 4)
  const os2 = new Buf();
  os2.u16(4);
  os2.i16(600); // xAvgCharWidth
  os2.u16(400); // usWeightClass Regular
  os2.u16(5); // usWidthClass Medium
  os2.u16(0); // fsType = installable
  os2.i16(Math.round(unitsPerEm * 0.6));
  os2.i16(Math.round(unitsPerEm * 0.6));
  os2.i16(0);
  os2.i16(Math.round(unitsPerEm * 0.15));
  os2.i16(Math.round(unitsPerEm * 0.6));
  os2.i16(Math.round(unitsPerEm * 0.6));
  os2.i16(0);
  os2.i16(Math.round(unitsPerEm * 0.4));
  os2.i16(50);
  os2.i16(Math.round(ascender * 0.45));
  os2.i16(0);
  for (let i = 0; i < 10; i++) os2.u8(0); // panose
  os2.u32(0x00000003); os2.u32(0); os2.u32(0); os2.u32(0);
  os2.ascii('CASI');
  os2.u16(0x0040); // fsSelection REGULAR
  os2.u16(entries[0]?.code ?? 32);
  os2.u16(entries[entries.length - 1]?.code ?? 122);
  os2.i16(ascender);
  os2.i16(descender);
  os2.i16(0);
  os2.u16(ascender);
  os2.u16(Math.abs(descender));
  os2.u32(1); os2.u32(0);
  os2.i16(Math.round(ascender * 0.66)); // sxHeight
  os2.i16(ascender); // sCapHeight
  os2.u16(0);
  os2.u16(32);
  os2.u16(1);

  // name
  const nameRecords = [
    [1, familyName],
    [2, 'Regular'],
    [3, `${familyName}-1.0`],
    [4, familyName],
    [5, 'Version 1.0'],
    [6, familyName.replace(/\s+/g, '')],
  ];
  const nameHeader = new Buf();
  const strPool = new Buf();
  nameHeader.u16(0);
  nameHeader.u16(nameRecords.length);
  nameHeader.u16(6 + nameRecords.length * 12);
  for (const [nameId, val] of nameRecords) {
    const startOff = strPool.bytes.length;
    strPool.utf16be(val);
    const len = strPool.bytes.length - startOff;
    nameHeader.u16(3); // Windows
    nameHeader.u16(1); // Unicode BMP
    nameHeader.u16(0x0409); // en-US
    nameHeader.u16(nameId);
    nameHeader.u16(len);
    nameHeader.u16(startOff);
  }
  const nameBuf = Buffer.concat([nameHeader.toBuffer(), strPool.toBuffer()]);

  // post (Format 3.0 — no glyph names needed)
  const post = new Buf();
  post.u32(0x00030000);
  post.u32(0); // italicAngle
  post.i16(-100);
  post.i16(50);
  post.u32(1); // isFixedPitch
  post.u32(0); post.u32(0); post.u32(0); post.u32(0);

  const tables = [
    ['OS/2', os2.toBuffer()],
    ['cmap', cmapBuf],
    ['glyf', glyfBuf],
    ['head', head.toBuffer()],
    ['hhea', hhea.toBuffer()],
    ['hmtx', hmtx.toBuffer()],
    ['loca', loca.toBuffer()],
    ['maxp', maxp.toBuffer()],
    ['name', nameBuf],
    ['post', post.toBuffer()],
  ];
  tables.sort((a, b) => (a[0] < b[0] ? -1 : 1));

  const numTables = tables.length;
  const sfntSearchRange = Math.pow(2, Math.floor(Math.log2(numTables))) * 16;
  const sfntEntrySelector = Math.floor(Math.log2(numTables));
  const sfntRangeShift = numTables * 16 - sfntSearchRange;

  const dir = new Buf();
  dir.u32(0x00010000);
  dir.u16(numTables);
  dir.u16(sfntSearchRange);
  dir.u16(sfntEntrySelector);
  dir.u16(sfntRangeShift);

  let dataOffset = 12 + numTables * 16;
  let headTableOffset = 0;
  const bodyChunks = [];

  for (const [tag, raw] of tables) {
    const csum = tableChecksum(raw);
    dir.ascii(tag);
    dir.u32(csum);
    dir.u32(dataOffset);
    dir.u32(raw.length);
    if (tag === 'head') headTableOffset = dataOffset;

    const padLen = (4 - (raw.length % 4)) % 4;
    const padded = padLen > 0 ? Buffer.concat([raw, Buffer.alloc(padLen)]) : raw;
    bodyChunks.push(padded);
    dataOffset += padded.length;
  }

  const full = Buffer.concat([dir.toBuffer(), ...bodyChunks]);
  const totalSum = tableChecksum(full);
  const checkSumAdj = (0xb1b0afba - totalSum) >>> 0;
  full.writeUInt32BE(checkSumAdj, headTableOffset + 8);
  return full;
}

// Fill any missing uppercase/lowercase in SMALL_GLYPHS from scaled LARGE_GLYPHS fallback
for (const [ch, spec] of Object.entries(LARGE_GLYPHS)) {
  if (!(ch in SMALL_GLYPHS)) {
    const rows = Array.isArray(spec) ? spec : spec.rows;
    if (rows.length <= 6) {
      SMALL_GLYPHS[ch] = spec;
    } else {
      // Sample 6 clean rows from 9-row glyph
      const idxs = [0, 1, 3, 5, 7, 8];
      SMALL_GLYPHS[ch] = idxs.map((idx) => rows[Math.min(idx, rows.length - 1)]);
    }
  }
}

const outDir = path.resolve('src/assets');
fs.mkdirSync(outDir, { recursive: true });

const largeBuf = buildFont({
  familyName: 'CalciosLCDLarge',
  glyphMap: LARGE_GLYPHS,
  unitsPerEm: 1100,
  ascender: 900,
  descender: -200,
  topRowIndex: 8,
});
fs.writeFileSync(path.join(outDir, 'calcios-lcd-large.ttf'), largeBuf);

const smallBuf = buildFont({
  familyName: 'CalciosLCDSmall',
  glyphMap: SMALL_GLYPHS,
  unitsPerEm: 700,
  ascender: 600,
  descender: -100,
  topRowIndex: 5,
});
fs.writeFileSync(path.join(outDir, 'calcios-lcd-small.ttf'), smallBuf);

console.log(`Generated calcios-lcd-large.ttf (${largeBuf.length} B) and calcios-lcd-small.ttf (${smallBuf.length} B)`);

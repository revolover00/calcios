export interface KeySpec {
  id: string;
  ariaLabel: string;
  primary: string;
  shiftLabel?: string;
  alphaLabel?: string;
  baseNLabel?: string;
  cmplxLeftLabel?: string;
  cmplxRightLabel?: string;
  modeTag?: boolean;
  col?: number;
  variant: 'sci' | 'num' | 'op' | 'accent';
}

export const SCIENTIFIC_ROW_1: readonly KeySpec[] = [
  {
    id: 'calc',
    ariaLabel: 'CALC evaluate expression, SOLVE equation, or equals =',
    primary: 'CALC',
    shiftLabel: 'SOLVE',
    alphaLabel: '=',
    col: 1,
    variant: 'sci',
  },
  {
    id: 'integ',
    ariaLabel: 'Definite integral ∫dx, derivative d/dx, or colon :',
    primary: '∫dx',
    shiftLabel: 'd/dx',
    alphaLabel: ':',
    col: 2,
    variant: 'sci',
  },
  {
    id: 'inverse',
    ariaLabel: 'Reciprocal x⁻¹ or factorial x!',
    primary: 'x⁻¹',
    shiftLabel: 'x!',
    col: 5,
    variant: 'sci',
  },
  {
    id: 'logbase',
    ariaLabel: 'Logarithm base a, summation ∑, or product ∏',
    primary: 'log■□',
    shiftLabel: '∑(',
    alphaLabel: '∏(',
    col: 6,
    variant: 'sci',
  },
];

export const SCIENTIFIC_ROWS_2_TO_4: readonly (readonly KeySpec[])[] = [
  [
    {
      id: 'frac',
      ariaLabel: 'Fraction, mixed fraction, or quotient with remainder ÷R',
      primary: '■/□',
      shiftLabel: '■ □/□',
      alphaLabel: '÷R',
      variant: 'sci',
    },
    {
      id: 'sqrt',
      ariaLabel: 'Square root, cube root, or recurring decimal',
      primary: '√■',
      shiftLabel: '³√■',
      alphaLabel: '■̅',
      variant: 'sci',
    },
    {
      id: 'square',
      ariaLabel: 'Square x², cube x³, or decimal DEC',
      primary: 'x²',
      shiftLabel: 'x³',
      baseNLabel: 'DEC',
      variant: 'sci',
    },
    {
      id: 'power',
      ariaLabel: 'Power xⁿ, nth root, or hexadecimal HEX',
      primary: 'x■',
      shiftLabel: 'ⁿ√■',
      baseNLabel: 'HEX',
      variant: 'sci',
    },
    {
      id: 'log',
      ariaLabel: 'Common logarithm log, 10^x, or binary BIN',
      primary: 'log',
      shiftLabel: '10■',
      baseNLabel: 'BIN',
      variant: 'sci',
    },
    {
      id: 'ln',
      ariaLabel: 'Natural logarithm ln, e^x, or octal OCT',
      primary: 'ln',
      shiftLabel: 'e■',
      baseNLabel: 'OCT',
      variant: 'sci',
    },
  ],
  [
    {
      id: 'neg',
      ariaLabel: 'Negative (−), polar angle ∠, or variable A',
      primary: '(−)',
      cmplxLeftLabel: '∠',
      alphaLabel: 'A',
      variant: 'sci',
    },
    {
      id: 'dms',
      ariaLabel: 'Degrees-minutes-seconds, prime factorization FACT, or variable B',
      primary: '° ’ ”',
      shiftLabel: 'FACT',
      alphaLabel: 'B',
      variant: 'sci',
    },
    {
      id: 'hyp',
      ariaLabel: 'Hyperbolic hyp, absolute value Abs, or variable C',
      primary: 'hyp',
      shiftLabel: 'Abs',
      alphaLabel: 'C',
      variant: 'sci',
    },
    {
      id: 'sin',
      ariaLabel: 'Sine sin, arcsin sin⁻¹, or variable D',
      primary: 'sin',
      shiftLabel: 'sin⁻¹',
      alphaLabel: 'D',
      variant: 'sci',
    },
    {
      id: 'cos',
      ariaLabel: 'Cosine cos, arccos cos⁻¹, or variable E',
      primary: 'cos',
      shiftLabel: 'cos⁻¹',
      alphaLabel: 'E',
      variant: 'sci',
    },
    {
      id: 'tan',
      ariaLabel: 'Tangent tan, arctan tan⁻¹, or variable F',
      primary: 'tan',
      shiftLabel: 'tan⁻¹',
      alphaLabel: 'F',
      variant: 'sci',
    },
  ],
  [
    {
      id: 'rcl',
      ariaLabel: 'RCL recall variable or STO store variable',
      primary: 'RCL',
      shiftLabel: 'STO',
      variant: 'sci',
    },
    {
      id: 'eng',
      ariaLabel: 'ENG engineering notation, ←, or imaginary unit i',
      primary: 'ENG',
      shiftLabel: '←',
      cmplxRightLabel: 'i',
      variant: 'sci',
    },
    {
      id: 'open',
      ariaLabel: 'Open parenthesis ( or percent %',
      primary: '(',
      shiftLabel: '%',
      variant: 'sci',
    },
    {
      id: 'close',
      ariaLabel: 'Close parenthesis ), comma ,, or variable X',
      primary: ')',
      shiftLabel: ',',
      alphaLabel: 'X',
      variant: 'sci',
    },
    {
      id: 'sd',
      ariaLabel: 'S⇔D standard-to-decimal toggle, mixed fraction toggle, or variable Y',
      primary: 'S⇔D',
      shiftLabel: 'a b/c⇔d/c',
      alphaLabel: 'Y',
      variant: 'sci',
    },
    {
      id: 'mplus',
      ariaLabel: 'M+ memory add, M− memory subtract, or variable M',
      primary: 'M+',
      shiftLabel: 'M−',
      alphaLabel: 'M',
      variant: 'sci',
    },
  ],
];

export const LOWER_KEYPAD_ROWS: readonly (readonly KeySpec[])[] = [
  [
    { id: '7', ariaLabel: '7 or scientific constants CONST', primary: '7', shiftLabel: 'CONST', variant: 'num' },
    { id: '8', ariaLabel: '8 or unit conversions CONV', primary: '8', shiftLabel: 'CONV', variant: 'num' },
    { id: '9', ariaLabel: '9 or clear CLR', primary: '9', shiftLabel: 'CLR', variant: 'num' },
    { id: 'del', ariaLabel: 'DEL delete or INS insert mode', primary: 'DEL', shiftLabel: 'INS', variant: 'accent' },
    { id: 'ac', ariaLabel: 'AC all clear or OFF power off', primary: 'AC', shiftLabel: 'OFF', variant: 'accent' },
  ],
  [
    { id: '4', ariaLabel: '4 or MATRIX menu', primary: '4', shiftLabel: 'MATRIX', modeTag: true, variant: 'num' },
    { id: '5', ariaLabel: '5 or VECTOR menu', primary: '5', shiftLabel: 'VECTOR', modeTag: true, variant: 'num' },
    { id: '6', ariaLabel: '6 or VERIFY menu', primary: '6', shiftLabel: 'VERIFY', modeTag: true, variant: 'num' },
    { id: 'multiply', ariaLabel: 'Multiply ×, permutation nPr, or GCD', primary: '×', shiftLabel: 'nPr', alphaLabel: 'GCD', variant: 'op' },
    { id: 'divide', ariaLabel: 'Divide ÷, combination nCr, or LCM', primary: '÷', shiftLabel: 'nCr', alphaLabel: 'LCM', variant: 'op' },
  ],
  [
    { id: '1', ariaLabel: '1 or STAT/DIST menu', primary: '1', shiftLabel: 'STAT/DIST', modeTag: true, variant: 'num' },
    { id: '2', ariaLabel: '2 or CMPLX menu', primary: '2', shiftLabel: 'CMPLX', modeTag: true, variant: 'num' },
    { id: '3', ariaLabel: '3 or BASE menu', primary: '3', shiftLabel: 'BASE', modeTag: true, variant: 'num' },
    { id: 'add', ariaLabel: 'Add +, polar Pol, or integer part Int', primary: '+', shiftLabel: 'Pol', alphaLabel: 'Int', variant: 'op' },
    { id: 'subtract', ariaLabel: 'Subtract −, rectangular Rec, or floor Intg', primary: '−', shiftLabel: 'Rec', alphaLabel: 'Intg', variant: 'op' },
  ],
  [
    { id: '0', ariaLabel: '0 or round Rnd', primary: '0', shiftLabel: 'Rnd', variant: 'num' },
    { id: 'dot', ariaLabel: 'Decimal point ·, random Ran#, or RanInt', primary: '·', shiftLabel: 'Ran#', alphaLabel: 'RanInt', variant: 'num' },
    { id: 'exp', ariaLabel: '×10^x scientific exponent, π, or Euler e', primary: '×10ˣ', shiftLabel: 'π', alphaLabel: 'e', variant: 'op' },
    { id: 'ans', ariaLabel: 'Ans last answer, DRG▶ angle unit, or PreAns', primary: 'Ans', shiftLabel: 'DRG▶', alphaLabel: 'PreAns', variant: 'op' },
    { id: 'equals', ariaLabel: 'Equals =, approximate ≈, or Re⇔Im', primary: '=', shiftLabel: '≈', cmplxRightLabel: 'Re⇔Im', variant: 'op' },
  ],
];

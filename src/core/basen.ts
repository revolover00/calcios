import { mathError, syntax } from './errors';
import { completeParentheses } from './expression';
import { VARIABLES, deserialize, type Scalar, type StoredScalar, type VariableName } from './value';

export type BaseMode = 'DEC' | 'HEX' | 'BIN' | 'OCT';

type BaseToken =
  | { type: 'literal'; text: string; raw: bigint; litBase: BaseMode; offset: number }
  | { type: 'var'; name: VariableName; offset: number }
  | { type: 'ans'; offset: number }
  | { type: 'unary'; op: 'Not' | 'Neg'; offset: number }
  | { type: 'binary'; op: '+' | '-' | '×' | '÷' | 'and' | 'or' | 'xor' | 'xnor'; offset: number }
  | { type: 'open'; offset: number }
  | { type: 'close'; offset: number }
  | { type: 'end'; offset: number };

const INT32_MIN = -2147483648n;
const INT32_MAX = 2147483647n;
const BASE_VAR_SET = new Set<string>(VARIABLES);

export function toInt32(n: bigint): bigint {
  return BigInt.asIntN(32, n);
}

export function scalarToBaseNInt32(s: Scalar): bigint {
  const trunc = s.decimal.trunc();
  if (!trunc.isFinite() || trunc.lt(INT32_MIN.toString()) || trunc.gt(INT32_MAX.toString())) {
    mathError('Variable out of 32-bit BASE-N range');
  }
  return BigInt(trunc.toFixed(0));
}

function parseRawBaseLiteral(text: string, base: BaseMode, offset = 0): bigint {
  if (base === 'DEC') {
    if (!/^\d+$/.test(text)) syntax('Invalid decimal literal in BASE-N', offset);
    if (text.length > 10 && BigInt(text) > 2147483648n) mathError('DEC literal out of 32-bit range');
    const val = BigInt(text);
    if (val > 2147483648n) mathError('DEC literal out of 32-bit range');
    return val;
  }
  if (base === 'HEX') {
    if (!/^[0-9A-F]+$/.test(text)) syntax('Invalid HEX literal', offset);
    if (text.length > 8) mathError('HEX literal out of 32-bit range');
    return toInt32(BigInt(`0x${text}`));
  }
  if (base === 'BIN') {
    if (!/^[01]+$/.test(text)) syntax('Invalid BIN literal', offset);
    if (text.length > 32) mathError('BIN literal out of 32-bit range');
    return toInt32(BigInt(`0b${text}`));
  }
  // OCT
  if (!/^[0-7]+$/.test(text)) syntax('Invalid OCT literal', offset);
  if (text.length > 11) mathError('OCT literal out of 32-bit range');
  const raw = BigInt(`0o${text}`);
  if (raw > 0xffffffffn) mathError('OCT literal out of 32-bit range');
  return toInt32(raw);
}

function materializeLiteral(raw: bigint, litBase: BaseMode): bigint {
  if (litBase === 'DEC') {
    if (raw < INT32_MIN || raw > INT32_MAX) mathError('BASE-N overflow');
    return raw;
  }
  return toInt32(raw);
}

export function formatBaseN(value: bigint, base: BaseMode): string {
  const v = toInt32(value);
  if (base === 'DEC') return v.toString(10);
  const unsigned = BigInt.asUintN(32, v);
  if (base === 'HEX') return unsigned.toString(16).toUpperCase().padStart(8, '0');
  if (base === 'OCT') return unsigned.toString(8).padStart(11, '0');
  // BIN: show 16 bits when value fits signed 16-bit (matches Calcios 16-col block), else 32 bits
  if (v >= -32768n && v <= 32767n) {
    return BigInt.asUintN(16, v).toString(2).padStart(16, '0');
  }
  return unsigned.toString(2).padStart(32, '0');
}

function tokenizeBaseN(source: string, base: BaseMode): BaseToken[] {
  const tokens: BaseToken[] = [];
  let i = 0;
  const digitRegex =
    base === 'DEC' ? /^[0-9]+/
    : base === 'HEX' ? /^[0-9A-F]+/
    : base === 'BIN' ? /^[01]+/
    : /^[0-7]+/;

  while (i < source.length) {
    const ch = source[i];
    if (/\s/.test(ch)) { i++; continue; }
    const rest = source.slice(i);

    if (rest.startsWith('Ans')) { tokens.push({ type: 'ans', offset: i }); i += 3; continue; }
    if (rest.startsWith('xnor')) { tokens.push({ type: 'binary', op: 'xnor', offset: i }); i += 4; continue; }
    if (rest.startsWith('and')) { tokens.push({ type: 'binary', op: 'and', offset: i }); i += 3; continue; }
    if (rest.startsWith('xor')) { tokens.push({ type: 'binary', op: 'xor', offset: i }); i += 3; continue; }
    if (rest.startsWith('or')) { tokens.push({ type: 'binary', op: 'or', offset: i }); i += 2; continue; }
    if (rest.startsWith('Not(')) { tokens.push({ type: 'unary', op: 'Not', offset: i }); tokens.push({ type: 'open', offset: i + 3 }); i += 4; continue; }
    if (rest.startsWith('Neg(')) { tokens.push({ type: 'unary', op: 'Neg', offset: i }); tokens.push({ type: 'open', offset: i + 3 }); i += 4; continue; }

    // Explicit base prefixes (SHIFT+3 Page 2: d, h, b, o)
    const prefMatch = rest.match(/^([dhbo])((?:(?!xnor|xor|and|or|Ans|Not\(|Neg\(|[XYM])[0-9A-Za-z])*)/);
    if (prefMatch) {
      const p = prefMatch[1];
      const body = prefMatch[2].toUpperCase();
      if (!body) syntax(`Expected digits after '${p}' prefix`, i);
      const pBase: BaseMode = p === 'd' ? 'DEC' : p === 'h' ? 'HEX' : p === 'b' ? 'BIN' : 'OCT';
      if (tokens[tokens.length - 1]?.type === 'literal') {
        syntax('Adjacent numbers are invalid', i);
      }
      const raw = parseRawBaseLiteral(body, pBase, i + 1);
      tokens.push({ type: 'literal', text: prefMatch[0], raw, litBase: pBase, offset: i });
      i += prefMatch[0].length;
      continue;
    }

    const lit = rest.match(digitRegex);
    if (lit) {
      if (tokens[tokens.length - 1]?.type === 'literal') {
        syntax('Adjacent numbers are invalid', i);
      }
      const raw = parseRawBaseLiteral(lit[0], base, i);
      tokens.push({ type: 'literal', text: lit[0], raw, litBase: base, offset: i });
      i += lit[0].length;
      continue;
    }

    if (BASE_VAR_SET.has(ch) && (base !== 'HEX' || ch === 'X' || ch === 'Y' || ch === 'M')) {
      tokens.push({ type: 'var', name: ch as VariableName, offset: i });
      i++;
      continue;
    }

    if (ch === '+' || ch === '-' || ch === '−' || ch === '×' || ch === '*' || ch === '÷' || ch === '/') {
      const norm = ch === '−' ? '-' : ch === '*' ? '×' : ch === '/' ? '÷' : ch;
      tokens.push({ type: 'binary', op: norm, offset: i });
      i++;
      continue;
    }
    if (ch === '(') { tokens.push({ type: 'open', offset: i }); i++; continue; }
    if (ch === ')') { tokens.push({ type: 'close', offset: i }); i++; continue; }
    syntax(`Invalid character '${ch}' in ${base} mode`, i);
  }
  tokens.push({ type: 'end', offset: source.length });
  return tokens;
}

export function evaluateBaseN(
  source: string,
  base: BaseMode,
  ans: bigint,
  variables?: Record<VariableName, StoredScalar>,
): bigint {
  const tokens = tokenizeBaseN(completeParentheses(source), base);
  let pos = 0;
  const peek = () => tokens[pos];
  const take = () => tokens[pos++];

  const negateChecked = (v: bigint): bigint => {
    const neg = -v;
    if (base === 'DEC' && (neg < INT32_MIN || neg > INT32_MAX)) mathError('BASE-N overflow');
    return toInt32(neg);
  };

  function parseExpr(minPrec: number): bigint {
    let left = parsePrefix();
    for (;;) {
      const next = peek();
      let op: BaseToken & { type: 'binary' } extends { op: infer O } ? O | null : never = null;
      let prec = 0;
      let implicit = false;

      if (next.type === 'binary') {
        op = next.op;
        prec =
          next.op === 'or' || next.op === 'xor' || next.op === 'xnor' ? 5
          : next.op === 'and' ? 10
          : next.op === '+' || next.op === '-' ? 15
          : 20;
      } else if (
        next.type === 'open' ||
        next.type === 'ans' ||
        next.type === 'var' ||
        next.type === 'unary' ||
        next.type === 'literal'
      ) {
        op = '×';
        prec = 22;
        implicit = true;
      }

      if (!op || prec < minPrec) break;
      if (!implicit) take();
      const right = parseExpr(prec + 1);
      switch (op) {
        case '+': {
          const s = left + right;
          if (base === 'DEC' && (s < INT32_MIN || s > INT32_MAX)) mathError('BASE-N overflow');
          left = toInt32(s);
          break;
        }
        case '-': {
          const s = left - right;
          if (base === 'DEC' && (s < INT32_MIN || s > INT32_MAX)) mathError('BASE-N overflow');
          left = toInt32(s);
          break;
        }
        case '×': {
          const s = left * right;
          if (base === 'DEC' && (s < INT32_MIN || s > INT32_MAX)) mathError('BASE-N overflow');
          left = toInt32(s);
          break;
        }
        case '÷': {
          if (right === 0n) mathError('Division by zero');
          const q = left / right;
          if (base === 'DEC' && (q < INT32_MIN || q > INT32_MAX)) mathError('BASE-N overflow');
          left = toInt32(q);
          break;
        }
        case 'and': left = toInt32(left & right); break;
        case 'or': left = toInt32(left | right); break;
        case 'xor': left = toInt32(left ^ right); break;
        case 'xnor': left = toInt32(~(left ^ right)); break;
      }
    }
    return left;
  }

  function parsePrefix(): bigint {
    const tok = take();
    if (tok.type === 'binary' && (tok.op === '+' || tok.op === '-')) {
      if (tok.op === '-') {
        const nxt = peek();
        if (nxt.type === 'literal' && nxt.litBase === 'DEC' && nxt.raw === 2147483648n) {
          take();
          return INT32_MIN;
        }
      }
      const v = parseExpr(25);
      return tok.op === '-' ? negateChecked(v) : v;
    }
    if (tok.type === 'unary') {
      if (peek().type !== 'open') syntax('Expected (', peek().offset);
      take();
      const nxt = peek();
      if (
        tok.op === 'Neg' &&
        nxt.type === 'literal' &&
        nxt.litBase === 'DEC' &&
        nxt.raw === 2147483648n &&
        tokens[pos + 1]?.type === 'close'
      ) {
        take();
        take();
        return INT32_MIN;
      }
      const v = parseExpr(0);
      if (peek().type !== 'close') syntax('Expected )', peek().offset);
      take();
      return tok.op === 'Not' ? toInt32(~v) : negateChecked(v);
    }
    if (tok.type === 'open') {
      const v = parseExpr(0);
      if (peek().type !== 'close') syntax('Expected )', peek().offset);
      take();
      return v;
    }
    if (tok.type === 'literal') {
      return materializeLiteral(tok.raw, tok.litBase);
    }
    if (tok.type === 'var') {
      if (!variables) return 0n;
      return scalarToBaseNInt32(deserialize(variables[tok.name]));
    }
    if (tok.type === 'ans') return toInt32(ans);
    return syntax('Expected value in BASE-N', tok.offset);
  }

  if (peek().type === 'end') syntax('Empty expression', 0);
  const out = parseExpr(0);
  if (peek().type !== 'end') syntax('Unexpected token in BASE-N', peek().offset);
  return out;
}

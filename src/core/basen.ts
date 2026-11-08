import { mathError, syntax } from './errors';
import { completeParentheses } from './expression';

export type BaseMode = 'DEC' | 'HEX' | 'BIN' | 'OCT';

type BaseToken =
  | { type: 'literal'; text: string; offset: number }
  | { type: 'ans'; offset: number }
  | { type: 'unary'; op: 'Not' | 'Neg'; offset: number }
  | { type: 'binary'; op: '+' | '-' | '×' | '÷' | 'and' | 'or' | 'xor' | 'xnor'; offset: number }
  | { type: 'open'; offset: number }
  | { type: 'close'; offset: number }
  | { type: 'end'; offset: number };

const INT32_MIN = -2147483648n;
const INT32_MAX = 2147483647n;

export function toInt32(n: bigint): bigint {
  return BigInt.asIntN(32, n);
}

function parseBaseLiteral(text: string, base: BaseMode): bigint {
  if (base === 'DEC') {
    if (!/^\d+$/.test(text)) syntax('Invalid decimal literal in BASE-N');
    const val = BigInt(text);
    if (val > 2147483648n) mathError('DEC literal out of 32-bit range');
    return toInt32(val);
  }
  if (base === 'HEX') {
    if (!/^[0-9A-F]{1,8}$/.test(text)) syntax('Invalid HEX literal');
    return toInt32(BigInt(`0x${text}`));
  }
  if (base === 'BIN') {
    if (!/^[01]{1,32}$/.test(text)) syntax('Invalid BIN literal');
    return toInt32(BigInt(`0b${text}`));
  }
  // OCT
  if (!/^[0-7]{1,11}$/.test(text)) syntax('Invalid OCT literal');
  const raw = BigInt(`0o${text}`);
  if (raw > 0xffffffffn) mathError('OCT literal out of 32-bit range');
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
    const prefMatch = rest.match(/^([dhbo])([0-9A-F]+)/);
    if (prefMatch) {
      const p = prefMatch[1];
      const body = prefMatch[2];
      const pBase: BaseMode = p === 'd' ? 'DEC' : p === 'h' ? 'HEX' : p === 'b' ? 'BIN' : 'OCT';
      const parsed = parseBaseLiteral(body, pBase);
      // Store as canonical decimal prefixed literal marker
      tokens.push({ type: 'literal', text: `@${parsed.toString(10)}`, offset: i });
      i += prefMatch[0].length;
      continue;
    }

    const lit = rest.match(digitRegex);
    if (lit) {
      tokens.push({ type: 'literal', text: lit[0], offset: i });
      i += lit[0].length;
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

export function evaluateBaseN(source: string, base: BaseMode, ans: bigint): bigint {
  const tokens = tokenizeBaseN(completeParentheses(source), base);
  let pos = 0;
  const peek = () => tokens[pos];
  const take = () => tokens[pos++];

  function parseExpr(minPrec: number): bigint {
    let left = parsePrefix();
    for (;;) {
      const next = peek();
      if (next.type !== 'binary') break;
      const prec =
        next.op === 'or' || next.op === 'xor' || next.op === 'xnor' ? 5
        : next.op === 'and' ? 10
        : next.op === '+' || next.op === '-' ? 15
        : 20;
      if (prec < minPrec) break;
      take();
      const right = parseExpr(prec + 1);
      switch (next.op) {
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
          left = toInt32(left / right);
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
      const v = parseExpr(25);
      return tok.op === '-' ? toInt32(-v) : v;
    }
    if (tok.type === 'unary') {
      if (peek().type !== 'open') syntax('Expected (', peek().offset);
      take();
      const v = parseExpr(0);
      if (peek().type !== 'close') syntax('Expected )', peek().offset);
      take();
      return tok.op === 'Not' ? toInt32(~v) : toInt32(-v);
    }
    if (tok.type === 'open') {
      const v = parseExpr(0);
      if (peek().type !== 'close') syntax('Expected )', peek().offset);
      take();
      return v;
    }
    if (tok.type === 'literal') {
      if (tok.text.startsWith('@')) return toInt32(BigInt(tok.text.slice(1)));
      return parseBaseLiteral(tok.text, base);
    }
    if (tok.type === 'ans') return toInt32(ans);
    return syntax('Expected value in BASE-N', tok.offset);
  }

  if (peek().type === 'end') syntax('Empty expression', 0);
  const out = parseExpr(0);
  if (peek().type !== 'end') syntax('Unexpected token in BASE-N', peek().offset);
  return out;
}

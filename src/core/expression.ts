import { numericDerivative, numericIntegral, numericProduct, numericSummation } from './calculus';
import { CONSTANT_BY_TOKEN } from './constants';
import { statNormP, statNormQ, statNormR } from './dist';
import { CalculatorError, mathError, syntax } from './errors';
import type { NumberFormatSetting } from './format';
import {
  estimateStatXHat, estimateStatXHat2, estimateStatYHat, standardizeStatT,
  type StatSubMode, type StatSummary,
} from './stat';
import {
  VARIABLES, add, applyFunction, applyUnitConversion, combinatoric, convertAngleToActive,
  deserialize, divide, dmsToScalar, factorial, makeScalar, multiply, negate, polarFromRect, power,
  quotientRemainder, rectFromPolar, scalarFromInteger, scalarFromLiteral, scalarFromRecurring, scalarPi,
  serialize, simplifyManualFraction, subtract, D,
  type AngleUnit, type Scalar, type StoredScalar, type VariableName,
} from './value';

type TokenType =
  | 'number'
  | 'recur'
  | 'identifier'
  | 'operator'
  | 'postfix'
  | 'simp'
  | 'dms'
  | 'open'
  | 'close'
  | 'comma'
  | 'end';

export interface Token {
  type: TokenType;
  text: string;
  offset?: number;
  recurParts?: [string, string, string];
}

export interface EvaluationContext {
  angle: AngleUnit;
  variables: Record<VariableName, StoredScalar>;
  ans: StoredScalar;
  preAns?: StoredScalar;
  random?: number;
  rng?: () => number;
  numberFormat?: NumberFormatSetting;
  statContext?: { subMode: StatSubMode; summary: StatSummary };
}

export interface RichEvaluationResult {
  primary: Scalar;
  secondary?: Scalar;
  pairKind?: 'pol' | 'rec' | 'divr';
}

export const STAT_TOKEN_LABELS: Record<string, string> = {
  statN: 'n',
  statMeanX: 'x̄',
  statPopSdX: 'σx',
  statSampSdX: 'sx',
  statSumX: '∑x',
  statSumX2: '∑x²',
  statSumX3: '∑x³',
  statSumX2Y: '∑x²y',
  statSumX4: '∑x⁴',
  statMinX: 'minX',
  statMaxX: 'maxX',
  statQ1: 'Q₁',
  statMed: 'med',
  statQ3: 'Q₃',
  statMeanY: 'ȳ',
  statPopSdY: 'σy',
  statSampSdY: 'sy',
  statSumY: '∑y',
  statSumY2: '∑y²',
  statSumXY: '∑xy',
  statMinY: 'minY',
  statMaxY: 'maxY',
  statRegA: 'A_reg',
  statRegB: 'B_reg',
  statRegC: 'C_reg',
  statCorrR: 'r',
};

const STAT_IDENTIFIERS = Object.keys(STAT_TOKEN_LABELS);
const CALCULUS_NAMES = ['deriv', 'integ', 'sigma', 'prod'];
const FUNCTION_NAMES = [
  'RanInt#', 'RanInt', 'mfrac', 'asinh', 'acosh', 'atanh', 'StatP', 'StatQ', 'StatR',
  'logb', 'sqrt', 'cbrt', 'frac', 'root', 'Intg',
  'sinh', 'cosh', 'tanh', 'asin', 'acos', 'atan',
  'GCD', 'LCM', 'Int', 'Pol', 'Rec', 'Rnd',
  'sin', 'cos', 'tan', 'abs', 'log', 'ln',
];
const KEYWORDS = [
  ...STAT_IDENTIFIERS,
  ...CALCULUS_NAMES,
  ...FUNCTION_NAMES,
  'PreAns',
  'Ran#',
  'nCr',
  'nPr',
  'Ans',
].sort((a, b) => b.length - a.length);
const VARIABLE_SET = new Set<string>(VARIABLES);

export function tokenize(source: string): Token[] {
  if (source.length > 320) syntax('Expression is too long');
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    if (/\s/.test(char)) { i++; continue; }
    const rest = source.slice(i);

    const constMatch = rest.match(/^const(?:0[1-9]|[1-3]\d|40)/);
    if (constMatch) {
      tokens.push({ type: 'identifier', text: constMatch[0], offset: i });
      i += constMatch[0].length;
      continue;
    }

    const convMatch = rest.match(/^▸conv(?:0[1-9]|[1-3]\d|40)/);
    if (convMatch) {
      tokens.push({ type: 'postfix', text: convMatch[0], offset: i });
      i += convMatch[0].length;
      continue;
    }

    if (rest.startsWith('▸Simp')) {
      tokens.push({ type: 'simp', text: '▸Simp', offset: i });
      i += 5;
      continue;
    }

    if (rest.startsWith('▸xhat2')) {
      tokens.push({ type: 'postfix', text: '▸xhat2', offset: i });
      i += 6;
      continue;
    }

    if (rest.startsWith('▸yhat') || rest.startsWith('▸xhat')) {
      tokens.push({ type: 'postfix', text: rest.slice(0, 5), offset: i });
      i += 5;
      continue;
    }

    if (rest.startsWith('▸t')) {
      tokens.push({ type: 'postfix', text: '▸t', offset: i });
      i += 2;
      continue;
    }

    if (rest.startsWith('÷R')) {
      tokens.push({ type: 'operator', text: '÷R', offset: i });
      i += 2;
      continue;
    }

    // Recurring decimal literal: e.g. 0.r(3), 12.58r(3), or .r(142857)
    const recMatch = rest.match(/^(?:(\d+)\.(\d*)|\.(\d*))r\((\d+)\)/);
    if (recMatch) {
      if (tokens[tokens.length - 1]?.type === 'number' || tokens[tokens.length - 1]?.type === 'recur') {
        syntax('Adjacent numbers are invalid', i);
      }
      const intPart = recMatch[1] ?? '0';
      const nonRep = recMatch[1] !== undefined ? (recMatch[2] ?? '') : (recMatch[3] ?? '');
      const rep = recMatch[4];
      tokens.push({
        type: 'recur',
        text: recMatch[0],
        offset: i,
        recurParts: [intPart, nonRep, rep],
      });
      i += recMatch[0].length;
      continue;
    }

    const number = rest.match(/^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/);
    if (number) {
      if (tokens[tokens.length - 1]?.type === 'number' || tokens[tokens.length - 1]?.type === 'recur') {
        syntax('Adjacent numbers are invalid', i);
      }
      tokens.push({ type: 'number', text: number[0], offset: i });
      i += number[0].length;
      continue;
    }

    const keyword = KEYWORDS.find((word) => rest.startsWith(word));
    if (keyword) {
      tokens.push({ type: keyword === 'nCr' || keyword === 'nPr' ? 'operator' : 'identifier', text: keyword, offset: i });
      i += keyword.length;
      continue;
    }

    if (VARIABLE_SET.has(char) || char === 'π' || char === 'e') {
      tokens.push({ type: 'identifier', text: char, offset: i });
      i++;
      continue;
    }
    if (char === '°') {
      tokens.push({ type: 'dms', text: char, offset: i });
      i++;
      continue;
    }
    if (char === 'ᵈ' || char === 'ʳ' || char === 'ᵍ') {
      tokens.push({ type: 'postfix', text: char, offset: i });
      i++;
      continue;
    }
    if ('+-−×÷*/^!%⏨'.includes(char)) {
      tokens.push({ type: 'operator', text: char === '−' ? '-' : char, offset: i });
      i++;
      continue;
    }
    if (char === '(') { tokens.push({ type: 'open', text: char, offset: i }); i++; continue; }
    if (char === ')') { tokens.push({ type: 'close', text: char, offset: i }); i++; continue; }
    if (char === ',') { tokens.push({ type: 'comma', text: char, offset: i }); i++; continue; }
    return syntax(`Unexpected character: ${char}`, i);
  }
  tokens.push({ type: 'end', text: '', offset: source.length });
  return tokens;
}

function resolveStatToken(name: string, ctx: EvaluationContext): Scalar {
  if (!ctx.statContext) mathError('STAT data unavailable');
  const s = ctx.statContext.summary;
  const map: Record<string, Scalar | undefined> = {
    statN: s.n,
    statMeanX: s.meanX,
    statPopSdX: s.popSdX,
    statSampSdX: s.sampSdX,
    statSumX: s.sumX,
    statSumX2: s.sumX2,
    statSumX3: s.sumX3,
    statSumX2Y: s.sumX2Y,
    statSumX4: s.sumX4,
    statMinX: s.minX,
    statMaxX: s.maxX,
    statQ1: s.q1,
    statMed: s.med,
    statQ3: s.q3,
    statMeanY: s.meanY,
    statPopSdY: s.popSdY,
    statSampSdY: s.sampSdY,
    statSumY: s.sumY,
    statSumY2: s.sumY2,
    statSumXY: s.sumXY,
    statMinY: s.minY,
    statMaxY: s.maxY,
    statRegA: s.regA,
    statRegB: s.regB,
    statRegC: s.regC,
    statCorrR: s.corrR,
  };
  const val = map[name];
  if (!val) mathError(`Statistic ${name} unavailable in current STAT mode`);
  return val;
}

class Parser {
  private pos = 0;
  private depth = 0;
  constructor(private tokens: Token[], private context: EvaluationContext) {}
  private peek(): Token { return this.tokens[this.pos]; }
  private take(): Token { return this.tokens[this.pos++]; }
  private expect(type: TokenType): void {
    if (this.peek().type !== type) syntax(`Expected ${type}`, this.peek().offset);
    this.take();
  }

  parse(): Scalar {
    if (this.peek().type === 'end') return syntax('Empty expression', 0);
    const result = this.expression(0);
    if (this.peek().type !== 'end') syntax('Unexpected token', this.peek().offset);
    return result;
  }

  parseTopLevel(): RichEvaluationResult {
    if (this.peek().type === 'end') return syntax('Empty expression');

    // Top-level Pol(x, y) or Rec(r, θ)
    if (this.peek().type === 'identifier' && (this.peek().text === 'Pol' || this.peek().text === 'Rec')) {
      const savePos = this.pos;
      const fnName = this.take().text as 'Pol' | 'Rec';
      if (this.peek().type === 'open') {
        this.take();
        const arg1 = this.expression(0);
        if (this.peek().type === 'comma') {
          this.take();
          const arg2 = this.expression(0);
          if (this.peek().type === 'close') {
            this.take();
            if (this.peek().type === 'end') {
              if (fnName === 'Pol') {
                const { r, theta } = polarFromRect(arg1, arg2, this.context.angle);
                return { primary: r, secondary: theta, pairKind: 'pol' };
              }
              const { x, y } = rectFromPolar(arg1, arg2, this.context.angle);
              return { primary: x, secondary: y, pairKind: 'rec' };
            }
          }
        }
      }
      this.pos = savePos;
    }

    // Top-level Quotient & Remainder: <expr> ÷R <expr>
    const divRIndices = this.tokens
      .map((t, idx) => (t.type === 'operator' && t.text === '÷R' ? idx : -1))
      .filter((idx) => idx !== -1);
    if (divRIndices.length === 1) {
      let depth = 0;
      const splitAt = divRIndices[0];
      for (let i = 0; i < splitAt; i++) {
        if (this.tokens[i].type === 'open') depth++;
        else if (this.tokens[i].type === 'close') depth--;
      }
      if (depth === 0) {
        const isValueEnd = (t: Token | undefined): boolean =>
          !!t &&
          (t.type === 'number' ||
            t.type === 'recur' ||
            t.type === 'identifier' ||
            t.type === 'close' ||
            t.type === 'dms' ||
            t.type === 'postfix' ||
            (t.type === 'operator' && (t.text === '!' || t.text === '%')));

        const hasOuterOp = (slice: Token[], disallowMulDiv: boolean): boolean => {
          let d = 0;
          for (let i = 0; i < slice.length; i++) {
            const tok = slice[i];
            if (tok.type === 'end') break;
            if (tok.type === 'open') { d++; continue; }
            if (tok.type === 'close') { d--; continue; }
            if (d !== 0) continue;
            if (tok.type === 'simp') return true;
            if (tok.type === 'operator') {
              if ((tok.text === '+' || tok.text === '-') && isValueEnd(slice[i - 1])) return true;
              if (disallowMulDiv && ['×', '÷', '*', '/'].includes(tok.text)) return true;
            }
          }
          return false;
        };

        const rawLhs = this.tokens.slice(0, splitAt);
        const rawRhs = this.tokens.slice(splitAt + 1);
        if (hasOuterOp(rawLhs, false) || hasOuterOp(rawRhs, true)) {
          syntax('÷R cannot be combined with lower-precedence operators', this.tokens[splitAt].offset);
        }
        const lhsTokens: Token[] = [...rawLhs, { type: 'end', text: '' }];
        const rhsTokens: Token[] = [...rawRhs];
        const lhs = new Parser(lhsTokens, this.context).parse();
        const rhs = new Parser(rhsTokens, this.context).parse();
        const { quotient, remainder } = quotientRemainder(lhs, rhs);
        return { primary: quotient, secondary: remainder, pairKind: 'divr' };
      }
    }

    return { primary: this.parse() };
  }

  private collectArgumentTokens(): Token[] {
    const slice: Token[] = [];
    let nested = 0;
    while (this.peek().type !== 'end') {
      const tok = this.peek();
      if (nested === 0 && (tok.type === 'comma' || tok.type === 'close')) break;
      if (tok.type === 'open') nested++;
      else if (tok.type === 'close') nested--;
      slice.push(this.take());
    }
    if (slice.length === 0) syntax('Empty argument', this.peek().offset);
    slice.push({ type: 'end', text: '', offset: this.peek().offset });
    return slice;
  }

  private expression(minBindingPower: number): Scalar {
    if (++this.depth > 128) return syntax('Expression is too deeply nested', this.peek().offset);
    let left = this.prefix();
    for (;;) {
      const next = this.peek();
      if (next.type === 'simp') {
        if (15 < minBindingPower) break;
        this.take();
        const after = this.peek();
        const canTakeFactor =
          after.type === 'number' ||
          after.type === 'identifier' ||
          after.type === 'open' ||
          (after.type === 'operator' && (after.text === '+' || after.text === '-'));
        const factor = canTakeFactor ? this.expression(20) : undefined;
        left = simplifyManualFraction(left, factor);
        continue;
      }

      if (next.type === 'dms') {
        if (45 < minBindingPower) break;
        this.take();
        const parts: Scalar[] = [left];
        while (parts.length < 3 && this.tokens[this.pos + 1]?.type === 'dms') {
          const curTok = this.peek();
          if (curTok.type === 'number') {
            const partNum = scalarFromLiteral(this.take().text);
            this.take();
            parts.push(partNum);
          } else if (
            curTok.type === 'identifier' &&
            (VARIABLE_SET.has(curTok.text) || curTok.text === 'Ans' || curTok.text === 'PreAns')
          ) {
            this.take();
            this.take();
            const partVal =
              curTok.text === 'Ans'
                ? deserialize(this.context.ans)
                : curTok.text === 'PreAns'
                  ? deserialize(this.context.preAns ?? this.context.ans)
                  : deserialize(this.context.variables[curTok.text as VariableName]);
            parts.push(partVal);
          } else {
            break;
          }
        }
        left = dmsToScalar(parts);
        continue;
      }

      if (next.type === 'postfix') {
        if (40 < minBindingPower) break;
        this.take();
        if (next.text === 'ᵈ') left = convertAngleToActive(left, 'DEG', this.context.angle);
        else if (next.text === 'ʳ') left = convertAngleToActive(left, 'RAD', this.context.angle);
        else if (next.text === 'ᵍ') left = convertAngleToActive(left, 'GRA', this.context.angle);
        else if (next.text === '▸yhat') {
          if (!this.context.statContext) mathError('STAT unavailable');
          left = estimateStatYHat(this.context.statContext.subMode, this.context.statContext.summary, left);
        } else if (next.text === '▸xhat') {
          if (!this.context.statContext) mathError('STAT unavailable');
          left = estimateStatXHat(this.context.statContext.subMode, this.context.statContext.summary, left);
        } else if (next.text === '▸xhat2') {
          if (!this.context.statContext) mathError('STAT unavailable');
          left = estimateStatXHat2(this.context.statContext.subMode, this.context.statContext.summary, left);
        } else if (next.text === '▸t') {
          if (!this.context.statContext) mathError('STAT unavailable');
          left = standardizeStatT(this.context.statContext.summary, left);
        } else {
          left = applyUnitConversion(left, next.text);
        }
        continue;
      }

      if (next.type === 'operator' && (next.text === '!' || next.text === '%')) {
        if (40 < minBindingPower) break;
        this.take();
        left = next.text === '!' ? factorial(left) : divide(left, scalarFromInteger(100));
        continue;
      }

      let operator: string | undefined;
      let precedence = 0;
      let implicit = false;
      if (next.type === 'operator') {
        if (next.text === '÷R') syntax('÷R can only be used as a top-level division', next.offset);
        operator = next.text;
        precedence = operator === '+' || operator === '-' ? 10
          : ['×', '÷', '*', '/'].includes(operator) ? 20
          : operator === 'nCr' || operator === 'nPr' ? 25
          : operator === '^' ? 30
          : operator === '⏨' ? 32 : 0;
      } else if (
        next.type === 'number' ||
        next.type === 'recur' ||
        next.type === 'identifier' ||
        next.type === 'open'
      ) {
        operator = '×';
        precedence = 23;
        implicit = true;
      }
      if (!operator || precedence < minBindingPower || precedence === 0) break;
      if (!implicit) this.take();
      const right = operator === '⏨'
        ? this.sciExponent()
        : this.expression(operator === '^' ? precedence : precedence + 1);
      switch (operator) {
        case '+': left = add(left, right); break;
        case '-': left = subtract(left, right); break;
        case '×': case '*': left = multiply(left, right); break;
        case '÷': case '/': left = divide(left, right); break;
        case '^': left = power(left, right); break;
        case '⏨': left = multiply(left, power(scalarFromInteger(10), right)); break;
        case 'nCr': left = combinatoric(left, right, false); break;
        case 'nPr': left = combinatoric(left, right, true); break;
      }
    }
    this.depth--;
    return left;
  }

  private sciExponent(): Scalar {
    const next = this.peek();
    if (next.type === 'operator' && (next.text === '+' || next.text === '-')) {
      this.take();
      const mag = this.sciExponent();
      return next.text === '-' ? negate(mag) : mag;
    }
    return this.expression(33);
  }

  private prefix(): Scalar {
    const token = this.take();
    if (token.type === 'operator' && (token.text === '+' || token.text === '-')) {
      const operand = this.expression(30);
      return token.text === '-' ? negate(operand) : operand;
    }
    if (token.type === 'operator' && token.text === '⏨') {
      const exp = this.sciExponent();
      return power(scalarFromInteger(10), exp);
    }
    if (token.type === 'number') return scalarFromLiteral(token.text);
    if (token.type === 'recur' && token.recurParts) {
      const [intPart, nonRep, rep] = token.recurParts;
      return scalarFromRecurring(intPart, nonRep, rep);
    }
    if (token.type === 'open') {
      const value = this.expression(0);
      this.expect('close');
      return value;
    }
    if (token.type === 'identifier') {
      if (STAT_IDENTIFIERS.includes(token.text)) {
        return resolveStatToken(token.text, this.context);
      }

      if (CALCULUS_NAMES.includes(token.text)) {
        this.expect('open');
        const bodyTokens = this.collectArgumentTokens();
        this.expect('comma');
        const arg1 = this.expression(0);
        const evalWithX = (xVal: Scalar): Scalar =>
          new Parser(bodyTokens, {
            ...this.context,
            variables: { ...this.context.variables, X: serialize(xVal) },
          }).parse();
        if (token.text === 'deriv') {
          this.expect('close');
          return numericDerivative(evalWithX, arg1);
        }
        this.expect('comma');
        const arg2 = this.expression(0);
        this.expect('close');
        if (token.text === 'integ') return numericIntegral(evalWithX, arg1, arg2);
        if (token.text === 'sigma') return numericSummation(evalWithX, arg1, arg2);
        return numericProduct(evalWithX, arg1, arg2);
      }

      if (token.text === 'StatP' || token.text === 'StatQ' || token.text === 'StatR') {
        this.expect('open');
        const arg = this.expression(0);
        this.expect('close');
        if (token.text === 'StatP') return statNormP(arg);
        if (token.text === 'StatQ') return statNormQ(arg);
        return statNormR(arg);
      }

      if (FUNCTION_NAMES.includes(token.text)) {
        this.expect('open');
        const args = [this.expression(0)];
        while (this.peek().type === 'comma') {
          this.take();
          args.push(this.expression(0));
        }
        this.expect('close');
        return applyFunction(token.text, args, this.context.angle, {
          random: this.context.random,
          rng: this.context.rng,
          numberFormat: this.context.numberFormat,
        });
      }

      const constant = CONSTANT_BY_TOKEN.get(token.text);
      if (constant) {
        return { ...scalarFromLiteral(constant.value), preferDecimal: true };
      }

      if (token.text === 'Ran#') {
        const sample = this.context.rng ? this.context.rng() : (this.context.random ?? Math.random());
        const safe = Math.max(0, Math.min(0.999, Math.floor(sample * 1000) / 1000));
        return scalarFromLiteral(safe.toFixed(3));
      }
      if (token.text === 'π') return scalarPi();
      if (token.text === 'e') return makeScalar(new D(1).exp(), undefined, false);
      if (token.text === 'Ans') return deserialize(this.context.ans);
      if (token.text === 'PreAns') return deserialize(this.context.preAns ?? this.context.ans);
      if (VARIABLE_SET.has(token.text)) return deserialize(this.context.variables[token.text as VariableName]);
    }
    return syntax('Expected a value', token.offset);
  }
}

export function completeParentheses(source: string): string {
  let open = 0;
  for (let idx = 0; idx < source.length; idx++) {
    const char = source[idx];
    if (char === '(') open++;
    if (char === ')') {
      open--;
      if (open < 0) syntax('Unexpected closing parenthesis', idx);
    }
  }
  return source + ')'.repeat(open);
}

export function evaluateExpression(source: string, context: EvaluationContext): Scalar {
  try {
    return new Parser(tokenize(completeParentheses(source)), context).parse();
  } catch (error) {
    if (error instanceof CalculatorError) throw error;
    if (error instanceof Error && error.message.startsWith('[DecimalError]')) return mathError(error.message);
    throw error;
  }
}

export function evaluateRichExpression(source: string, context: EvaluationContext): RichEvaluationResult {
  try {
    return new Parser(tokenize(completeParentheses(source)), context).parseTopLevel();
  } catch (error) {
    if (error instanceof CalculatorError) throw error;
    if (error instanceof Error && error.message.startsWith('[DecimalError]')) return mathError(error.message);
    throw error;
  }
}

export function parseAssignmentStatement(source: string): { target: VariableName; rhs: string } | null {
  const stoMatch = source.match(/^([\s\S]+?)\s*→\s*([A-FXYM])\s*$/);
  if (stoMatch && !stoMatch[1].includes('→') && !stoMatch[1].includes('=')) {
    const rhs = stoMatch[1].trim();
    if (rhs.length > 0) {
      return { target: stoMatch[2] as VariableName, rhs };
    }
  }
  const eqIndex = source.indexOf('=');
  if (eqIndex === -1) return null;
  if (source.indexOf('=', eqIndex + 1) !== -1) return null;
  const lhs = source.slice(0, eqIndex).trim();
  const rhs = source.slice(eqIndex + 1).trim();
  if (VARIABLE_SET.has(lhs) && rhs.length > 0) {
    return { target: lhs as VariableName, rhs };
  }
  return null;
}

export function extractVariables(source: string): VariableName[] {
  const statements = splitStatements(source);
  const needed = new Set<VariableName>();
  const assignedSoFar = new Set<VariableName>();

  for (const rawStmt of statements) {
    const stmt = rawStmt.trim();
    if (!stmt) continue;
    const assign = parseAssignmentStatement(stmt);
    if (!assign && statements.length > 1 && stmt.includes('=')) {
      syntax('Equation = is not allowed inside multi-statement CALC');
    }
    const exprToScan = assign
      ? assign.rhs
      : stmt.includes('=')
        ? stmt.replace(/=/g, '+')
        : stmt;

    const tokens = tokenize(completeParentheses(exprToScan));
    const boundXDepths: number[] = [];
    let depth = 0;

    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if (tok.type === 'identifier' && CALCULUS_NAMES.includes(tok.text) && tokens[i + 1]?.type === 'open') {
        boundXDepths.push(depth + 1);
      }
      if (tok.type === 'open') depth++;
      else if (tok.type === 'close') {
        while (boundXDepths.length && boundXDepths[boundXDepths.length - 1] === depth) {
          boundXDepths.pop();
        }
        depth--;
      } else if (tok.type === 'comma') {
        if (boundXDepths.length && boundXDepths[boundXDepths.length - 1] === depth) {
          boundXDepths.pop();
        }
      } else if (tok.type === 'identifier' && VARIABLE_SET.has(tok.text)) {
        if (tok.text === 'X' && boundXDepths.length > 0) continue;
        const vName = tok.text as VariableName;
        if (!assignedSoFar.has(vName)) {
          needed.add(vName);
        }
      }
    }

    if (assign) {
      assignedSoFar.add(assign.target);
    }
  }

  const order: VariableName[] = ['X', 'Y', 'A', 'B', 'C', 'D', 'E', 'F', 'M'];
  return order.filter((v) => needed.has(v));
}

export function splitStatements(source: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '(') depth++;
    else if (ch === ')' && depth > 0) depth--;
    else if (ch === ':' && depth === 0) {
      parts.push(source.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(source.slice(start));
  return parts;
}

export function splitEquation(source: string): { left: string; right: string } {
  const eqIndex = source.indexOf('=');
  if (eqIndex === -1) return { left: source, right: '0' };
  const second = source.indexOf('=', eqIndex + 1);
  if (second !== -1) syntax('Multiple equals signs');
  const left = source.slice(0, eqIndex).trim();
  const right = source.slice(eqIndex + 1).trim();
  if (!left || !right) syntax('Incomplete equation');
  return { left, right };
}

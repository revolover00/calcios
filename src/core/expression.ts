import { numericDerivative, numericIntegral, numericProduct, numericSummation } from './calculus';
import { CONSTANT_BY_TOKEN } from './constants';
import { CalculatorError, mathError, syntax } from './errors';
import type { NumberFormatSetting } from './format';
import {
  D, VARIABLES, add, applyFunction, applyUnitConversion, combinatoric, convertAngleToActive,
  deserialize, divide, dmsToScalar, factorial, makeScalar, multiply, negate, polarFromRect, power,
  rectFromPolar, scalarFromInteger, scalarFromLiteral, serialize, subtract,
  type AngleUnit, type Scalar, type StoredScalar, type VariableName,
} from './value';

type TokenType = 'number' | 'identifier' | 'operator' | 'postfix' | 'dms' | 'open' | 'close' | 'comma' | 'end';
export interface Token { type: TokenType; text: string }

export interface EvaluationContext {
  angle: AngleUnit;
  variables: Record<VariableName, StoredScalar>;
  ans: StoredScalar;
  random?: number;
  numberFormat?: NumberFormatSetting;
}

export interface RichEvaluationResult {
  primary: Scalar;
  secondary?: Scalar;
  pairKind?: 'pol' | 'rec';
}

const CALCULUS_NAMES = ['deriv', 'integ', 'sigma', 'prod'];
const FUNCTION_NAMES = [
  'RanInt', 'mfrac', 'asinh', 'acosh', 'atanh', 'logb', 'sqrt', 'cbrt', 'frac', 'root',
  'sinh', 'cosh', 'tanh', 'asin', 'acos', 'atan', 'Pol', 'Rec', 'Rnd',
  'sin', 'cos', 'tan', 'abs', 'log', 'ln',
];
const KEYWORDS = [...CALCULUS_NAMES, ...FUNCTION_NAMES, 'nCr', 'nPr', 'Ans'].sort((a, b) => b.length - a.length);
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
      tokens.push({ type: 'identifier', text: constMatch[0] });
      i += constMatch[0].length;
      continue;
    }

    const convMatch = rest.match(/^▸conv(?:0[1-9]|[1-3]\d|40)/);
    if (convMatch) {
      tokens.push({ type: 'postfix', text: convMatch[0] });
      i += convMatch[0].length;
      continue;
    }

    const number = rest.match(/^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/);
    if (number) {
      if (tokens[tokens.length - 1]?.type === 'number') syntax('Adjacent numbers are invalid');
      tokens.push({ type: 'number', text: number[0] });
      i += number[0].length;
      continue;
    }

    const keyword = KEYWORDS.find((word) => rest.startsWith(word));
    if (keyword) {
      tokens.push({ type: keyword === 'nCr' || keyword === 'nPr' ? 'operator' : 'identifier', text: keyword });
      i += keyword.length;
      continue;
    }

    if (VARIABLE_SET.has(char) || char === 'π' || char === 'e') {
      tokens.push({ type: 'identifier', text: char });
      i++;
      continue;
    }
    if (char === '°') {
      tokens.push({ type: 'dms', text: char });
      i++;
      continue;
    }
    if (char === 'ᵈ' || char === 'ʳ' || char === 'ᵍ') {
      tokens.push({ type: 'postfix', text: char });
      i++;
      continue;
    }
    if ('+-−×÷*/^!%'.includes(char)) {
      tokens.push({ type: 'operator', text: char === '−' ? '-' : char });
      i++;
      continue;
    }
    if (char === '(') { tokens.push({ type: 'open', text: char }); i++; continue; }
    if (char === ')') { tokens.push({ type: 'close', text: char }); i++; continue; }
    if (char === ',') { tokens.push({ type: 'comma', text: char }); i++; continue; }
    return syntax(`Unexpected character: ${char}`);
  }
  tokens.push({ type: 'end', text: '' });
  return tokens;
}

class Parser {
  private pos = 0;
  private depth = 0;
  constructor(private tokens: Token[], private context: EvaluationContext) {}
  private peek(): Token { return this.tokens[this.pos]; }
  private take(): Token { return this.tokens[this.pos++]; }
  private expect(type: TokenType): void {
    if (this.peek().type !== type) syntax(`Expected ${type}`);
    this.take();
  }

  parse(): Scalar {
    if (this.peek().type === 'end') return syntax('Empty expression');
    const result = this.expression(0);
    if (this.peek().type !== 'end') syntax('Unexpected token');
    return result;
  }

  parseTopLevel(): RichEvaluationResult {
    if (this.peek().type === 'end') return syntax('Empty expression');
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
    if (slice.length === 0) syntax('Empty argument');
    slice.push({ type: 'end', text: '' });
    return slice;
  }

  private expression(minBindingPower: number): Scalar {
    if (++this.depth > 128) return syntax('Expression is too deeply nested');
    let left = this.prefix();
    for (;;) {
      const next = this.peek();
      if (next.type === 'dms') {
        if (45 < minBindingPower) break;
        this.take();
        const parts: Scalar[] = [left];
        while (
          parts.length < 3 &&
          this.peek().type === 'number' &&
          this.tokens[this.pos + 1]?.type === 'dms'
        ) {
          const partNum = scalarFromLiteral(this.take().text);
          this.take(); // consume '°'
          parts.push(partNum);
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
        else left = applyUnitConversion(left, next.text);
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
        operator = next.text;
        precedence = operator === '+' || operator === '-' ? 10
          : ['×', '÷', '*', '/'].includes(operator) ? 20
          : operator === 'nCr' || operator === 'nPr' ? 25
          : operator === '^' ? 30 : 0;
      } else if (next.type === 'number' || next.type === 'identifier' || next.type === 'open') {
        operator = '×';
        precedence = 20;
        implicit = true;
      }
      if (!operator || precedence < minBindingPower || precedence === 0) break;
      if (!implicit) this.take();
      // Exponentiation is right-associative; every other binary operator is left-associative.
      const right = this.expression(operator === '^' ? precedence : precedence + 1);
      switch (operator) {
        case '+': left = add(left, right); break;
        case '-': left = subtract(left, right); break;
        case '×': case '*': left = multiply(left, right); break;
        case '÷': case '/': left = divide(left, right); break;
        case '^': left = power(left, right); break;
        case 'nCr': left = combinatoric(left, right, false); break;
        case 'nPr': left = combinatoric(left, right, true); break;
      }
    }
    this.depth--;
    return left;
  }

  private prefix(): Scalar {
    const token = this.take();
    if (token.type === 'operator' && (token.text === '+' || token.text === '-')) {
      const operand = this.expression(30); // power precedes unary minus: -2² = -4
      return token.text === '-' ? negate(operand) : operand;
    }
    if (token.type === 'number') return scalarFromLiteral(token.text);
    if (token.type === 'open') {
      const value = this.expression(0);
      this.expect('close');
      return value;
    }
    if (token.type === 'identifier') {
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
          numberFormat: this.context.numberFormat,
        });
      }

      const constant = CONSTANT_BY_TOKEN.get(token.text);
      if (constant) {
        return { ...scalarFromLiteral(constant.value), preferDecimal: true };
      }

      if (token.text === 'π') return makeScalar(D.acos(-1), undefined, false);
      if (token.text === 'e') return makeScalar(new D(1).exp(), undefined, false);
      if (token.text === 'Ans') return deserialize(this.context.ans);
      if (VARIABLE_SET.has(token.text)) return deserialize(this.context.variables[token.text as VariableName]);
    }
    return syntax('Expected a value');
  }
}

/** Automatically closes unmatched opening parentheses, like a calculator on EXE. */
export function completeParentheses(source: string): string {
  let open = 0;
  for (const char of source) {
    if (char === '(') open++;
    if (char === ')') {
      open--;
      if (open < 0) syntax('Unexpected closing parenthesis');
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

/** Extracts free calculator variables referenced in an expression (for CALC prompts). */
export function extractVariables(source: string): VariableName[] {
  const clean = source.includes('=') ? source.split('=')[0] : source;
  const tokens = tokenize(completeParentheses(clean));
  const seen = new Set<VariableName>();
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
        // After first comma of deriv/integ/sigma, X is free again in bounds!
        boundXDepths.pop();
      }
    } else if (tok.type === 'identifier' && VARIABLE_SET.has(tok.text)) {
      if (tok.text === 'X' && boundXDepths.length > 0) continue;
      seen.add(tok.text as VariableName);
    }
  }
  const order: VariableName[] = ['X', 'Y', 'A', 'B', 'C', 'D', 'E', 'F', 'M'];
  return order.filter((v) => seen.has(v));
}

/** Splits multi-statement input on top-level ':' characters. */
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

/** Splits a SOLVE equation `left = right` (or `expr` -> `expr = 0`). */
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

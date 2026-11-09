/**
 * Structural parser & cursor/deletion engine for Calcios 2D Natural Math 2D templates.
 * Shared by both the state machine (calculator.ts) and LCD renderer (NaturalMath.tsx)
 * so cursor movement (◀ ▶ ▲ ▼), smart DEL, and operand wrapping never desynchronize.
 */

export interface SlotSpan {
  start: number;
  end: number;
}

export type TemplateKind =
  | 'frac'
  | 'mfrac'
  | 'sqrt'
  | 'cbrt'
  | 'root'
  | 'pow'
  | 'logb'
  | 'abs'
  | 'deriv'
  | 'integ'
  | 'sigma'
  | 'prod'
  | 'recur';

export interface TemplateNode {
  kind: TemplateKind;
  nodeStart: number;
  openParen: number;
  nodeEnd: number;
  slots: SlotSpan[];
  children: TemplateNode[];
}

export function parseCallSpans(
  source: string,
  openParenIndex: number,
  expectedArgs: number,
): { args: SlotSpan[]; afterIndex: number } | null {
  if (source[openParenIndex] !== '(') return null;
  const args: SlotSpan[] = [];
  let depth = 0;
  let segStart = openParenIndex + 1;
  for (let i = openParenIndex + 1; i < source.length; i++) {
    const ch = source[i];
    if (ch === '(') depth++;
    else if (ch === ')') {
      if (depth === 0) {
        args.push({ start: segStart, end: i });
        if (args.length === expectedArgs) {
          return { args, afterIndex: i + 1 };
        }
        return null;
      }
      depth--;
    } else if (ch === ',' && depth === 0) {
      args.push({ start: segStart, end: i });
      segStart = i + 1;
    }
  }
  return null;
}

const TEMPLATE_SPECS: ReadonlyArray<{ prefix: string; kind: TemplateKind; arity: number }> = [
  { prefix: 'mfrac(', kind: 'mfrac', arity: 3 },
  { prefix: 'integ(', kind: 'integ', arity: 3 },
  { prefix: 'sigma(', kind: 'sigma', arity: 3 },
  { prefix: 'deriv(', kind: 'deriv', arity: 2 },
  { prefix: 'prod(', kind: 'prod', arity: 3 },
  { prefix: 'frac(', kind: 'frac', arity: 2 },
  { prefix: 'sqrt(', kind: 'sqrt', arity: 1 },
  { prefix: 'cbrt(', kind: 'cbrt', arity: 1 },
  { prefix: 'root(', kind: 'root', arity: 2 },
  { prefix: 'logb(', kind: 'logb', arity: 2 },
  { prefix: 'abs(', kind: 'abs', arity: 1 },
  { prefix: '10^(', kind: 'pow', arity: 1 },
  { prefix: 'e^(', kind: 'pow', arity: 1 },
  { prefix: '^(', kind: 'pow', arity: 1 },
  { prefix: 'r(', kind: 'recur', arity: 1 },
];

export function parseTemplatesInRange(source: string, start: number, end: number): TemplateNode[] {
  const nodes: TemplateNode[] = [];
  let pos = start;
  while (pos < end) {
    const rest = source.slice(pos, end);
    let matched = false;
    for (const spec of TEMPLATE_SPECS) {
      if (rest.startsWith(spec.prefix)) {
        // Ensure 'r(' or 'e^(' is not the tail of another identifier
        if ((spec.kind === 'recur' || spec.prefix === 'e^(') && pos > start && /[a-zA-Z]/.test(source[pos - 1])) {
          continue;
        }
        // Ensure '10^(' is not the tail of a multi-digit number like '210^('
        if (spec.prefix === '10^(' && pos > start && /[0-9.]/.test(source[pos - 1])) {
          continue;
        }
        // Treat '^(-1)' as the atomic postfix reciprocal '⁻¹' rather than an editable box
        if (spec.prefix === '^(' && rest.startsWith('^(-1)')) {
          continue;
        }
        const openIdx = pos + spec.prefix.length - 1;
        const parsed = parseCallSpans(source, openIdx, spec.arity);
        if (parsed && parsed.afterIndex <= end) {
          const children: TemplateNode[] = [];
          for (const slot of parsed.args) {
            children.push(...parseTemplatesInRange(source, slot.start, slot.end));
          }
          nodes.push({
            kind: spec.kind,
            nodeStart: pos,
            openParen: openIdx,
            nodeEnd: parsed.afterIndex,
            slots: parsed.args,
            children,
          });
          pos = parsed.afterIndex;
          matched = true;
          break;
        }
      }
    }
    if (!matched) pos++;
  }
  return nodes;
}

export function flattenTemplates(nodes: TemplateNode[]): TemplateNode[] {
  const all: TemplateNode[] = [];
  const visit = (list: TemplateNode[]) => {
    for (const n of list) {
      all.push(n);
      visit(n.children);
    }
  };
  visit(nodes);
  return all;
}

/** Snaps any cursor that landed inside hidden template syntax (e.g. 'frac(' or ',') into a valid slot. */
export function normalizeMathCursor(source: string, cursor: number, lineMode: boolean): number {
  const bounded = Math.max(0, Math.min(source.length, cursor));
  if (lineMode) return bounded;
  const all = flattenTemplates(parseTemplatesInRange(source, 0, source.length));
  // Sort innermost first (smallest span)
  all.sort((a, b) => (a.nodeEnd - a.nodeStart) - (b.nodeEnd - b.nodeStart));
  for (const t of all) {
    if (bounded > t.nodeStart && bounded <= t.openParen) {
      return t.slots[0].start;
    }
    for (let k = 0; k + 1 < t.slots.length; k++) {
      if (bounded > t.slots[k].end && bounded < t.slots[k + 1].start) {
        return t.slots[k + 1].start;
      }
    }
  }
  return bounded;
}

/** Finds chain of templates whose slots contain `cursor` (from innermost to outermost). */
function enclosingSlotChain(
  all: TemplateNode[],
  cursor: number,
): Array<{ node: TemplateNode; slotIndex: number }> {
  const hits: Array<{ node: TemplateNode; slotIndex: number }> = [];
  for (const t of all) {
    for (let i = 0; i < t.slots.length; i++) {
      const s = t.slots[i];
      if (cursor >= s.start && cursor <= s.end) {
        hits.push({ node: t, slotIndex: i });
        break;
      }
    }
  }
  hits.sort((a, b) => (a.node.nodeEnd - a.node.nodeStart) - (b.node.nodeEnd - b.node.nodeStart));
  return hits;
}

export function isInsideTemplateSlot(
  source: string,
  cursor: number,
  lineMode: boolean,
): SlotSpan | null {
  if (lineMode) return null;
  const all = flattenTemplates(parseTemplatesInRange(source, 0, source.length));
  const chain = enclosingSlotChain(all, cursor);
  return chain.length > 0 ? chain[0].node.slots[chain[0].slotIndex] : null;
}

export function isSafeOverwriteAt(source: string, cursor: number, lineMode: boolean): boolean {
  if (cursor < 0 || cursor >= source.length) return false;
  if (lineMode) return true;
  const ch = source[cursor];
  if (ch === '(' || ch === ')' || ch === ',') return false;
  const all = flattenTemplates(parseTemplatesInRange(source, 0, source.length));
  for (const t of all) {
    if (cursor >= t.nodeStart && cursor <= t.openParen) return false;
    if (cursor === t.nodeEnd - 1) return false;
    for (const s of t.slots) {
      if (cursor === s.end) return false;
    }
  }
  return true;
}

export function handleSmartCloseParen(
  source: string,
  rawCursor: number,
  lineMode: boolean,
): { action: 'step'; cursor: number } | { action: 'insert' } {
  const cursor = normalizeMathCursor(source, rawCursor, lineMode);
  if (!lineMode) {
    const all = flattenTemplates(parseTemplatesInRange(source, 0, source.length));
    const chain = enclosingSlotChain(all, cursor);
    if (chain.length > 0) {
      const { node, slotIndex } = chain[0];
      const slot = node.slots[slotIndex];
      if (cursor < slot.end && source[cursor] === ')') {
        return { action: 'step', cursor: cursor + 1 };
      }
      if (cursor === slot.end) {
        if (slotIndex + 1 < node.slots.length) {
          return { action: 'step', cursor: node.slots[slotIndex + 1].start };
        }
        return { action: 'step', cursor: node.nodeEnd };
      }
      let depth = 0;
      for (let i = slot.start; i < cursor; i++) {
        if (source[i] === '(') depth++;
        else if (source[i] === ')') depth = Math.max(0, depth - 1);
      }
      if (depth === 0) {
        return { action: 'step', cursor: slot.end };
      }
      return { action: 'insert' };
    }
  }
  if (source[cursor] === ')') {
    const opens = [...source].filter((c) => c === '(').length;
    const closes = [...source].filter((c) => c === ')').length;
    if (opens <= closes) {
      return { action: 'step', cursor: cursor + 1 };
    }
  }
  return { action: 'insert' };
}

export function moveCursorHorizontal(
  source: string,
  rawCursor: number,
  dir: -1 | 1,
  lineMode: boolean,
  atomicSpans: Array<[number, number]>,
): number {
  const cursor = normalizeMathCursor(source, rawCursor, lineMode);
  if (lineMode) {
    if (dir === 1) {
      if (cursor >= source.length) return 0;
      const hit = atomicSpans.find(([s, e]) => cursor >= s && cursor < e);
      return hit ? hit[1] : cursor + 1;
    }
    if (cursor <= 0) return source.length;
    const hit = atomicSpans.find(([s, e]) => cursor > s && cursor <= e);
    return hit ? hit[0] : cursor - 1;
  }

  const all = flattenTemplates(parseTemplatesInRange(source, 0, source.length));
  const chain = enclosingSlotChain(all, cursor);

  if (dir === 1) {
    // 1) Standing right at the start of a 2D template -> enter its visually leftmost slot!
    const startingHere = all
      .filter((t) => t.nodeStart === cursor)
      .sort((a, b) => (b.nodeEnd - b.nodeStart) - (a.nodeEnd - a.nodeStart))[0];
    if (startingHere) {
      if (
        startingHere.kind === 'integ' ||
        startingHere.kind === 'sigma' ||
        startingHere.kind === 'prod'
      ) {
        const [, low, high] = startingHere.slots;
        if (low.start < low.end || high.start < high.end) {
          return low.start;
        }
      }
      return startingHere.slots[0].start;
    }

    // 2) Standing at the right end of an enclosing slot -> jump to next slot or exit template!
    for (const { node, slotIndex } of chain) {
      if (cursor === node.slots[slotIndex].end) {
        if (node.kind === 'integ' || node.kind === 'sigma' || node.kind === 'prod') {
          const [body, low, high] = node.slots;
          if (slotIndex === 0) {
            // From body: jump to lower/upper if still empty (initial entry), otherwise exit right after dx!
            if (low.start === low.end) return low.start;
            if (high.start === high.end) return high.start;
            return node.nodeEnd;
          }
          if (slotIndex === 1) return high.start;
          if (slotIndex === 2) return body.start === body.end ? body.start : node.nodeEnd;
        }
        if (slotIndex + 1 < node.slots.length) {
          return node.slots[slotIndex + 1].start;
        }
        return node.nodeEnd;
      }
    }

    // Wrap around from rightmost end of expression to start (0) like real Calcios hardware!
    if (cursor >= source.length) return 0;

    // 3) Step over atomic 1D token (e.g. 'sin(', 'Ans', '^2', '^3', '^(-1)', '⏨')
    const hit = atomicSpans.find(([s, e]) => cursor >= s && cursor < e);
    const nextPos = hit ? hit[1] : cursor + 1;
    return normalizeMathCursor(source, nextPos, false);
  }

  // dir === -1 (Left)
  // 1) Standing right after a 2D template -> enter the end of its visually rightmost slot!
  const endingHere = all
    .filter((t) => t.nodeEnd === cursor)
    .sort((a, b) => (b.nodeEnd - b.nodeStart) - (a.nodeEnd - a.nodeStart))[0];
  if (endingHere) {
    if (
      endingHere.kind === 'integ' ||
      endingHere.kind === 'sigma' ||
      endingHere.kind === 'prod'
    ) {
      return endingHere.slots[0].end; // body is visually rightmost!
    }
    return endingHere.slots[endingHere.slots.length - 1].end;
  }

  // 2) Standing at the left start of an enclosing slot -> jump to previous visual slot or before template!
  for (const { node, slotIndex } of chain) {
    if (cursor === node.slots[slotIndex].start) {
      if (node.kind === 'integ' || node.kind === 'sigma' || node.kind === 'prod') {
        const [, low, high] = node.slots;
        if (slotIndex === 0) return high.end;
        if (slotIndex === 2) return low.end;
        return node.nodeStart;
      }
      if (slotIndex > 0) {
        return node.slots[slotIndex - 1].end;
      }
      return node.nodeStart;
    }
  }

  // Wrap around from leftmost start (0) to end (source.length) like real Calcios hardware!
  if (cursor <= 0) return source.length;

  // 3) Step backward over atomic 1D token
  const hit = atomicSpans.find(([s, e]) => cursor > s && cursor <= e);
  const prevPos = hit ? hit[0] : cursor - 1;
  return normalizeMathCursor(source, prevPos, false);
}

/**
 * Moves cursor vertically (▲ / ▼) between 2D template levels (e.g. numerator <-> denominator,
 * integral limits <-> integrand, power <-> baseline, root index <-> radicand).
 * Returns `null` if no 2D template transition applies (allowing Replay History to handle ▲/▼).
 */
export function moveCursorVertical(
  source: string,
  rawCursor: number,
  dir: 'up' | 'down',
  lineMode: boolean,
): number | null {
  if (lineMode) return null;
  const cursor = normalizeMathCursor(source, rawCursor, false);
  const all = flattenTemplates(parseTemplatesInRange(source, 0, source.length));

  // Standing immediately AFTER a 2D template (`cursor === nodeEnd`)
  const afterNode = all
    .filter((t) => t.nodeEnd === cursor)
    .sort((a, b) => (b.nodeEnd - b.nodeStart) - (a.nodeEnd - a.nodeStart))[0];
  if (afterNode) {
    if (afterNode.kind === 'pow' && dir === 'up') return afterNode.slots[0].end;
    if (afterNode.kind === 'frac') {
      return dir === 'up' ? afterNode.slots[0].end : afterNode.slots[1].end;
    }
    if (afterNode.kind === 'mfrac') {
      return dir === 'up' ? afterNode.slots[1].end : afterNode.slots[2].end;
    }
    if (afterNode.kind === 'deriv') {
      return dir === 'up' ? afterNode.slots[0].end : afterNode.slots[1].end;
    }
    if (afterNode.kind === 'integ' || afterNode.kind === 'sigma' || afterNode.kind === 'prod') {
      return dir === 'up' ? afterNode.slots[2].end : afterNode.slots[1].end;
    }
  }

  // Standing immediately BEFORE a 2D template (`cursor === nodeStart`)
  const beforeNode = all
    .filter((t) => t.nodeStart === cursor)
    .sort((a, b) => (b.nodeEnd - b.nodeStart) - (a.nodeEnd - a.nodeStart))[0];
  if (beforeNode) {
    if (beforeNode.kind === 'pow' && dir === 'up') return beforeNode.slots[0].start;
    if (beforeNode.kind === 'frac') {
      return dir === 'up' ? beforeNode.slots[0].start : beforeNode.slots[1].start;
    }
    if (beforeNode.kind === 'mfrac') {
      return dir === 'up' ? beforeNode.slots[1].start : beforeNode.slots[2].start;
    }
    if (beforeNode.kind === 'deriv') {
      return dir === 'up' ? beforeNode.slots[0].start : beforeNode.slots[1].start;
    }
    if (beforeNode.kind === 'root') {
      return dir === 'up' ? beforeNode.slots[0].start : beforeNode.slots[1].start;
    }
    if (beforeNode.kind === 'logb') {
      return dir === 'up' ? beforeNode.slots[1].start : beforeNode.slots[0].start;
    }
    if (beforeNode.kind === 'integ' || beforeNode.kind === 'sigma' || beforeNode.kind === 'prod') {
      return dir === 'up' ? beforeNode.slots[2].start : beforeNode.slots[1].start;
    }
  }

  const chain = enclosingSlotChain(all, cursor);
  for (const { node, slotIndex } of chain) {
    switch (node.kind) {
      case 'frac': {
        const [num, den] = node.slots;
        if (slotIndex === 0 && dir === 'down') {
          const numLen = num.end - num.start;
          const denLen = den.end - den.start;
          if (numLen === 0 || cursor === num.end) return den.end;
          if (cursor === num.start) return den.start;
          return den.start + Math.round(((cursor - num.start) / numLen) * denLen);
        }
        if (slotIndex === 1 && dir === 'up') {
          const numLen = num.end - num.start;
          const denLen = den.end - den.start;
          if (denLen === 0 || cursor === den.end) return num.end;
          if (cursor === den.start) return num.start;
          return num.start + Math.round(((cursor - den.start) / denLen) * numLen);
        }
        break;
      }
      case 'mfrac': {
        const [, num, den] = node.slots;
        if (slotIndex === 0) return dir === 'up' ? num.start : den.start;
        if (slotIndex === 1 && dir === 'down') {
          const numLen = num.end - num.start;
          const denLen = den.end - den.start;
          if (numLen === 0 || cursor === num.end) return den.end;
          if (cursor === num.start) return den.start;
          return den.start + Math.round(((cursor - num.start) / numLen) * denLen);
        }
        if (slotIndex === 2 && dir === 'up') {
          const numLen = num.end - num.start;
          const denLen = den.end - den.start;
          if (denLen === 0 || cursor === den.end) return num.end;
          if (cursor === den.start) return num.start;
          return num.start + Math.round(((cursor - den.start) / denLen) * numLen);
        }
        break;
      }
      case 'pow': {
        if (dir === 'down') return node.nodeEnd;
        break;
      }
      case 'root': {
        if (slotIndex === 0 && dir === 'down') return node.slots[1].start;
        if (slotIndex === 1 && dir === 'up') return node.slots[0].end;
        break;
      }
      case 'logb': {
        if (slotIndex === 0 && dir === 'up') return node.slots[1].start;
        if (slotIndex === 1 && dir === 'down') return node.slots[0].end;
        break;
      }
      case 'deriv': {
        if (slotIndex === 0 && dir === 'down') return node.slots[1].end;
        if (slotIndex === 1 && dir === 'up') return node.slots[0].end;
        break;
      }
      case 'integ':
      case 'sigma':
      case 'prod': {
        // slots: [0: body, 1: lower, 2: upper]
        if (slotIndex === 0) return dir === 'down' ? node.slots[1].end : node.slots[2].end;
        if (slotIndex === 1 && dir === 'up') return node.slots[2].end;
        if (slotIndex === 2 && dir === 'down') return node.slots[1].end;
        break;
      }
      default:
        break;
    }
  }
  return null;
}

function isTemplateEmpty(node: TemplateNode): boolean {
  return node.slots.every((s) => s.start === s.end);
}

/**
 * Calcios-authentic DEL behavior that never corrupts internal template parentheses/commas.
 */
export function smartDeleteBeforeCursor(
  source: string,
  rawCursor: number,
  lineMode: boolean,
  atomicSpans: Array<[number, number]>,
): { expression: string; cursor: number } {
  const cursor = normalizeMathCursor(source, rawCursor, lineMode);
  if (cursor <= 0) return { expression: source, cursor: 0 };

  if (!lineMode) {
    const all = flattenTemplates(parseTemplatesInRange(source, 0, source.length));

    // 1) Standing right AFTER a 2D template (e.g. `frac(3,4)|` or `2^(3)|` or `10^()|`)
    const endingHere = all
      .filter((t) => t.nodeEnd === cursor)
      .sort((a, b) => (b.nodeEnd - b.nodeStart) - (a.nodeEnd - a.nodeStart))[0];
    if (endingHere) {
      if (isTemplateEmpty(endingHere)) {
        let delFrom = endingHere.nodeStart;
        if (endingHere.kind === 'recur') {
          const pre = source.slice(0, endingHere.nodeStart);
          if (/(?:^|[+\-−×÷*/^(,])0\.$/.test(pre)) delFrom -= 2;
          else if (/(?:^|[+\-−×÷*/^(,])\.$/.test(pre)) delFrom -= 1;
        }
        return {
          expression: source.slice(0, delFrom) + source.slice(endingHere.nodeEnd),
          cursor: delFrom,
        };
      }
      // Non-empty template: step cursor INSIDE the end of the visually rightmost slot (like Calcios hardware!)
      const lastVisualSlot =
        endingHere.kind === 'integ' || endingHere.kind === 'sigma' || endingHere.kind === 'prod'
          ? endingHere.slots[0]
          : endingHere.slots[endingHere.slots.length - 1];
      return {
        expression: source,
        cursor: lastVisualSlot.end,
      };
    }

    // 2) Standing at the very START of a slot inside a 2D template
    const chain = enclosingSlotChain(all, cursor);
    if (chain.length > 0) {
      const { node, slotIndex } = chain[0];
      if (cursor === node.slots[slotIndex].start) {
        // 2a) Entire template is empty -> delete the whole template cleanly!
        if (isTemplateEmpty(node)) {
          let delFrom = node.nodeStart;
          if (node.kind === 'recur') {
            const pre = source.slice(0, node.nodeStart);
            if (/(?:^|[+\-−×÷*/^(,])0\.$/.test(pre)) delFrom -= 2;
            else if (/(?:^|[+\-−×÷*/^(,])\.$/.test(pre)) delFrom -= 1;
          }
          return {
            expression: source.slice(0, delFrom) + source.slice(node.nodeEnd),
            cursor: delFrom,
          };
        }

        // 2b) Fraction with empty denominator (`frac(3, |)`) -> unwrap back to numerator `3|`!
        if (node.kind === 'frac' && slotIndex === 1 && node.slots[1].start === node.slots[1].end) {
          const numText = source.slice(node.slots[0].start, node.slots[0].end);
          return {
            expression: source.slice(0, node.nodeStart) + numText + source.slice(node.nodeEnd),
            cursor: node.nodeStart + numText.length,
          };
        }

        // 2c) Single-slot wrapper (`sqrt(|5)`, `cbrt(|5)`, `abs(|5)`, `^(|5)`, `10^(|5)`, `r(|3)`) -> unwrap keeping body!
        if (node.slots.length === 1 && slotIndex === 0) {
          const inner = source.slice(node.slots[0].start, node.slots[0].end);
          return {
            expression: source.slice(0, node.nodeStart) + inner + source.slice(node.nodeEnd),
            cursor: node.nodeStart,
          };
        }

        // 2d) Multi-slot template: move cursor to previous visual slot or before template without deleting ',' or '('
        if (node.kind === 'integ' || node.kind === 'sigma' || node.kind === 'prod') {
          if (slotIndex === 0) return { expression: source, cursor: node.slots[2].end };
          if (slotIndex === 2) return { expression: source, cursor: node.slots[1].end };
          return { expression: source, cursor: node.nodeStart };
        }
        if (slotIndex > 0) {
          return { expression: source, cursor: node.slots[slotIndex - 1].end };
        }
        return { expression: source, cursor: node.nodeStart };
      }

      // 2e) Inside a 2D slot: keep inner '(' and ')' pairs balanced so enclosing templates never break!
      const slot = node.slots[slotIndex];
      if (source[cursor - 1] === ')') {
        let depth = 0;
        let openIdx = -1;
        for (let i = cursor - 2; i >= slot.start; i--) {
          if (source[i] === ')') depth++;
          else if (source[i] === '(') {
            if (depth === 0) {
              openIdx = i;
              break;
            }
            depth--;
          }
        }
        if (openIdx !== -1) {
          const fnHit = atomicSpans.find(([s, e]) => e === openIdx + 1 && s >= slot.start);
          const delStart = fnHit ? fnHit[0] : openIdx;
          if (openIdx + 1 === cursor - 1) {
            return {
              expression: source.slice(0, delStart) + source.slice(cursor),
              cursor: delStart,
            };
          }
          return { expression: source, cursor: cursor - 1 };
        }
      }
    }
  }

  // Normal atomic or single-character deletion (with paired ')' cleanup if inside a 2D slot)
  const hit = atomicSpans.find(([s, e]) => cursor > s && cursor <= e);
  const delStart = hit ? hit[0] : cursor - 1;
  const delEnd = hit ? hit[1] : cursor;
  const deletedSlice = source.slice(delStart, delEnd);

  if (!lineMode && deletedSlice.endsWith('(')) {
    const slot = isInsideTemplateSlot(source, cursor, false);
    if (slot) {
      let depth = 0;
      let matchClose = -1;
      for (let i = delEnd; i < slot.end; i++) {
        if (source[i] === '(') depth++;
        else if (source[i] === ')') {
          if (depth === 0) {
            matchClose = i;
            break;
          }
          depth--;
        }
      }
      if (matchClose !== -1) {
        return {
          expression:
            source.slice(0, delStart) +
            source.slice(delEnd, matchClose) +
            source.slice(matchClose + 1),
          cursor: delStart,
        };
      }
    }
  }

  return {
    expression: source.slice(0, delStart) + source.slice(delEnd),
    cursor: delStart,
  };
}

/**
 * Extracts the immediately preceding operand span before `cursor` so pressing `■/□` (`frac`)
 * or `■ □/□` (`mfrac`) wraps `3` -> `frac(3,|)` or `(1+2)` -> `frac((1+2),|)` in MathIO.
 */
export function extractTrailingOperandSpan(
  source: string,
  cursor: number,
): { start: number; text: string } | null {
  if (cursor <= 0) return null;
  const before = source.slice(0, cursor);

  // 1) Completed 2D template ending right at `cursor`
  const all = flattenTemplates(parseTemplatesInRange(source, 0, cursor));
  const tplEnding = all
    .filter((t) => t.nodeEnd === cursor)
    .sort((a, b) => (b.nodeEnd - b.nodeStart) - (a.nodeEnd - a.nodeStart))[0];
  if (tplEnding) {
    // Include base if this template is a power `^(...)`!
    if (tplEnding.kind === 'pow') {
      const baseSpan = extractTrailingOperandSpan(source, tplEnding.nodeStart);
      const start = baseSpan ? baseSpan.start : tplEnding.nodeStart;
      return { start, text: source.slice(start, cursor) };
    }
    // Include integer/decimal prefix if this template is a recurring decimal `0.r(3)` / `12.58r(3)` / `.r(3)`!
    if (tplEnding.kind === 'recur') {
      const decPrefix = source.slice(0, tplEnding.nodeStart).match(/(?:\d+\.\d*|\.\d*)$/);
      const start = decPrefix ? tplEnding.nodeStart - decPrefix[0].length : tplEnding.nodeStart;
      return { start, text: source.slice(start, cursor) };
    }
    return { start: tplEnding.nodeStart, text: source.slice(tplEnding.nodeStart, cursor) };
  }

  // 2) Suffix ^2, ^3, ^(-1), !, %, °, ᵈ, ʳ, ᵍ attached to an operand
  for (const suf of ['^(-1)', '^2', '^3', '!', '%', '°', 'ᵈ', 'ʳ', 'ᵍ']) {
    if (before.endsWith(suf)) {
      const basePos = cursor - suf.length;
      const baseSpan = extractTrailingOperandSpan(source, basePos);
      const start = baseSpan ? baseSpan.start : basePos;
      return { start, text: source.slice(start, cursor) };
    }
  }

  // 3) Parenthesized expression `(...)` (optionally preceded by 1D function name like `sin(...)`)
  if (before.endsWith(')')) {
    let depth = 0;
    for (let i = cursor - 1; i >= 0; i--) {
      if (source[i] === ')') depth++;
      else if (source[i] === '(') {
        depth--;
        if (depth === 0) {
          let start = i;
          const fnPrefix = source.slice(0, i).match(/[a-zA-Z]+$/);
          if (fnPrefix) start -= fnPrefix[0].length;
          return { start, text: source.slice(start, cursor) };
        }
      }
    }
    return null;
  }

  // 4) Scientific notation, numeric literal, constant, Ans/PreAns, Ran#, Mat/Vct, or single variable
  const tailMatch = before.match(
    /(?:const(?:0[1-9]|[1-3]\d|40)|MatAns|Mat[ABC]|VctAns|Vct[ABC]|PreAns|Ans|Ran#|(?:\d+(?:\.\d*)?|\.\d+)?⏨[+-]?(?:\d+(?:\.\d*)?|\.\d+)|\d+(?:\.\d*)?|\.\d+|[A-FXYMπei])$/,
  );
  if (tailMatch) {
    const start = cursor - tailMatch[0].length;
    return { start, text: tailMatch[0] };
  }

  return null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { TableRow, TableColumn } from '@atlas-platform/shared';

// ─── Column letter mapping ──────────────────────────────────────────

export function colIndexToLetter(index: number): string {
  let result = '';
  let n = index;
  while (n >= 0) {
    result = String.fromCharCode((n % 26) + 65) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

export function letterToColIndex(letter: string): number {
  let result = 0;
  for (let i = 0; i < letter.length; i++) {
    result = result * 26 + (letter.charCodeAt(i) - 64);
  }
  return result - 1;
}

// ─── Cell reference parsing ─────────────────────────────────────────

interface CellRef {
  col: number; // 0-based column index
  row: number; // 0-based row index
}

interface RangeRef {
  start: CellRef;
  end: CellRef;
}

const CELL_REF_REGEX = /^\$?([A-Z]+)\$?(\d+)$/;
const RANGE_REF_REGEX = /^\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)$/;

function parseCellRef(ref: string): CellRef | null {
  const m = ref.match(CELL_REF_REGEX);
  if (!m) return null;
  return {
    col: letterToColIndex(m[1]),
    row: parseInt(m[2], 10) - 1, // Convert to 0-based
  };
}

function parseRangeRef(ref: string): RangeRef | null {
  const m = ref.match(RANGE_REF_REGEX);
  if (!m) return null;
  return {
    start: { col: letterToColIndex(m[1]), row: parseInt(m[2], 10) - 1 },
    end: { col: letterToColIndex(m[3]), row: parseInt(m[4], 10) - 1 },
  };
}

// ─── Get cell value from grid data ──────────────────────────────────

function getCellValue(
  col: number,
  row: number,
  data: TableRow[],
  colMap: string[],
): unknown {
  if (row < 0 || row >= data.length) return null;
  if (col < 0 || col >= colMap.length) return null;
  const colId = colMap[col];
  return data[row][colId] ?? null;
}

function getRangeValues(
  range: RangeRef,
  data: TableRow[],
  colMap: string[],
): unknown[] {
  const values: unknown[] = [];
  const minCol = Math.min(range.start.col, range.end.col);
  const maxCol = Math.max(range.start.col, range.end.col);
  const minRow = Math.min(range.start.row, range.end.row);
  const maxRow = Math.max(range.start.row, range.end.row);

  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      values.push(getCellValue(c, r, data, colMap));
    }
  }
  return values;
}

// ─── Built-in functions ─────────────────────────────────────────────

function toNumbers(values: unknown[]): number[] {
  return values
    .flat(Infinity)
    .map((v) => Number(v))
    .filter((n) => !isNaN(n));
}

const FUNCTIONS: Record<string, (...args: any[]) => any> = {
  SUM: (...args: any[]) => {
    const nums = toNumbers(args);
    return nums.reduce((a, b) => a + b, 0);
  },
  AVERAGE: (...args: any[]) => {
    const nums = toNumbers(args);
    return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
  },
  AVG: (...args: any[]) => FUNCTIONS.AVERAGE(...args),
  COUNT: (...args: any[]) => {
    return toNumbers(args).length;
  },
  COUNTA: (...args: any[]) => {
    return args.flat(Infinity).filter((v) => v != null && v !== '').length;
  },
  MIN: (...args: any[]) => {
    const nums = toNumbers(args);
    return nums.length > 0 ? Math.min(...nums) : 0;
  },
  MAX: (...args: any[]) => {
    const nums = toNumbers(args);
    return nums.length > 0 ? Math.max(...nums) : 0;
  },
  IF: (condition: any, trueVal: any, falseVal: any) => {
    return condition ? trueVal : falseVal;
  },
  CONCAT: (...args: any[]) => {
    return args.flat(Infinity).map(String).join('');
  },
  CONCATENATE: (...args: any[]) => FUNCTIONS.CONCAT(...args),
  LEN: (val: any) => String(val ?? '').length,
  UPPER: (val: any) => String(val ?? '').toUpperCase(),
  LOWER: (val: any) => String(val ?? '').toLowerCase(),
  TRIM: (val: any) => String(val ?? '').trim(),
  LEFT: (val: any, n: any) => String(val ?? '').slice(0, Number(n) || 1),
  RIGHT: (val: any, n: any) => { const s = String(val ?? ''); const len = Number(n) || 1; return s.slice(Math.max(0, s.length - len)); },
  MID: (val: any, start: any, n: any) => String(val ?? '').slice((Number(start) || 1) - 1, (Number(start) || 1) - 1 + (Number(n) || 1)),
  ABS: (val: any) => Math.abs(Number(val) || 0),
  ROUND: (val: any, decimals: any) => {
    const n = Number(val) || 0;
    const d = Number(decimals) || 0;
    const factor = Math.pow(10, d);
    return Math.round(n * factor) / factor;
  },
  FLOOR: (val: any) => Math.floor(Number(val) || 0),
  CEILING: (val: any) => Math.ceil(Number(val) || 0),
  POWER: (base: any, exp: any) => Math.pow(Number(base) || 0, Number(exp) || 0),
  SQRT: (val: any) => Math.sqrt(Number(val) || 0),
  NOW: () => new Date().toISOString(),
  TODAY: () => new Date().toISOString().split('T')[0],
  YEAR: (val: any) => { const d = new Date(String(val)); if (isNaN(d.getTime())) throw new Error('#VALUE!'); return d.getFullYear(); },
  MONTH: (val: any) => { const d = new Date(String(val)); if (isNaN(d.getTime())) throw new Error('#VALUE!'); return d.getMonth() + 1; },
  DAY: (val: any) => { const d = new Date(String(val)); if (isNaN(d.getTime())) throw new Error('#VALUE!'); return d.getDate(); },
};

// ─── Formula tokenizer & evaluator ─────────────────────────────────

type Token =
  | { type: 'number'; value: number }
  | { type: 'string'; value: string }
  | { type: 'boolean'; value: boolean }
  | { type: 'cellRef'; value: string }
  | { type: 'rangeRef'; value: string }
  | { type: 'function'; value: string }
  | { type: 'operator'; value: string }
  | { type: 'paren'; value: string }
  | { type: 'comma'; value: ',' }
  | { type: 'colon'; value: ':' };

function tokenize(formula: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < formula.length) {
    const ch = formula[i];

    // Skip whitespace
    if (/\s/.test(ch)) { i++; continue; }

    // String literal
    if (ch === '"') {
      let str = '';
      i++;
      while (i < formula.length && formula[i] !== '"') {
        str += formula[i];
        i++;
      }
      if (i >= formula.length) throw new Error('#VALUE!');
      i++; // skip closing quote
      tokens.push({ type: 'string', value: str });
      continue;
    }

    // Number
    if (/\d/.test(ch) || (ch === '.' && i + 1 < formula.length && /\d/.test(formula[i + 1]))) {
      let num = '';
      while (i < formula.length && (/\d/.test(formula[i]) || formula[i] === '.')) {
        num += formula[i];
        i++;
      }
      tokens.push({ type: 'number', value: parseFloat(num) });
      continue;
    }

    // Function name or cell/range reference or boolean
    if (/[A-Za-z$_]/.test(ch)) {
      let name = '';
      while (i < formula.length && /[A-Za-z0-9$_]/.test(formula[i])) {
        name += formula[i];
        i++;
      }

      // Check for TRUE/FALSE
      if (name.toUpperCase() === 'TRUE') { tokens.push({ type: 'boolean', value: true }); continue; }
      if (name.toUpperCase() === 'FALSE') { tokens.push({ type: 'boolean', value: false }); continue; }

      // Check if it's followed by a colon (range reference start)
      if (i < formula.length && formula[i] === ':') {
        // This is the start of a range reference
        const startRef = name;
        i++; // skip colon
        let endRef = '';
        while (i < formula.length && /[A-Za-z0-9$]/.test(formula[i])) {
          endRef += formula[i];
          i++;
        }
        tokens.push({ type: 'rangeRef', value: `${startRef}:${endRef}` });
        continue;
      }

      // Check if next char is '(' → function
      if (i < formula.length && formula[i] === '(') {
        tokens.push({ type: 'function', value: name.toUpperCase() });
        continue;
      }

      // Cell reference
      if (/^\$?[A-Z]+\$?\d+$/i.test(name)) {
        tokens.push({ type: 'cellRef', value: name.toUpperCase() });
        continue;
      }

      // Unknown identifier — treat as string
      tokens.push({ type: 'string', value: name });
      continue;
    }

    // Operators
    if ('+-*/'.includes(ch)) {
      tokens.push({ type: 'operator', value: ch });
      i++;
      continue;
    }

    // Comparison operators
    if (ch === '>' || ch === '<' || ch === '=') {
      let op = ch;
      i++;
      if (i < formula.length && (formula[i] === '=' || (ch === '<' && formula[i] === '>'))) {
        op += formula[i];
        i++;
      }
      tokens.push({ type: 'operator', value: op });
      continue;
    }

    if (ch === '!' && i + 1 < formula.length && formula[i + 1] === '=') {
      tokens.push({ type: 'operator', value: '!=' });
      i += 2;
      continue;
    }

    // Parentheses
    if (ch === '(' || ch === ')') {
      tokens.push({ type: 'paren', value: ch });
      i++;
      continue;
    }

    // Comma
    if (ch === ',') {
      tokens.push({ type: 'comma', value: ',' });
      i++;
      continue;
    }

    // Colon (standalone)
    if (ch === ':') {
      tokens.push({ type: 'colon', value: ':' });
      i++;
      continue;
    }

    // Skip unknown
    i++;
  }

  return tokens;
}

// ─── Recursive descent parser / evaluator ───────────────────────────

interface EvalContext {
  data: TableRow[];
  colMap: string[]; // index → column UUID
  currentRow: number;
  evaluating: Set<string>; // circular reference detection
}

function evaluate(tokens: Token[], ctx: EvalContext): any {
  let pos = 0;

  function peek(): Token | undefined { return tokens[pos]; }
  function advance(): Token { return tokens[pos++]; }

  function parseExpression(): any {
    return parseComparison();
  }

  function parseComparison(): any {
    let left = parseAddSub();
    while (peek()?.type === 'operator' && ['>', '<', '>=', '<=', '=', '==', '!=', '<>'].includes(peek()!.value as string)) {
      const op = (advance() as { value: string }).value;
      const right = parseAddSub();
      switch (op) {
        case '>': left = left > right; break;
        case '<': left = left < right; break;
        case '>=': left = left >= right; break;
        case '<=': left = left <= right; break;
        case '=': case '==': left = left == right; break;
        case '!=': case '<>': left = left != right; break;
      }
    }
    return left;
  }

  function parseAddSub(): any {
    let left = parseMulDiv();
    while (peek()?.type === 'operator' && (peek()!.value === '+' || peek()!.value === '-')) {
      const op = (advance() as { value: string }).value;
      const right = parseMulDiv();
      if (op === '+') {
        // String concatenation if either is string
        if (typeof left === 'string' || typeof right === 'string') {
          left = String(left ?? '') + String(right ?? '');
        } else {
          left = (Number(left) || 0) + (Number(right) || 0);
        }
      } else {
        left = (Number(left) || 0) - (Number(right) || 0);
      }
    }
    return left;
  }

  function parseMulDiv(): any {
    let left = parseUnary();
    while (peek()?.type === 'operator' && (peek()!.value === '*' || peek()!.value === '/')) {
      const op = (advance() as { value: string }).value;
      const right = parseUnary();
      if (op === '*') {
        left = (Number(left) || 0) * (Number(right) || 0);
      } else {
        const denom = Number(right) || 0;
        if (denom === 0) throw new Error('#DIV/0!');
        left = (Number(left) || 0) / denom;
      }
    }
    return left;
  }

  function parseUnary(): any {
    if (peek()?.type === 'operator' && peek()!.value === '-') {
      advance();
      return -(Number(parsePrimary()) || 0);
    }
    if (peek()?.type === 'operator' && peek()!.value === '+') {
      advance();
      return Number(parsePrimary()) || 0;
    }
    return parsePrimary();
  }

  function parsePrimary(): any {
    const t = peek();
    if (!t) throw new Error('#VALUE!');

    switch (t.type) {
      case 'number':
        advance();
        return t.value;

      case 'string':
        advance();
        return t.value;

      case 'boolean':
        advance();
        return t.value;

      case 'cellRef': {
        advance();
        const ref = parseCellRef(t.value);
        if (!ref) throw new Error('#REF!');
        const val = getCellValue(ref.col, ref.row, ctx.data, ctx.colMap);
        // If the referenced cell is a formula, evaluate it
        if (typeof val === 'string' && val.startsWith('=')) {
          const cellKey = `${ref.row}:${ref.col}`;
          if (ctx.evaluating.has(cellKey)) throw new Error('#CIRCULAR!');
          ctx.evaluating.add(cellKey);
          try {
            return evaluateFormula(val, ref.row, ctx.data, ctx.colMap, ctx.evaluating);
          } finally {
            ctx.evaluating.delete(cellKey);
          }
        }
        // Try to return as number if possible
        if (val != null && val !== '' && !isNaN(Number(val))) return Number(val);
        return val;
      }

      case 'rangeRef': {
        advance();
        const range = parseRangeRef(t.value);
        if (!range) throw new Error('#REF!');
        return getRangeValues(range, ctx.data, ctx.colMap);
      }

      case 'function': {
        const fnName = t.value as string;
        advance(); // function name
        // Expect '('
        if (peek()?.type !== 'paren' || peek()?.value !== '(') throw new Error('#NAME?');
        advance(); // skip '('

        const args: any[] = [];
        if (peek()?.type !== 'paren' || peek()?.value !== ')') {
          args.push(parseExpression());
          while (peek()?.type === 'comma') {
            advance(); // skip comma
            args.push(parseExpression());
          }
        }
        // Expect ')'
        if (peek()?.type !== 'paren' || peek()?.value !== ')') throw new Error('#VALUE!');
        advance(); // skip ')'

        const fn = FUNCTIONS[fnName];
        if (!fn) throw new Error('#NAME?');
        return fn(...args);
      }

      case 'paren': {
        if (t.value === '(') {
          advance(); // skip '('
          const val = parseExpression();
          if (peek()?.type !== 'paren' || peek()?.value !== ')') throw new Error('#VALUE!');
          advance(); // skip ')'
          return val;
        }
        throw new Error('#VALUE!');
      }

      default:
        advance();
        throw new Error('#VALUE!');
    }
  }

  const result = parseExpression();
  return result;
}

// ─── Public API ─────────────────────────────────────────────────────

export function evaluateFormula(
  formula: string,
  rowIndex: number,
  data: TableRow[],
  colMap: string[],
  evaluating?: Set<string>,
): any {
  try {
    // Strip the leading '='
    const expr = formula.startsWith('=') ? formula.slice(1) : formula;
    if (!expr.trim()) return '';

    const tokens = tokenize(expr);
    const ctx: EvalContext = {
      data,
      colMap,
      currentRow: rowIndex,
      evaluating: evaluating || new Set(),
    };

    return evaluate(tokens, ctx);
  } catch (err: any) {
    return err.message || '#ERROR!';
  }
}

export function buildColMap(columns: TableColumn[]): string[] {
  return columns.map((c) => c.id);
}

export function isFormulaValue(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith('=');
}

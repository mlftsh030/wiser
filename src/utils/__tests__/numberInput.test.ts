import { describe, expect, it } from 'vitest';
import {
  formatForInput,
  formatPercentForInput,
  parseAmount,
  parsePercentInput,
} from '../numberInput';

/**
 * Simulates typing into the field character by character.
 *
 * `controlled` reproduces the old behaviour, where the box re-derived its text
 * from the stored number on every keystroke. `editable` reproduces the current
 * behaviour, where the box keeps what was typed while it has focus.
 *
 * Returning both the text on screen and the value the parent holds is what
 * lets these tests assert the thing that actually matters: whether the customer
 * can reach the number they meant.
 */
function type(
  text: string,
  mode: 'controlled' | 'editable',
  format: (value: number) => string,
  parse: (raw: string) => number | null,
): { shown: string; stored: number | null } {
  let stored: number | null = null;
  let shown = '';

  for (const character of text) {
    const typed = shown + character;
    stored = parse(typed);
    shown = mode === 'controlled' ? (stored === null ? '' : format(stored)) : typed;
  }

  return { shown, stored };
}

const typePercent = (text: string, mode: 'controlled' | 'editable') =>
  type(text, mode, formatPercentForInput, parsePercentInput);

describe('typing a decimal interest rate', () => {
  it('lets the customer type 10.76', () => {
    const { shown, stored } = typePercent('10.76', 'editable');
    expect(shown).toBe('10.76');
    expect(stored).toBeCloseTo(0.1076, 10);
  });

  it('regression: the old controlled field swallowed the decimal point', () => {
    // Typing "10.76" produced 1076%, because parsing "10." gave 10, which
    // redisplayed as "10" and erased the point as soon as it was typed. This
    // test documents the bug so the behaviour cannot quietly return.
    const { stored } = typePercent('10.76', 'controlled');
    expect(stored).toBeCloseTo(10.76, 10);
    expect(stored).not.toBeCloseTo(0.1076, 10);
  });

  it('accepts the decimal rates a customer is actually quoted', () => {
    for (const [text, expected] of [
      ['10.76', 0.1076],
      ['10.75', 0.1075],
      ['11.25', 0.1125],
      ['9.5', 0.095],
      ['12', 0.12],
      ['7.05', 0.0705],
    ] as const) {
      const { shown, stored } = typePercent(text, 'editable');
      expect(shown, text).toBe(text);
      expect(stored, text).toBeCloseTo(expected, 10);
    }
  });

  it('keeps a trailing zero visible while it is being typed', () => {
    // "10.50" must survive on screen: rewriting it to "10.5" mid-entry moves
    // the caret and is what makes a field feel broken.
    const { shown, stored } = typePercent('10.50', 'editable');
    expect(shown).toBe('10.50');
    expect(stored).toBeCloseTo(0.105, 10);
  });

  it('tidies the display only once the field is left', () => {
    // On blur the draft is dropped and the stored value is formatted.
    expect(formatPercentForInput(0.105)).toBe('10.5');
    expect(formatPercentForInput(0.1076)).toBe('10.76');
  });

  it('does not reintroduce floating point noise', () => {
    // 0.1076 * 100 is 10.760000000000002 without the rounding step.
    expect(formatPercentForInput(0.1076)).toBe('10.76');
    expect(formatPercentForInput(0.0705)).toBe('7.05');
  });

  it('round-trips every whole and half percent in range', () => {
    for (let percent = 1; percent <= 35; percent += 0.5) {
      const text = String(percent);
      const stored = parsePercentInput(text);
      expect(stored, text).not.toBeNull();
      expect(formatPercentForInput(stored as number), text).toBe(text);
    }
  });
});

describe('partial and empty entries', () => {
  it('treats an empty field as no answer', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('   ')).toBeNull();
  });

  it('treats a lone separator as no answer rather than zero', () => {
    // Number('.') is 0, which would show a figure the customer never typed.
    for (const partial of ['.', '-', '-.']) {
      expect(parseAmount(partial), partial).toBeNull();
      expect(parsePercentInput(partial), partial).toBeNull();
    }
  });

  it('parses a value that is still mid-decimal', () => {
    expect(parseAmount('10.')).toBe(10);
    expect(parsePercentInput('10.')).toBeCloseTo(0.1, 10);
  });

  it('rejects text that is not a number', () => {
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('10a')).toBeNull();
  });
});

describe('currency entry', () => {
  it('accepts the separators people actually paste', () => {
    expect(parseAmount('R1 800 000')).toBe(1_800_000);
    expect(parseAmount('1,800,000')).toBe(1_800_000);
    expect(parseAmount('R60000')).toBe(60_000);
  });

  it('lets the customer type an amount with cents', () => {
    const { shown, stored } = type('1500.50', 'editable', formatForInput, parseAmount);
    expect(shown).toBe('1500.50');
    expect(stored).toBeCloseTo(1500.5, 10);
  });

  it('groups whole amounts but leaves decimals alone', () => {
    expect(formatForInput(1_800_000)).toBe('1 800 000'.replace(/ /g, ' '));
    expect(formatForInput(1500.5)).toBe('1500.5');
  });

  it('keeps zero distinct from an empty field', () => {
    // "I have no debt" is a real answer and must not read as unanswered.
    expect(parseAmount('0')).toBe(0);
    expect(parseAmount('')).toBeNull();
  });
});

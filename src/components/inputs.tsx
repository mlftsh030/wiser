/**
 * Form inputs.
 *
 * Every control is a real labelled form element so that screen readers and
 * keyboard users get the journey for free. Errors are wired with
 * aria-describedby and announced, never conveyed by colour alone.
 */

import { useId, useState, type ReactNode } from 'react';
import {
  formatForInput,
  formatPercentForInput,
  parseAmount,
  parsePercentInput,
} from '../utils/numberInput';

interface FieldProps {
  label: string;
  why?: ReactNode;
  error?: string;
  children: (props: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
}

function Field({ label, why, error, children }: FieldProps) {
  const id = useId();
  const whyId = `${id}-why`;
  const errorId = `${id}-error`;
  const describedBy = [why ? whyId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {why ? (
        <p className="field__why" id={whyId}>
          {why}
        </p>
      ) : null}
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error ? (
        <p className="field__error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Keeps a numeric field editable while it is being typed into.
 *
 * A controlled input that re-derives its text from the stored number on every
 * keystroke cannot accept a decimal. Typing "10.76" parses "10." to 10, which
 * renders as "10", which deletes the point the moment it is typed: the field
 * ends up holding 1076. The same applies to a trailing zero ("10.50") and to a
 * lone "." or "-" at the start of an entry.
 *
 * So while the field has focus we show exactly what the user typed and report
 * the parsed value upwards. When it loses focus we drop back to the formatted
 * value, which is where "10.50" tidies to "10.5". The parent still holds a
 * number throughout, so nothing downstream changes.
 */
function useEditableNumber(
  value: number | null,
  format: (value: number) => string,
  parse: (raw: string) => number | null,
  onChange: (value: number | null) => void,
) {
  // null means "not being edited": show the formatted stored value.
  const [draft, setDraft] = useState<string | null>(null);

  return {
    value: draft ?? (value === null ? '' : format(value)),
    onChange: (event: { target: { value: string } }) => {
      const raw = event.target.value;
      setDraft(raw);
      onChange(parse(raw));
    },
    onBlur: () => setDraft(null),
  };
}

/**
 * Currency input.
 *
 * inputMode="decimal" gives phones a numeric keypad while still allowing the
 * field to be cleared - type="number" makes empty-vs-zero ambiguous, which
 * matters when 0 is a meaningful answer ("I have no debt").
 */
export function CurrencyInput({
  label,
  why,
  error,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  why?: ReactNode;
  error?: string;
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
}) {
  const field = useEditableNumber(value, formatForInput, parseAmount, onChange);

  return (
    <Field label={label} why={why} error={error}>
      {({ id, describedBy, invalid }) => (
        <div className={`input-wrap${invalid ? ' input-wrap--invalid' : ''}`}>
          <span className="input-wrap__prefix" aria-hidden="true">
            R
          </span>
          <input
            id={id}
            className="input"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={field.value}
            placeholder={placeholder}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            onChange={field.onChange}
            onBlur={field.onBlur}
          />
        </div>
      )}
    </Field>
  );
}

export function PercentInput({
  label,
  why,
  error,
  value,
  onChange,
  disabled,
}: {
  label: string;
  why?: ReactNode;
  error?: string;
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
}) {
  // Stored as a fraction, entered and shown as a percentage. Rounding at two
  // decimals is what keeps 10.76 from redisplaying as 10.760000000000001.
  const field = useEditableNumber(value, formatPercentForInput, parsePercentInput, onChange);

  return (
    <Field label={label} why={why} error={error}>
      {({ id, describedBy, invalid }) => (
        <div className={`input-wrap${invalid ? ' input-wrap--invalid' : ''}`}>
          <input
            id={id}
            className="input"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            disabled={disabled}
            value={field.value}
            placeholder="10.75"
            aria-describedby={describedBy}
            aria-invalid={invalid}
            onChange={field.onChange}
            onBlur={field.onBlur}
          />
          <span className="input-wrap__suffix" aria-hidden="true">
            %
          </span>
        </div>
      )}
    </Field>
  );
}

export interface Choice<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

/** Radio group rendered as cards - large tap targets, real radio semantics. */
export function ChoiceGroup<T extends string>({
  legend,
  why,
  error,
  options,
  value,
  onChange,
  columns = 1,
}: {
  legend: string;
  why?: ReactNode;
  error?: string;
  options: Choice<T>[];
  value: T | null;
  onChange: (value: T) => void;
  columns?: 1 | 2;
}) {
  const name = useId();
  const whyId = `${name}-why`;
  const errorId = `${name}-error`;

  return (
    <fieldset
      className="field"
      aria-describedby={[why ? whyId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined}
    >
      <legend className="field__label">{legend}</legend>
      {why ? (
        <p className="field__why" id={whyId}>
          {why}
        </p>
      ) : null}
      <div className={`choices choices--${columns}`}>
        {options.map((option) => (
          <label
            key={option.value}
            className={`choice${value === option.value ? ' choice--selected' : ''}`}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span className="choice__body">
              <span className="choice__label">{option.label}</span>
              {option.hint ? <span className="choice__hint">{option.hint}</span> : null}
            </span>
          </label>
        ))}
      </div>
      {error ? (
        <p className="field__error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

/** Multi-select checkboxes, same card treatment as ChoiceGroup. */
export function MultiChoiceGroup<T extends string>({
  legend,
  why,
  options,
  values,
  onChange,
}: {
  legend: string;
  why?: ReactNode;
  options: Choice<T>[];
  values: T[];
  onChange: (values: T[]) => void;
}) {
  const whyId = useId();

  return (
    <fieldset className="field" aria-describedby={why ? whyId : undefined}>
      <legend className="field__label">{legend}</legend>
      {why ? (
        <p className="field__why" id={whyId}>
          {why}
        </p>
      ) : null}
      <div className="choices choices--2">
        {options.map((option) => {
          const selected = values.includes(option.value);
          return (
            <label
              key={option.value}
              className={`choice${selected ? ' choice--selected' : ''}`}
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={() =>
                  onChange(
                    selected
                      ? values.filter((v) => v !== option.value)
                      : [...values, option.value],
                  )
                }
              />
              <span className="choice__body">
                <span className="choice__label">{option.label}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** 1-5 scale. A slider on its own is hard to read, so the value is always named. */
export function ScaleInput({
  label,
  why,
  value,
  onChange,
  lowLabel,
  highLabel,
}: {
  label: string;
  why?: ReactNode;
  value: number;
  onChange: (value: number) => void;
  lowLabel: string;
  highLabel: string;
}) {
  const id = useId();
  const whyId = `${id}-why`;
  const labels = [lowLabel, '', 'Somewhere in between', '', highLabel];

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {why ? (
        <p className="field__why" id={whyId}>
          {why}
        </p>
      ) : null}
      <div className="scale">
        <input
          id={id}
          className="scale__input"
          type="range"
          min={1}
          max={5}
          step={1}
          value={value}
          aria-describedby={why ? whyId : undefined}
          aria-valuetext={labels[value - 1] || `${value} of 5`}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <div className="scale__ends" aria-hidden="true">
          <span>{lowLabel}</span>
          <span>{highLabel}</span>
        </div>
        <p className="scale__value" aria-live="polite">
          {labels[value - 1] || `${value} of 5`}
        </p>
      </div>
    </div>
  );
}

// --- parsing helpers -------------------------------------------------------



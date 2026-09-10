/**
 * Shared presentational components.
 *
 * Deliberately small and unopinionated about finance: they render what they
 * are given. Any figure or judgement shown here was calculated upstream.
 */

import type { ReactNode } from 'react';

export function Button({
  children,
  onClick,
  variant = 'primary',
  type = 'button',
  disabled,
  fullWidth,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'quiet';
  type?: 'button' | 'submit';
  disabled?: boolean;
  fullWidth?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`btn btn--${variant}${fullWidth ? ' btn--full' : ''}`}
    >
      {children}
    </button>
  );
}

export function Card({
  children,
  tone = 'default',
  className = '',
}: {
  children: ReactNode;
  tone?: 'default' | 'sunken' | 'positive' | 'caution' | 'warning';
  className?: string;
}) {
  return <div className={`card card--${tone} ${className}`.trim()}>{children}</div>;
}

/**
 * A labelled 0-10 meter.
 *
 * The numeric value and a word are always shown alongside the bar, so the
 * meaning never depends on being able to see or distinguish the colour.
 */
export function ScoreMeter({
  label,
  score,
  description,
}: {
  label: string;
  score: number;
  description?: string;
}) {
  const band = score >= 7 ? 'positive' : score >= 4.5 ? 'caution' : 'warning';
  const word = score >= 7 ? 'Strong' : score >= 4.5 ? 'Moderate' : 'Limited';

  return (
    <div className="meter">
      <div className="meter__head">
        <span className="meter__label">{label}</span>
        <span className="meter__value">
          {score.toFixed(1)} <span className="meter__max">/ 10</span>
        </span>
      </div>
      <div
        className={`meter__track meter__track--${band}`}
        role="meter"
        aria-valuenow={Number(score.toFixed(1))}
        aria-valuemin={0}
        aria-valuemax={10}
        aria-label={`${label}: ${score.toFixed(1)} out of 10, ${word}`}
      >
        <div className="meter__fill" style={{ width: `${Math.max(score, 0) * 10}%` }} />
      </div>
      <div className="meter__foot">
        <span className={`tag tag--${band}`}>{word}</span>
        {description ? <span className="meter__description">{description}</span> : null}
      </div>
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'positive' | 'caution' | 'warning';
}) {
  return (
    <div className={`stat stat--${tone}`}>
      <dt className="stat__label">{label}</dt>
      <dd className="stat__value">{value}</dd>
      {hint ? <dd className="stat__hint">{hint}</dd> : null}
    </div>
  );
}

/** An expandable section - the mechanism behind progressive disclosure. */
export function Disclosure({
  summary,
  children,
  defaultOpen = false,
}: {
  summary: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="disclosure" open={defaultOpen}>
      <summary className="disclosure__summary">{summary}</summary>
      <div className="disclosure__body">{children}</div>
    </details>
  );
}

/** The "why we ask" note that accompanies every question. */
export function WhyNote({ children }: { children: ReactNode }) {
  return <p className="why">{children}</p>;
}

export function Callout({
  title,
  children,
  tone = 'default',
}: {
  title: string;
  children: ReactNode;
  tone?: 'default' | 'positive' | 'caution' | 'warning';
}) {
  return (
    <div className={`callout callout--${tone}`}>
      <h3 className="callout__title">{title}</h3>
      <div className="callout__body">{children}</div>
    </div>
  );
}

/**
 * Journey progress.
 *
 * Shows both a step count and named dots, so the customer always knows where
 * they are and roughly how much is left. The text is the source of truth; the
 * dots are decoration and hidden from assistive tech.
 */
export function ProgressIndicator({
  current,
  total,
  title,
}: {
  current: number;
  total: number;
  title: string;
}) {
  return (
    <div className="progress">
      <div className="progress__text">
        <span className="progress__step">
          Step {current} of {total}
        </span>
        <span className="progress__title">{title}</span>
      </div>
      <ol className="progress__dots" aria-hidden="true">
        {Array.from({ length: total }, (_, index) => (
          <li
            key={index}
            className={`progress__dot${index < current ? ' progress__dot--done' : ''}${
              index === current - 1 ? ' progress__dot--active' : ''
            }`}
          />
        ))}
      </ol>
    </div>
  );
}

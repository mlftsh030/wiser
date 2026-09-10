import { Button } from '../components/ui';

export function WelcomePage({ onStart }: { onStart: () => void }) {
  return (
    <div className="step-enter welcome">
      <p className="eyebrow">Buy vs rent</p>
      <h1 className="welcome__title">Could buying a home be the right move for you?</h1>
      <p className="welcome__lede">
        Buying a home is more than comparing a mortgage payment with rent. Your savings, debt,
        future plans and tolerance for financial uncertainty all matter.
      </p>

      <ol className="welcome__steps">
        <li>
          <span className="welcome__step-label">First</span>
          We ask about where you are today - your income, your commitments and your savings.
        </li>
        <li>
          <span className="welcome__step-label">Then</span>
          We look at the home you have in mind and what owning it would really cost.
        </li>
        <li>
          <span className="welcome__step-label">Finally</span>
          We compare buying and renting over the time you expect to stay, test it against
          different futures, and show you what is driving the answer.
        </li>
      </ol>

      <Button onClick={onStart} fullWidth>
        Let's understand your situation
      </Button>

      <p className="welcome__meta">
        Takes about three minutes. We do not ask for your name, ID number or any contact details.
      </p>
    </div>
  );
}

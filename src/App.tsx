import { useCallback, useMemo, useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ProgressIndicator } from './components/ProgressIndicator';
import { Button } from './components/ui';
import { toAssessment, useAssessmentJourney, type JourneyDraft } from './hooks/useAssessmentJourney';
import type { ReportModel } from './models/results';
import { FinancingPage } from './pages/FinancingPage';
import { FuturePage } from './pages/FuturePage';
import { HomePage } from './pages/HomePage';
import { PrioritiesPage } from './pages/PrioritiesPage';
import { ResultPage } from './pages/ResultPage';
import { SituationPage } from './pages/SituationPage';
import { WelcomePage } from './pages/WelcomePage';
import { downloadReportPdf } from './services/report';
import { buildReport } from './services/reportBuilder';
import { SpreadsheetRepository } from './services/storage/SpreadsheetRepository';
import {
  hasErrors,
  validateFinancing,
  validateHome,
  validateSituation,
  type ValidationErrors,
} from './utils/validation';
import './styles/global.css';
import './styles/app.css';

/**
 * The internal assessment record. Writing it is best effort and deliberately
 * invisible to the customer: it is our analytics record, not their result.
 */
const repository = new SpreadsheetRepository();

export default function App() {
  const journey = useAssessmentJourney();
  const { step, draft, update, next, back, restart, progress } = journey;

  const [errors, setErrors] = useState<ValidationErrors>({});
  const [report, setReport] = useState<ReportModel | null>(null);
  const [status, setStatus] = useState<'idle' | 'calculating' | 'error'>('idle');
  const [downloadState, setDownloadState] = useState<'idle' | 'working' | 'error'>('idle');

  /** Validation is per-step, so a customer is never blocked by a later page. */
  const validateStep = useCallback((): ValidationErrors => {
    switch (step.id) {
      case 'situation':
        return validateSituation(draft);
      case 'home':
        return validateHome(draft);
      case 'financing':
        return validateFinancing(draft);
      case 'future':
        return validateFuture(draft);
      default:
        return {};
    }
  }, [step.id, draft]);

  const handleNext = useCallback(async () => {
    const found = validateStep();
    setErrors(found);
    if (hasErrors(found)) {
      // Move focus to the first problem so keyboard and screen-reader users
      // are taken to it rather than left guessing.
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>('[aria-invalid="true"], .field__error')?.
          scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
      return;
    }

    // The priorities page is the last question, so completing it runs the engine.
    if (step.id === 'priorities') {
      setStatus('calculating');
      try {
        const assessment = toAssessment(draft);
        const built = await buildReport(assessment);
        setReport(built);
        // The internal record is Lens 2. It is written after the report exists
        // and is never awaited, so a slow or unavailable spreadsheet cannot
        // delay the customer's result or their PDF.
        void repository.save(built).then((outcome) => {
          if (outcome.status === 'failed') {
            console.warn('Assessment record was not stored:', outcome.reason);
          }
        });
        setStatus('idle');
        next();
      } catch (error) {
        console.error('Failed to build report', error);
        setStatus('error');
      }
      return;
    }

    next();
  }, [validateStep, step.id, draft, next]);

  const handleDownload = useCallback(async () => {
    if (!report) return;
    setDownloadState('working');
    try {
      // Built from the report already on screen, so the PDF cannot show a
      // different number from the one the customer just read.
      await downloadReportPdf(report);
      setDownloadState('idle');
    } catch (error) {
      console.error('Failed to generate the PDF report', error);
      setDownloadState('error');
    }
  }, [report]);

  const handleRestart = useCallback(() => {
    setReport(null);
    setErrors({});
    setStatus('idle');
    setDownloadState('idle');
    restart();
  }, [restart]);

  const content = useMemo(() => {
    switch (step.id) {
      case 'welcome':
        return <WelcomePage onStart={next} />;
      case 'situation':
        return <SituationPage draft={draft} update={update} errors={errors} />;
      case 'home':
        return <HomePage draft={draft} update={update} errors={errors} />;
      case 'financing':
        return <FinancingPage draft={draft} update={update} errors={errors} />;
      case 'future':
        return <FuturePage draft={draft} update={update} errors={errors} />;
      case 'priorities':
        return <PrioritiesPage draft={draft} update={update} />;
      case 'result':
        return report ? (
          <ResultPage
            report={report}
            onDownload={handleDownload}
            onRestart={handleRestart}
            downloadState={downloadState}
          />
        ) : null;
    }
  }, [step.id, draft, update, errors, next, report, handleDownload, handleRestart, downloadState]);

  const showProgress = step.id !== 'welcome' && step.id !== 'result';
  const isLastQuestion = step.id === 'priorities';

  return (
    <ErrorBoundary>
      <div className="app">
        <header className="brand">
          <div className="brand__inner">
            <span className="brand__name">Just Wiser</span>
            <span className="brand__tagline">Driven by better financial decisions.</span>
          </div>
        </header>

        <main className="app__main" id="main">
          {showProgress ? (
            <ProgressIndicator current={progress.current} total={progress.total} title={step.title} />
          ) : null}

          {content}

          {status === 'error' ? (
            <div className="inline-note inline-note--warning" role="alert">
              <strong>We could not finish your report</strong>
              <p>
                Something went wrong while preparing your report. Your answers are still available,
                so please try again.
              </p>
            </div>
          ) : null}

          {showProgress ? (
            <nav className="step-nav" aria-label="Journey navigation">
              <Button variant="quiet" onClick={back}>
                Back
              </Button>
              <Button onClick={handleNext} disabled={status === 'calculating'}>
                {status === 'calculating'
                  ? 'Working through your numbers…'
                  : isLastQuestion
                    ? 'See my analysis'
                    : 'Continue'}
              </Button>
            </nav>
          ) : null}
        </main>

        <footer className="footer">
          <p>
            Just Wiser is an indicative decision-support tool, not financial advice. It is a
            graduate-programme prototype and is not affiliated with any financial services provider.
          </p>
        </footer>
      </div>
    </ErrorBoundary>
  );
}

/** Kept here rather than in validation.ts because it applies only to this journey step. */
function validateFuture(draft: JourneyDraft): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!draft.expectedStay) errors.expectedStay = 'Please choose how long you expect to stay.';
  if (!draft.moveLikelihood) errors.moveLikelihood = 'Please tell us how likely you are to move.';
  return errors;
}

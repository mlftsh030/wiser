import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Catches anything unexpected in rendering.
 *
 * Customers must never see a stack trace, and losing the page mid-journey is
 * alarming when money is involved - so we show a calm message and keep the
 * option to start over.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In production this would go to an error reporting service. It must never
    // include the customer's financial inputs.
    console.error('Just Wiser encountered an error', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="app__main">
        <div className="inline-note inline-note--warning" role="alert">
          <strong>Something went wrong</strong>
          <p>
            We could not finish preparing this page. Nothing you entered has been sent anywhere.
            Please start again, and if it keeps happening it is a fault on our side, not yours.
          </p>
          <button className="btn btn--primary" onClick={() => window.location.reload()}>
            Start again
          </button>
        </div>
      </div>
    );
  }
}

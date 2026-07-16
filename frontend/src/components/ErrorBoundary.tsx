import { Component, type ReactNode } from 'react';
import { ErrorPage } from '../pages/ErrorPage';
import i18n from '../i18n';

type ErrorBoundaryProps = {
  children: ReactNode;
  onReset?: () => void;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  private handleReset = () => {
    this.setState({ hasError: false });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorPage
          code={500}
          title={
            <>
              {i18n.t('errorBoundary.titlePrefix')} <em style={{ color: 'var(--coral)' }}>{i18n.t('errorBoundary.titleEmphasis')}</em>
            </>
          }
          message={i18n.t('errorBoundary.message')}
          onHome={() => {
            window.location.href = '/';
          }}
          onRetry={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

import { Component, type ReactNode } from 'react';
import { ErrorPage } from '../pages/ErrorPage';

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
              Algo salió <em style={{ color: 'var(--coral)' }}>mal</em>
            </>
          }
          message="Puedes reintentar o volver al inicio."
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

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { captureFrontendException } from '../lib/posthog';

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    captureFrontendException(error, {
      handler: 'react.error_boundary',
      componentStack: info.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'grid',
            placeItems: 'center',
            padding: 24,
            background: 'var(--cream)',
            color: 'var(--ink)',
            fontFamily: '"Geist", sans-serif',
          }}
        >
          <div style={{ maxWidth: 460, textAlign: 'center' }}>
            <h1 style={{ fontFamily: '"Instrument Serif", serif', fontSize: 44, fontWeight: 400 }}>
              Algo salio mal
            </h1>
            <p style={{ color: 'var(--ink-60)', lineHeight: 1.6 }}>
              Ya registramos el error. Recarga la pagina para volver a intentarlo.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

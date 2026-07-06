import { Component, type ErrorInfo, type ReactNode } from "react";
import { ErrorPage } from "../../pages/ErrorPage";

interface ErrorBoundaryProps {
  children: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
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
              Algo salió <em style={{ color: "var(--coral)" }}>mal</em>
            </>
          }
          message="Ocurrió un error inesperado al mostrar esta página. Puedes reintentar o volver al inicio."
          onHome={() => {
            window.location.href = "/";
          }}
          onRetry={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

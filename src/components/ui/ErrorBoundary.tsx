import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onRetry?: () => void;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Module error:', error, info);
    if (import.meta.env.VITE_SENTRY_DSN) {
      void import('@sentry/react').then((S) => S.captureException(error));
    }
  }

  reset = () => {
    this.setState({ error: null });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="border border-risk/50 bg-risk/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[9px] font-mono uppercase tracking-widest text-risk">
              ✖ MODULE FAULT
            </span>
            <span className="flex-1 h-px bg-risk/30" />
          </div>
          <div className="text-[10px] font-mono text-ink break-words leading-relaxed">
            {this.state.error.message}
          </div>
          <button
            onClick={this.reset}
            className="mt-3 px-3 py-1 text-[9px] font-mono uppercase tracking-widest border border-edge bg-void text-cyan hover:border-cyan hover:bg-cyan/5 transition-colors"
          >
            ↻ RETRY
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

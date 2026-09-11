import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  props!: Props;
  state!: State;

  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, errorInfo.componentStack);
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'monospace', color: '#991b1b', background: '#fee2e2' }}>
          <h2 style={{ marginTop: 0 }}>Erro ao carregar este ecrã</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
          <button
            onClick={() => (this as any).setState({ error: null })}
            style={{ marginTop: 12, padding: '8px 16px', cursor: 'pointer' }}
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

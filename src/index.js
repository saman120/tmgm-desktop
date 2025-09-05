// src/index.js - React application entry point
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Error boundary component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('React Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          padding: '20px',
          textAlign: 'center',
          background: '#f5f5f7'
        }}>
          <h2 style={{ color: '#c62828', marginBottom: '16px' }}>
            Something went wrong
          </h2>
          <p style={{ color: '#666', marginBottom: '24px' }}>
            The application encountered an unexpected error.
          </p>
          <button
            style={{
              padding: '12px 24px',
              background: '#007AFF',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
            onClick={() => window.location.reload()}
          >
            Reload Application
          </button>
          {process.env.NODE_ENV === 'development' && (
            <details style={{ marginTop: '24px', maxWidth: '600px' }}>
              <summary style={{ cursor: 'pointer', color: '#666' }}>
                Error Details (Development Only)
              </summary>
              <pre style={{
                background: '#f8f9fa',
                padding: '16px',
                borderRadius: '8px',
                fontSize: '12px',
                textAlign: 'left',
                overflow: 'auto',
                marginTop: '8px'
              }}>
                {this.state.error && this.state.error.toString()}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// Create root and render app
const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
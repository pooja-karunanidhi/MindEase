import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global error handling for better debugging
window.onerror = (message, source, lineno, colno, error) => {
  console.error('Global error:', { message, source, lineno, colno, error });
  if (typeof message === 'string' && message.toLowerCase().includes('fetch')) {
    console.error('Network error detected. This might be due to Supabase or Gemini API connectivity issues.');
  }
};

window.onunhandledrejection = (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  const message = event.reason?.message || '';
  if (typeof message === 'string' && message.toLowerCase().includes('fetch')) {
    console.error('Network error detected in promise. Check your API endpoints.');
  }
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

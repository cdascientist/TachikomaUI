import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress known warnings which provide no new info
const originalWarn = console.warn;
console.warn = (...args: any[]) => {
    // Suppressing all warnings entirely as requested
    return;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

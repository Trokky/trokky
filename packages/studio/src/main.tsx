import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import './styles/globals.css';

// Initialize theme from localStorage or system preference
const initializeTheme = () => {
  try {
    const savedTheme = localStorage.getItem('trokky_theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (savedTheme === 'system' && systemPrefersDark) || (!savedTheme && systemPrefersDark)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch (error) {
    console.warn('Failed to initialize theme:', error);
  }
};

// Initialize theme before rendering
initializeTheme();

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  const savedTheme = localStorage.getItem('trokky_theme');
  if (!savedTheme || savedTheme === 'system') {
    if (e.matches) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
});

// Render the app
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
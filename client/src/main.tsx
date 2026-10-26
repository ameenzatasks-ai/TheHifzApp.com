import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// A new service worker takes control without reloading the page, which would
// leave the old code running. The first claim on a fresh visit does not count.
if ('serviceWorker' in navigator) {
  let controlled = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (controlled) window.location.reload();
    controlled = true;
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

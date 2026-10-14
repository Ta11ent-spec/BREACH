import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import {Authentication} from './auth/Auth';

const container = document.getElementById('root');
if (!container) throw new Error('BREACH / INTEL root element not found');

createRoot(container).render(
  <React.StrictMode>
    <Authentication><App /></Authentication>
  </React.StrictMode>,
);

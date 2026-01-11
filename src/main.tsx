import React from 'react';
import { createRoot } from 'react-dom/client';
import QuantumCompiler from './QuantumCompiler';
import './styles.css';

const root = document.getElementById('root')!;
createRoot(root).render(
  <React.StrictMode>
    <QuantumCompiler />
  </React.StrictMode>
);

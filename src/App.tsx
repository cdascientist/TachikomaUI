import React from 'react';
import { CssVarsProvider } from '@mui/joy/styles';
import CssBaseline from '@mui/joy/CssBaseline';
import { ParallelDataOrchestrator } from './components/ParallelDataOrchestrator';
import { FileExplorerProvider } from './context/FileExplorerContext';

export default function App() {
  return (
    <CssVarsProvider defaultMode="dark">
      <CssBaseline />
      <FileExplorerProvider>
        <ParallelDataOrchestrator />
      </FileExplorerProvider>
    </CssVarsProvider>
  );
}

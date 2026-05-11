import React from 'react';
import { ParallelDataOrchestrator } from './components/ParallelDataOrchestrator';
import { FileExplorerProvider } from './context/FileExplorerContext';

export default function App() {
  return (
    <FileExplorerProvider>
      <ParallelDataOrchestrator />
    </FileExplorerProvider>
  );
}

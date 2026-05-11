import React, { useState } from 'react';
import { Explorer, IconMap, Tree, TreeNode } from 'react-file-navigator';
import { useFileExplorer } from '../context/FileExplorerContext';

const iconMap: IconMap = {
    default: <span className="text-cyan-400">📄</span>,
    folderCollapsed: <span className="text-cyan-600">📁</span>,
    folderExpanded: <span className="text-cyan-400">📂</span>,
    pdf: <span className="text-red-400">📄</span>,
    png: <span className="text-green-400">🖼️</span>,
    jpg: <span className="text-green-400">🖼️</span>,
    txt: <span className="text-gray-400">📝</span>,
};

export const FileBrowser: React.FC = () => {
    const { tree, setTree } = useFileExplorer();
    const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);

    const config = {
        fontColor: '#4ade80', // using a nice green for cyber feel, wait let's use cyan string or hex
        accentColor: '#06b6d4',
        fontSize: '14px',
        headerFontSize: '16px',
        iconSize: '20px',
        disableActions: true // Maybe disable actions since it's just visually navigating for now, or keep them enabled
    };

    return (
        <div className="w-full max-w-4xl mx-auto backdrop-blur-2xl bg-black/60 border border-cyan-500/30 rounded-3xl p-6 md:p-8 shadow-[0_0_30px_rgba(0,255,255,0.1)] pointer-events-auto h-[400px] overflow-y-auto custom-scrollbar">
             <h3 className="text-lg font-mono text-cyan-400 mb-4 flex items-center border-b border-cyan-500/30 pb-2">
                <span className="mr-2">&gt; SYSTEM_FILES_BROWSER</span>
            </h3>
            <div className="text-cyan-300 font-mono file-browser-container">
                <Explorer 
                    tree={tree}
                    setTree={setTree}
                    iconMap={iconMap}
                    onFileSelectionChange={setSelectedNode}
                    config={config}
                />
            </div>
            {selectedNode && selectedNode.type === 'File' && (
                <div className="mt-4 p-4 bg-cyan-900/20 border border-cyan-500/30 rounded-xl">
                    <p className="text-sm font-mono text-cyan-300 shadow-[0_0_10px_rgba(0,255,255,0.2)]">SELECTED: {selectedNode.name}</p>
                </div>
            )}
        </div>
    );
};

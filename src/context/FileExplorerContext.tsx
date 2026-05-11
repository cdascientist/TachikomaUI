import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { FolderNode, Tree, TreeNode } from 'react-file-navigator';

interface FileExplorerContextType {
    tree: Tree;
    setTree: React.Dispatch<React.SetStateAction<Tree>>;
    fetchFiles: () => Promise<void>;
}

const defaultTree: Tree = [
    {
        id: 'system_root',
        type: 'Folder',
        name: 'src',
        filePath: '/src',
        expanded: true,
        icon: 'folderExpanded',
        children: []
    }
];

const FileExplorerContext = createContext<FileExplorerContextType>({
    tree: defaultTree,
    setTree: () => {},
    fetchFiles: async () => {},
});

export const FileExplorerProvider = ({ children }: { children: ReactNode }) => {
    const [tree, setTree] = useState<Tree>(defaultTree);

    const fetchFiles = useCallback(async () => {
        try {
            const response = await fetch('/api/files');
            if (response.ok) {
                const files = await response.json();
                
                setTree(prev => {
                    const newTree = [...prev];
                    const vault = { ...newTree[0] } as FolderNode;
                    
                    vault.children = files.map((file: any) => {
                        const parts = file.name.split('.');
                        const extension = parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
                        return {
                            id: file.name, // use filename as ID for easier manipulation
                            type: 'File',
                            filePath: `/src/${file.name}`,
                            extension: extension,
                            icon: extension,
                            name: file.name,
                            size: file.size,
                        };
                    });
                    
                    newTree[0] = vault;
                    return newTree;
                });
            }
        } catch (error) {
            console.error('Failed to fetch files:', error);
        }
    }, []);

    useEffect(() => {
        fetchFiles();
    }, [fetchFiles]);

    return (
        <FileExplorerContext.Provider value={{ tree, setTree, fetchFiles }}>
            {children}
        </FileExplorerContext.Provider>
    );
};

export const useFileExplorer = () => useContext(FileExplorerContext);


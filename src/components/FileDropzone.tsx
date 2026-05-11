import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, File as FileIcon, Trash2, Loader2 } from 'lucide-react';
import { useFileExplorer } from '../context/FileExplorerContext';
import { FolderNode } from 'react-file-navigator';

export const FileDropzone: React.FC = () => {
    const { tree, fetchFiles } = useFileExplorer();
    const [isUploading, setIsUploading] = useState(false);
    
    // Find the vault folder for easy upload reading
    let files: any[] = [];
    if (tree.length > 0 && tree[0].type === 'Folder') {
        files = (tree[0] as FolderNode).children;
    }

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (acceptedFiles.length === 0) return;

        setIsUploading(true);
        const formData = new FormData();
        acceptedFiles.forEach(file => {
            formData.append('files', file);
        });

        try {
            const response = await fetch('/api/files/upload', {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                await fetchFiles(); // Refresh the list
            } else {
                console.error('Upload failed');
            }
        } catch (error) {
            console.error('Error uploading file:', error);
        } finally {
            setIsUploading(false);
        }
    }, [fetchFiles]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, disabled: isUploading });

    const removeFile = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        
        // Use ID (filename) to delete
        try {
            const response = await fetch(`/api/files/${encodeURIComponent(id)}`, {
                method: 'DELETE',
            });
            if (response.ok) {
                await fetchFiles();
            }
        } catch (error) {
            console.error('Failed to delete file:', error);
        }
    };


    return (
        <div className="w-full max-w-4xl mx-auto backdrop-blur-2xl bg-black/40 border border-cyan-500/30 rounded-3xl p-6 md:p-8 shadow-[0_0_30px_rgba(0,255,255,0.1)] pointer-events-auto">
            <div 
                {...getRootProps()} 
                className={`w-full flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-300 ${
                    isDragActive 
                    ? 'border-cyan-400 bg-cyan-900/20' 
                    : 'border-cyan-500/30 hover:border-cyan-400 hover:bg-cyan-900/10'
                }`}
            >
                <input {...getInputProps()} />
                {isUploading ? (
                    <div className="flex flex-col items-center justify-center">
                        <Loader2 className="w-16 h-16 mb-6 text-cyan-400 animate-spin" />
                        <p className="text-xl md:text-2xl font-mono text-cyan-300 mb-2 text-center">
                            Transmitting secure payload...
                        </p>
                    </div>
                ) : (
                    <>
                        <UploadCloud className={`w-16 h-16 mb-6 transition-colors ${isDragActive ? 'text-cyan-300' : 'text-cyan-500'}`} />
                        <p className="text-xl md:text-2xl font-mono text-cyan-300 mb-2 text-center">
                            {isDragActive 
                                ? 'Drop modules here...' 
                                : 'Drag & drop payload modules'}
                        </p>
                        <p className="text-sm md:text-base font-mono text-cyan-500/70 text-center">
                            or click to manually initialize upload sequence
                        </p>
                    </>
                )}
            </div>

            {files.length > 0 && (
                <div className="mt-8">
                    <h3 className="text-lg font-mono text-cyan-400 mb-4 flex items-center">
                        <span className="mr-2">&gt; UPLOADED_ENTITIES</span>
                        <span className="bg-cyan-900/50 text-cyan-300 px-2 py-0.5 rounded text-sm">{files.length}</span>
                    </h3>
                    <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                        {files.map((file) => (
                            <div key={file.id} className="flex items-center justify-between p-3 rounded-xl bg-black/50 border border-cyan-500/20 hover:border-cyan-400/50 transition-colors group">
                                <div className="flex items-center overflow-hidden">
                                    <FileIcon className="w-5 h-5 text-cyan-400 mr-3 flex-shrink-0" />
                                    <span className="text-sm font-mono text-gray-300 truncate">{file.name}</span>
                                </div>
                                <div className="flex items-center ml-4">
                                    <span className="text-xs font-mono text-cyan-500/70 mr-4 flex-shrink-0">
                                        {((file.size || 0) / 1024).toFixed(1)} KB
                                    </span>
                                    <button 
                                        onClick={(e) => removeFile(e, file.id)}
                                        className="text-red-500 hover:text-red-400 opacity-50 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-red-500/10 rounded-lg"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

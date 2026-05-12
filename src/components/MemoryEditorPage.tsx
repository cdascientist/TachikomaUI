import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { ConfigPageShell } from "./ConfigPageShell";
import { useApi } from "../hooks/useApi";
import { apiUrl } from "../hooks/apiConfig";
import { Save, FileText, FileWarning } from "lucide-react";

interface WsFile { name: string; size: number; updatedAt: string }
interface FileContent { name: string; content: string; size: number }

export const MemoryEditorPage: React.FC = () => {
  const { data: files, loading, error, refetch: refetchFiles } = useApi<WsFile[]>("/api/workspace/files");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [originalContent, setOriginalContent] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    if (!selectedFile) return;
    let cancelled = false;
    fetch(apiUrl(`/api/workspace/file/${encodeURIComponent(selectedFile)}`))
      .then(r => r.json())
      .then((d: FileContent) => {
        if (!cancelled) { setContent(d.content); setOriginalContent(d.content); }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [selectedFile]);

  const handleSave = async () => {
    if (!selectedFile) return;
    setSaving(true);
    try {
      await fetch(apiUrl(`/api/workspace/file/${encodeURIComponent(selectedFile)}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      setOriginalContent(content);
      setSaveMsg(`Saved ${selectedFile}`);
      setTimeout(() => setSaveMsg(""), 2500);
    } finally {
      setSaving(false);
    }
  };

  const isDirty = content !== originalContent;
  const fileList = files || [];

  return (
    <ConfigPageShell title="Memory Workspace" description="Workspace soul files — edit markdown memories, identity, and skill definitions" accentColor="fuchsia" loading={loading} error={error} onRetry={refetchFiles}>
      <div className="flex flex-col md:flex-row gap-4">
        {/* File List */}
        <motion.div className="w-full md:w-60 flex-shrink-0" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
          <div className="flex items-center gap-2 mb-2">
            <FileText size={15} className="text-fuchsia-400" />
            <h3 className="text-xs font-mono text-gray-200 uppercase tracking-wider">Workspace Memory Files</h3>
          </div>
          <div className="border border-fuchsia-500/20 rounded-xl bg-fuchsia-900/5 overflow-hidden">
            {fileList.map(f => (
              <button
                key={f.name}
                onClick={() => setSelectedFile(f.name)}
                className={`w-full text-left px-3 py-2 font-mono text-xs transition-colors flex justify-between items-center ${selectedFile === f.name ? 'bg-fuchsia-500/20 text-fuchsia-300' : 'text-gray-400 hover:bg-fuchsia-500/10 hover:text-gray-200'}`}
              >
                <span>{f.name}</span>
                <span className="text-[10px] text-gray-600">{(f.size / 1024).toFixed(1)}K</span>
              </button>
            ))}
            {fileList.length === 0 && (
              <div className="text-gray-500 font-mono text-xs p-3">No files found</div>
            )}
          </div>
        </motion.div>

        {/* Editor */}
        <motion.div className="flex-1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
          {selectedFile ? (
            <>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-lg bg-fuchsia-500/20 border border-fuchsia-500/30 text-fuchsia-300 font-mono text-xs">{selectedFile}</span>
                {isDirty && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 font-mono text-[10px] uppercase">
                    <FileWarning size={10} /> Modified
                  </span>
                )}
              </div>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={16}
                className="w-full bg-black/60 border border-fuchsia-500/20 rounded-xl p-3 font-mono text-sm text-gray-200 resize-none focus:outline-none focus:border-fuchsia-400/60 placeholder-gray-600 leading-relaxed"
              />
              <button
                onClick={handleSave}
                disabled={!isDirty || saving}
                className={`mt-2 flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono text-xs uppercase tracking-widest transition-all ${isDirty ? 'bg-fuchsia-600/30 hover:bg-fuchsia-600/50 border border-fuchsia-500/40 text-fuchsia-300' : 'bg-gray-700/50 border border-gray-600/30 text-gray-500 cursor-not-allowed'}`}
              >
                {saving ? (
                  <span className="animate-pulse">Saving...</span>
                ) : (
                  <><Save size={14} /> Save {selectedFile}</>
                )}
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-gray-600 gap-3">
              <FileText size={48} />
              <span className="font-mono text-sm">Select a file from the list to edit</span>
            </div>
          )}
        </motion.div>
      </div>

      {/* Save Toast */}
      {saveMsg && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-green-900/80 border border-green-500/40 text-green-300 font-mono text-sm px-4 py-2 rounded-xl backdrop-blur-lg z-50">
          {saveMsg}
        </motion.div>
      )}
    </ConfigPageShell>
  );
};

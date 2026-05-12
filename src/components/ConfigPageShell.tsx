import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { RefreshCw } from "lucide-react";

interface ConfigPageShellProps {
  title: string;
  description: string;
  accentColor: string;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  children: React.ReactNode;
}

const accentMap: Record<string, { border: string; text: string; glow: string; bg: string; shadow: string }> = {
  cyan:    { border: "border-cyan-500/30", text: "text-cyan-400", glow: "shadow-[0_0_30px_rgba(0,255,255,0.08)]", bg: "from-black/85 to-cyan-950/20", shadow: "shadow-cyan-500/5" },
  fuchsia: { border: "border-fuchsia-500/30", text: "text-fuchsia-400", glow: "shadow-[0_0_30px_rgba(255,0,255,0.08)]", bg: "from-black/85 to-fuchsia-950/20", shadow: "shadow-fuchsia-500/5" },
  yellow:  { border: "border-yellow-500/30", text: "text-yellow-400", glow: "shadow-[0_0_30px_rgba(255,255,0,0.08)]", bg: "from-black/85 to-yellow-950/20", shadow: "shadow-yellow-500/5" },
  green:   { border: "border-green-500/30", text: "text-green-400", glow: "shadow-[0_0_30px_rgba(0,255,0,0.08)]", bg: "from-black/85 to-green-950/20", shadow: "shadow-green-500/5" },
  purple:  { border: "border-purple-500/30", text: "text-purple-400", glow: "shadow-[0_0_30px_rgba(168,85,247,0.08)]", bg: "from-black/85 to-purple-950/20", shadow: "shadow-purple-500/5" },
};

export const ConfigPageShell: React.FC<ConfigPageShellProps> = ({
  title, description, accentColor, loading, error, onRetry, children
}) => {
  const c = accentMap[accentColor] || accentMap.cyan;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="flex justify-center items-center h-full p-4"
    >
      <div className={`w-full max-w-3xl max-h-[80vh] min-h-[65vh] overflow-y-auto rounded-3xl p-6 md:p-8 bg-gradient-to-b ${c.bg} backdrop-blur-xl border ${c.border} ${c.glow} pointer-events-auto custom-scrollbar`}>
        <h2 className={`text-xl md:text-2xl font-mono ${c.text} drop-shadow-md uppercase tracking-widest mb-1`}>
          {title}
        </h2>
        <p className={`text-gray-400 font-mono text-xs mb-6 border-l-2 ${c.border} pl-3`}>
          {description}
        </p>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              <div className="h-14 bg-gray-800/50 rounded-xl animate-pulse" />
              <div className="h-14 bg-gray-800/50 rounded-xl animate-pulse" />
              <div className="h-14 bg-gray-800/50 rounded-xl animate-pulse" />
            </motion.div>
          ) : error ? (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="bg-red-900/30 border border-red-500/40 rounded-xl p-4 flex items-center justify-between gap-3">
              <span className="text-red-400 font-mono text-sm">{error}</span>
              <button onClick={onRetry} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/30 hover:bg-red-600/50 border border-red-500/40 rounded-lg text-red-300 font-mono text-xs uppercase tracking-wider transition-colors">
                <RefreshCw size={14} /> Retry
              </button>
            </motion.div>
          ) : (
            <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

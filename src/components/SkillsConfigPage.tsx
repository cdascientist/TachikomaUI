import React, { useState } from "react";
import { motion } from "motion/react";
import { ConfigPageShell } from "./ConfigPageShell";
import { useApi } from "../hooks/useApi";
import { apiUrl } from "../hooks/apiConfig";
import { Puzzle, Wrench, Zap } from "lucide-react";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, x: -20 }, show: { opacity: 1, x: 0 } };

export const SkillsConfigPage: React.FC = () => {
  const { data, loading, error, refetch } = useApi<any>("/api/openclaw/config");
  const [toggling, setToggling] = useState<string | null>(null);

  const handleToggle = async (pluginKey: string, currentEnabled: boolean) => {
    if (!data) return;
    setToggling(pluginKey);
    try {
      await fetch(apiUrl("/api/openclaw/config"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plugins: { entries: { [pluginKey]: { enabled: !currentEnabled } } } }),
      });
      refetch();
    } finally {
      setToggling(null);
    }
  };

  const plugins = data?.plugins?.entries || {};
  const tools = data?.tools || {};
  const pluginKeys = Object.keys(plugins);
  const hasWebSearch = tools?.web?.search?.enabled;

  return (
    <ConfigPageShell title="Skills Configuration" description="Plugin registry, tool enablement, and skill runtime settings from OpenClaw" accentColor="cyan" loading={loading} error={error} onRetry={refetch}>
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
        {/* Plugins */}
        <div className="flex items-center gap-2 mb-1">
          <Puzzle size={16} className="text-cyan-400" />
          <h3 className="text-sm font-mono text-gray-200 uppercase tracking-wider">Installed Plugins</h3>
        </div>
        <div className="space-y-2">
          {pluginKeys.map(key => (
            <motion.div key={key} variants={item} whileHover={{ scale: 1.01 }}
              className="flex items-center justify-between p-3 rounded-xl border border-cyan-500/20 bg-cyan-900/5">
              <div>
                <div className="text-sm font-mono text-gray-200">{key}</div>
                <div className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">
                  {plugins[key]?.enabled ? "Active" : "Disabled"}
                </div>
              </div>
              <button
                onClick={() => handleToggle(key, !!plugins[key]?.enabled)}
                disabled={toggling === key}
                className={`w-12 h-6 rounded-full transition-colors relative ${plugins[key]?.enabled ? 'bg-cyan-500/80' : 'bg-gray-700'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${plugins[key]?.enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </motion.div>
          ))}
          {pluginKeys.length === 0 && (
            <div className="text-gray-500 font-mono text-sm p-3">No plugins configured</div>
          )}
        </div>

        <hr className="border-cyan-500/15 my-4" />

        {/* Tools */}
        <div className="flex items-center gap-2 mb-1">
          <Wrench size={16} className="text-cyan-400" />
          <h3 className="text-sm font-mono text-gray-200 uppercase tracking-wider">Available Tools</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasWebSearch && (
            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-cyan-500/30 bg-cyan-900/10 text-cyan-300 font-mono text-xs">
              <Zap size={12} /> Web Search ({tools.web.search.provider})
            </span>
          )}
          {!hasWebSearch && Object.keys(tools).length === 0 && (
            <span className="text-gray-500 font-mono text-sm">No tools configured</span>
          )}
        </div>
      </motion.div>
    </ConfigPageShell>
  );
};

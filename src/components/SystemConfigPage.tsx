import React, { useState } from "react";
import { motion } from "motion/react";
import { ConfigPageShell } from "./ConfigPageShell";
import { useApi } from "../hooks/useApi";
import { Cpu, HardDrive, Clock, Server, Brain } from "lucide-react";

const containerAnim = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const rowItem = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };

interface ProviderModel { id: string; name: string; contextWindow: number; maxTokens: number }
interface Provider { baseUrl: string; models: ProviderModel[] }
interface SvcInfo { active: string; substate: string; startedAt: string }
interface Resources { memory: { total: number; used: number; free: number; available: number }; disk: { total: number; used: number; available: number }; uptime: string }

const providerColors: Record<string, { border: string; text: string; bg: string }> = {
  deepseek: { border: "border-cyan-500/30", text: "text-cyan-400", bg: "bg-cyan-900/5" },
  moonshot:  { border: "border-yellow-500/30", text: "text-yellow-400", bg: "bg-yellow-900/5" },
  gemini:    { border: "border-blue-500/30", text: "text-blue-400", bg: "bg-blue-900/5" },
};

export const SystemConfigPage: React.FC = () => {
  const { data: config, loading: cfgLoading, refetch: refetchCfg } = useApi<any>("/api/openclaw/config");
  const { data: services, loading: svcLoading, refetch: refetchSvc } = useApi<Record<string, SvcInfo>>("/api/system/services");
  const { data: resources, loading: resLoading, refetch: refetchRes } = useApi<Resources>("/api/system/resources");

  const loading = cfgLoading || svcLoading || resLoading;
  const handleRetry = () => { refetchCfg(); refetchSvc(); refetchRes(); };

  const providers: Record<string, Provider> = config?.models?.providers || {};
  const servicesData = services || {};
  const res = resources;

  const formatBytes = (b: number) => {
    if (!b || b < 0) return "0 B";
    if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`;
    if (b >= 1e6) return `${(b / 1e6).toFixed(0)} MB`;
    if (b >= 1e3) return `${(b / 1e3).toFixed(0)} KB`;
    return `${b} B`;
  };

  const ramPercent = res && res.memory.total > 0 ? Math.min(100, Math.round((res.memory.used / res.memory.total) * 100)) : 0;
  const diskPercent = res && res.disk.total > 0 ? Math.min(100, Math.round((res.disk.used / res.disk.total) * 100)) : 0;

  // Accordion state
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleAccordion = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  return (
    <ConfigPageShell title="System Configuration" description="Model providers, service health, resource utilization, and runtime settings" accentColor="purple" loading={loading} error={null} onRetry={handleRetry}>
      <motion.div variants={containerAnim} initial="hidden" animate="show" className="space-y-4">
        {/* Model Providers (Accordions) */}
        <div className="flex items-center gap-2 mb-1">
          <Brain size={16} className="text-purple-400" />
          <h3 className="text-sm font-mono text-gray-200 uppercase tracking-wider">Connected AI Providers</h3>
        </div>
        <div className="space-y-1.5">
          {Object.entries(providers).map(([key, provider]) => {
            const c = providerColors[key] || providerColors.deepseek;
            const isOpen = expanded.has(key);
            return (
              <motion.div key={key} variants={rowItem}
                className={`rounded-xl border ${c.border} ${c.bg} overflow-hidden`}>
                <button
                  onClick={() => toggleAccordion(key)}
                  className={`w-full text-left p-3 font-mono text-sm ${c.text} uppercase tracking-wider flex justify-between items-center hover:opacity-80 transition-opacity`}
                >
                  <span>{key} ({provider.models.length} models)</span>
                  <span className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
                </button>
                {isOpen && (
                  <div className="border-t border-purple-500/10 p-2">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="font-mono text-[10px] text-purple-400 uppercase tracking-wider">
                          <th className="p-1.5">Model</th>
                          <th className="p-1.5">Context Window</th>
                          <th className="p-1.5">Max Output</th>
                        </tr>
                      </thead>
                      <tbody>
                        {provider.models.map(m => (
                          <tr key={m.id} className="border-t border-purple-500/5">
                            <td className="p-1.5 text-xs font-mono text-gray-300">{m.id}</td>
                            <td className="p-1.5 text-xs font-mono text-gray-400">{(m.contextWindow / 1000).toFixed(0)}K</td>
                            <td className="p-1.5 text-xs font-mono text-gray-400">{(m.maxTokens / 1000).toFixed(0)}K</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </motion.div>
            );
          })}
          {Object.keys(providers).length === 0 && (
            <div className="text-gray-500 font-mono text-sm p-3">No providers configured</div>
          )}
        </div>

        <hr className="border-purple-500/15 my-4" />

        {/* Services */}
        <div className="flex items-center gap-2 mb-1">
          <Server size={16} className="text-purple-400" />
          <h3 className="text-sm font-mono text-gray-200 uppercase tracking-wider">Running Services</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(servicesData).map(([key, svc]) => (
            <span key={key}
              className={`px-3 py-1 rounded-lg font-mono text-xs ${svc.active === 'running' ? 'bg-green-900/20 border border-green-500/30 text-green-400' : 'bg-red-900/20 border border-red-500/30 text-red-400'}`}>
              {key.replace(".service", "")}: {svc.active === "running" ? "UP" : "DOWN"}
            </span>
          ))}
          {Object.keys(servicesData).length === 0 && (
            <span className="text-gray-500 font-mono text-sm">No service data</span>
          )}
        </div>

        {/* Resources */}
        {res && (
          <motion.div variants={rowItem} className="space-y-3">
            <div className="flex items-center gap-2 mt-2">
              <Cpu size={16} className="text-purple-400" />
              <h3 className="text-sm font-mono text-gray-200 uppercase tracking-wider">System Resources</h3>
            </div>

            {/* RAM */}
            <div className="rounded-xl border border-purple-500/20 bg-purple-900/5 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Cpu size={14} className="text-purple-400" />
                  <span className="text-xs font-mono text-gray-200 uppercase">RAM</span>
                </div>
                <span className="text-[10px] font-mono text-gray-500">{formatBytes(res.memory.used)} / {formatBytes(res.memory.total)}</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${ramPercent > 85 ? 'bg-red-500' : 'bg-purple-500'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${ramPercent}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </div>
            </div>

            {/* Disk */}
            <div className="rounded-xl border border-purple-500/20 bg-purple-900/5 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <HardDrive size={14} className="text-purple-400" />
                  <span className="text-xs font-mono text-gray-200 uppercase">Disk</span>
                </div>
                <span className="text-[10px] font-mono text-gray-500">{formatBytes(res.disk.used)} / {formatBytes(res.disk.total)}</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${diskPercent > 85 ? 'bg-red-500' : 'bg-purple-500'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${diskPercent}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </div>
            </div>

            {/* Uptime */}
            <div className="rounded-xl border border-purple-500/20 bg-purple-900/5 p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-purple-400" />
                <span className="text-xs font-mono text-gray-200 uppercase">Uptime</span>
              </div>
              <span className="text-xs font-mono text-purple-300">{res.uptime}</span>
            </div>
          </motion.div>
        )}
      </motion.div>
    </ConfigPageShell>
  );
};

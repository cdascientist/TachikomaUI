import React, { useState } from "react";
import { motion } from "motion/react";
import { ConfigPageShell } from "./ConfigPageShell";
import { useApi } from "../hooks/useApi";
import { apiUrl } from "../hooks/apiConfig";
import { Activity, Bell, Server } from "lucide-react";

const containerAnim = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };
const rowItem = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

interface SvcInfo { active: string; substate: string; startedAt: string }

const serviceLabels: Record<string, string> = {
  "tachikoma-ui.service": "TachikomaUI",
  "sendblue-poller.service": "SendBlue Poller",
  "tachikoma.service": "Tachikoma Web App",
};

export const AlertsConfigPage: React.FC = () => {
  const { data: services, loading: svcLoading, error: svcError, refetch: refetchSvc } = useApi<Record<string, SvcInfo>>("/api/system/services");
  const { data: config, loading: cfgLoading, refetch: refetchCfg } = useApi<any>("/api/openclaw/config");
  const [toggling, setToggling] = useState<string | null>(null);

  const svc = services || {};
  const svcKeys = Object.keys(svc);
  const loading = svcLoading || cfgLoading;
  const error = svcError;
  const handleRetry = () => { refetchSvc(); refetchCfg(); };

  // Read alert pipeline states from real server config, default to enabled
  const alertCfg = config?.tachikoma?.alerts || {};
  const vmqEnabled = alertCfg.vmq !== false;
  const imessageEnabled = alertCfg.imessage !== false;

  const handleToggle = async (key: string, currentValue: boolean) => {
    setToggling(key);
    try {
      await fetch(apiUrl("/api/openclaw/config"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tachikoma: { alerts: { [key]: !currentValue } } }),
      });
      refetchCfg();
    } finally {
      setToggling(null);
    }
  };

  const pipelineItems = [
    { label: "VMQ Alerts", key: "vmq", enabled: vmqEnabled },
    { label: "iMessage Notifications", key: "imessage", enabled: imessageEnabled },
  ];

  return (
    <ConfigPageShell title="Alerts & Monitoring" description="Service health, VMQ alert pipeline status, and iMessage notification monitor" accentColor="yellow" loading={loading} error={error} onRetry={handleRetry}>
      <motion.div variants={containerAnim} initial="hidden" animate="show" className="space-y-4">
        {/* Services Table */}
        <div className="flex items-center gap-2 mb-1">
          <Server size={16} className="text-yellow-400" />
          <h3 className="text-sm font-mono text-gray-200 uppercase tracking-wider">System Services</h3>
        </div>
        <div className="border border-yellow-500/20 rounded-xl overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-yellow-900/10">
              <tr className="font-mono text-xs text-yellow-400 uppercase tracking-wider">
                <th className="p-3">Service Name</th>
                <th className="p-3">Current Status</th>
                <th className="p-3 hidden md:table-cell">Start Time</th>
              </tr>
            </thead>
            <tbody>
              {svcKeys.map(key => {
                const s = svc[key];
                const running = s.active === "running";
                return (
                  <motion.tr key={key} variants={rowItem} className="border-t border-yellow-500/10">
                    <td className="p-3 text-sm font-mono text-gray-200">{serviceLabels[key] || key}</td>
                    <td className="p-3">
                      <span className={`inline-block px-2.5 py-0.5 rounded-lg font-mono text-[10px] uppercase tracking-wider ${running ? 'bg-green-900/40 border border-green-500/40 text-green-400' : 'bg-red-900/40 border border-red-500/40 text-red-400'}`}>
                        {running ? "Running" : s.active || "Unknown"}
                      </span>
                    </td>
                    <td className="p-3 text-xs font-mono text-gray-500 hidden md:table-cell">
                      {s.startedAt ? new Date(parseInt(s.startedAt) / 1000).toLocaleString() : "—"}
                    </td>
                  </motion.tr>
                );
              })}
              {svcKeys.length === 0 && (
                <tr><td colSpan={3} className="p-4 text-center text-gray-500 font-mono text-sm">No service data</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <hr className="border-yellow-500/15 my-4" />

        {/* Alert Pipeline — dynamic, driven by real server config */}
        <div className="flex items-center gap-2 mb-1">
          <Bell size={16} className="text-yellow-400" />
          <h3 className="text-sm font-mono text-gray-200 uppercase tracking-wider">Alert Notification Pipeline</h3>
        </div>
        <div className="space-y-2">
          {pipelineItems.map(cfg => (
            <motion.div key={cfg.key} variants={rowItem}
              className="flex items-center justify-between p-3 rounded-xl border border-yellow-500/20 bg-yellow-900/5">
              <div className="flex items-center gap-2">
                <Activity size={14} className="text-yellow-400" />
                <span className="text-sm font-mono text-gray-200">{cfg.label}</span>
              </div>
              <button
                onClick={() => handleToggle(cfg.key, cfg.enabled)}
                disabled={toggling === cfg.key}
                className={`w-12 h-6 rounded-full transition-colors relative ${cfg.enabled ? 'bg-yellow-500/80 shadow-[0_0_12px_rgba(255,255,0,0.3)]' : 'bg-gray-700'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${cfg.enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </ConfigPageShell>
  );
};

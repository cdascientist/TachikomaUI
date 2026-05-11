import React, { useState } from "react";
import { motion } from "motion/react";
import { ConfigPageShell } from "./ConfigPageShell";
import { useApi } from "../hooks/useApi";
import { MessageCircle, CheckCircle, Clock, AlertTriangle, Zap, Send } from "lucide-react";

const containerAnim = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const rowItem = { hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0 } };

interface LogEntry { id: string; from_number: string; to_number: string; content: string; direction: string; status: string; created_at: string }
interface Stats { total: number; inbound: number; outbound: number; responded: number; pending: number; failed: number }

export const ImessageConfigPage: React.FC = () => {
  const { data: stats, loading: statsLoading, refetch: refetchStats } = useApi<Stats>("/api/imessage/stats");
  const { data: log, loading: logLoading, refetch: refetchLog } = useApi<LogEntry[]>("/api/imessage/log?limit=30");
  const [forcing, setForcing] = useState(false);
  const [forceMsg, setForceMsg] = useState("");

  const handleForce = async () => {
    setForcing(true);
    try {
      const res = await fetch("/api/imessage/force", { method: "POST" });
      const d = await res.json();
      setForceMsg(d.message || "Force sent");
      setTimeout(() => setForceMsg(""), 3000);
      refetchStats();
      refetchLog();
    } finally {
      setForcing(false);
    }
  };

  const s = stats || { total: 0, inbound: 0, outbound: 0, responded: 0, pending: 0, failed: 0 };
  const logEntries = log || [];

  const statCards = [
    { label: "Total (7d)", value: s.total, icon: <MessageCircle size={18} />, color: "cyan" },
    { label: "Responded", value: s.responded, icon: <CheckCircle size={18} />, color: "green" },
    { label: "Pending", value: s.pending, icon: <Clock size={18} />, color: "yellow" },
    { label: "Failed", value: s.failed, icon: <AlertTriangle size={18} />, color: "red" },
  ];

  const colorClasses: Record<string, { card: string; text: string }> = {
    cyan:   { card: "border-cyan-500/20 bg-cyan-900/5", text: "text-cyan-400" },
    green:  { card: "border-green-500/20 bg-green-900/5", text: "text-green-400" },
    yellow: { card: "border-yellow-500/20 bg-yellow-900/5", text: "text-yellow-400" },
    red:    { card: "border-red-500/20 bg-red-900/5", text: "text-red-400" },
  };

  return (
    <ConfigPageShell title="iMessage Config" description="SendBlue relay status, message log, delivery stats, and force-respond controls" accentColor="green" loading={statsLoading && logLoading} error={null} onRetry={() => { refetchStats(); refetchLog(); }}>
      <motion.div variants={containerAnim} initial="hidden" animate="show" className="space-y-4">
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {statCards.map(card => {
            const cls = colorClasses[card.color];
            return (
              <motion.div key={card.label} variants={rowItem}
                className={`p-3 rounded-xl border ${cls.card} text-center`}>
                <div className={`flex justify-center mb-1 ${cls.text}`}>{card.icon}</div>
                <div className="text-xl font-mono text-gray-200 font-bold">{card.value}</div>
                <div className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">{card.label}</div>
              </motion.div>
            );
          })}
        </div>

        <hr className="border-green-500/15 my-4" />

        {/* Force + Log Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Send size={16} className="text-green-400" />
            <h3 className="text-sm font-mono text-gray-200 uppercase tracking-wider">Message Log</h3>
          </div>
          <button
            onClick={handleForce}
            disabled={forcing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-600/20 hover:bg-yellow-600/40 border border-yellow-500/40 rounded-lg text-yellow-300 font-mono text-xs uppercase tracking-wider transition-colors"
          >
            <Zap size={12} /> {forcing ? "Forcing..." : "Force All"}
          </button>
        </div>

        {/* Log Table */}
        <div className="border border-green-500/20 rounded-xl overflow-hidden max-h-72 overflow-y-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead className="bg-green-900/10 sticky top-0">
              <tr className="font-mono text-[10px] text-green-400 uppercase tracking-wider">
                <th className="p-2">From</th>
                <th className="p-2 max-w-[180px]">Content</th>
                <th className="p-2">Dir</th>
                <th className="p-2">Status</th>
                <th className="p-2 hidden md:table-cell">Time</th>
              </tr>
            </thead>
            <tbody>
              {logEntries.map(entry => (
                <motion.tr key={entry.id} variants={rowItem} className="border-t border-green-500/10 hover:bg-green-500/5">
                  <td className="p-2 text-xs font-mono text-gray-300">{entry.from_number}</td>
                  <td className="p-2 text-xs font-mono text-gray-400 max-w-[180px] truncate block">{entry.content || "—"}</td>
                  <td className="p-2">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase ${entry.direction === 'inbound' ? 'bg-cyan-900/40 text-cyan-400' : 'bg-gray-700/40 text-gray-400'}`}>
                      {entry.direction}
                    </span>
                  </td>
                  <td className="p-2">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase ${entry.status === 'responded' ? 'bg-green-900/40 text-green-400' : entry.status === 'failed' ? 'bg-red-900/40 text-red-400' : 'bg-yellow-900/40 text-yellow-400'}`}>
                      {entry.status}
                    </span>
                  </td>
                  <td className="p-2 text-[10px] font-mono text-gray-500 hidden md:table-cell">
                    {entry.created_at ? new Date(entry.created_at).toLocaleString() : "—"}
                  </td>
                </motion.tr>
              ))}
              {logEntries.length === 0 && (
                <tr><td colSpan={5} className="p-4 text-center text-gray-500 font-mono text-sm">No messages in log</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {forceMsg && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-green-900/80 border border-green-500/40 text-green-300 font-mono text-sm px-4 py-2 rounded-xl backdrop-blur-lg z-50">
          {forceMsg}
        </motion.div>
      )}
    </ConfigPageShell>
  );
};

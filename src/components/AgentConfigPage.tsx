import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { ConfigPageShell } from "./ConfigPageShell";
import { useApi } from "../hooks/useApi";
import { apiUrl } from "../hooks/apiConfig";
import { Brain, Database, Wrench, Volume2, MessageCircle, Settings, Zap, Cpu } from "lucide-react";

const containerAnim = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const rowItem = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } };

interface AgentFeature {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  icon: React.ReactNode;
}

const defaultFeatures: Record<string, boolean> = {
  workspace_memory: false,
  plugin_skills: false,
  tts_voice: true,
  imessage_relay: false,
  alert_pipeline: false,
  auto_start: false,
  keep_alive: false,
};

export const AgentConfigPage: React.FC = () => {
  const { data: config, loading, error, refetch } = useApi<any>("/api/openclaw/config");
  const [saving, setSaving] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState("");

  // Features merge: server config > localStorage > hardcoded defaults
  const [features, setFeatures] = useState<Record<string, boolean>>(() => {
    const stored: Record<string, boolean> = { ...defaultFeatures };
    try {
      const local = localStorage.getItem("agent-features");
      if (local) Object.assign(stored, JSON.parse(local));
    } catch {}
    return stored;
  });

  // When server config loads, merge it in (server takes priority over localStorage)
  useEffect(() => {
    if (config?.tachikoma?.agentFeatures) {
      setFeatures(prev => ({ ...prev, ...config.tachikoma.agentFeatures }));
    }
  }, [config]);

  const persist = async (key: string, value: boolean) => {
    const next = { ...features, [key]: value };
    setFeatures(next);
    try { localStorage.setItem("agent-features", JSON.stringify(next)); } catch {}
    // Also persist to server immediately
    try {
      await fetch(apiUrl("/api/openclaw/config"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tachikoma: { agentFeatures: { [key]: value } } }),
      });
    } catch {}
  };

  const featureList: AgentFeature[] = [
    {
      key: "workspace_memory",
      label: "Workspace Memory",
      description: "Load OpenClaw workspace markdown files into agent context",
      enabled: features["workspace_memory"] ?? false,
      icon: <Database size={16} className="text-fuchsia-400" />,
    },
    {
      key: "plugin_skills",
      label: "Plugin Skills",
      description: "Enable registered OpenClaw plugins (deepseek, lossless-claw, brave)",
      enabled: features["plugin_skills"] ?? false,
      icon: <Wrench size={16} className="text-fuchsia-400" />,
    },
    {
      key: "tts_voice",
      label: "ElevenLabs TTS Voice",
      description: "Speak responses aloud via ElevenLabs text-to-speech",
      enabled: features["tts_voice"] ?? true,
      icon: <Volume2 size={16} className="text-fuchsia-400" />,
    },
    {
      key: "imessage_relay",
      label: "iMessage Relay",
      description: "Auto-respond to inbound iMessages via SendBlue relay",
      enabled: features["imessage_relay"] ?? false,
      icon: <MessageCircle size={16} className="text-fuchsia-400" />,
    },
    {
      key: "alert_pipeline",
      label: "Alert Pipeline (VMQ+)",
      description: "Process system alerts and deliver via carousel notifications",
      enabled: features["alert_pipeline"] ?? false,
      icon: <Zap size={16} className="text-fuchsia-400" />,
    },
    {
      key: "auto_start",
      label: "Auto-Start on Boot",
      description: "Automatically start the agent when Tachikoma boots",
      enabled: features["auto_start"] ?? false,
      icon: <Settings size={16} className="text-fuchsia-400" />,
    },
    {
      key: "keep_alive",
      label: "Keep-Alive Monitor",
      description: "Self-healing watchdog that restarts agent on failure",
      enabled: features["keep_alive"] ?? false,
      icon: <Cpu size={16} className="text-fuchsia-400" />,
    },
  ];

  const handleSaveAll = async () => {
    setSaving("all");
    try {
      await fetch(apiUrl("/api/openclaw/config"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tachikoma: { agentFeatures: features } }),
      });
      try { localStorage.setItem("agent-features", JSON.stringify(features)); } catch {}
      setStatusMsg("Agent configuration saved to server");
      setTimeout(() => setStatusMsg(""), 3000);
    } finally {
      setSaving(null);
    }
  };

  const modelInfo = config?.models?.providers || {};
  const providerCount = Object.keys(modelInfo).length;

  return (
    <ConfigPageShell title="Agent Configuration" description="Spin Up Agent customization — memory, skills, voice, relay, and automation. All features deactivated by default." accentColor="fuchsia" loading={loading} error={error} onRetry={refetch}>
      <motion.div variants={containerAnim} initial="hidden" animate="show" className="space-y-4">

        {/* Agent Identity — dynamically shows model/provider info from config */}
        <motion.div variants={rowItem} className="flex items-center gap-3 p-4 rounded-xl border border-fuchsia-500/20 bg-fuchsia-900/5">
          <Brain size={20} className="text-fuchsia-400" />
          <div>
            <div className="text-sm font-mono text-gray-200">Spin Up Agent</div>
            <div className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">
              Model: DeepSeek Chat &bull; Providers: {providerCount} &bull; Tachikoma v2
            </div>
          </div>
        </motion.div>

        <hr className="border-fuchsia-500/15 my-2" />

        {/* Feature Toggles — dynamically generated from real config state */}
        <div className="flex items-center gap-2 mb-1">
          <Settings size={16} className="text-fuchsia-400" />
          <h3 className="text-sm font-mono text-gray-200 uppercase tracking-wider">Agent Features</h3>
        </div>

        <div className="space-y-2">
          {featureList.map(f => (
            <motion.div key={f.key} variants={rowItem} whileHover={{ scale: 1.01 }}
              className="flex items-center justify-between p-3 rounded-xl border border-fuchsia-500/20 bg-fuchsia-900/5">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex-shrink-0">{f.icon}</div>
                <div className="min-w-0">
                  <div className="text-sm font-mono text-gray-200">{f.label}</div>
                  <div className="text-[10px] font-mono text-gray-500 truncate">{f.description}</div>
                </div>
              </div>
              <button
                onClick={() => persist(f.key, !f.enabled)}
                className={`flex-shrink-0 w-12 h-6 rounded-full transition-colors relative ${f.enabled ? 'bg-fuchsia-500/80 shadow-[0_0_12px_rgba(255,0,255,0.4)]' : 'bg-gray-700'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${f.enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </motion.div>
          ))}
        </div>

        {/* Save Button */}
        <motion.div variants={rowItem} className="pt-4">
          <button
            onClick={handleSaveAll}
            disabled={saving === "all"}
            className="w-full py-3 bg-fuchsia-600/20 hover:bg-fuchsia-600/40 border border-fuchsia-500/40 rounded-xl text-fuchsia-300 font-mono text-sm uppercase tracking-widest transition-all hover:shadow-[0_0_20px_rgba(255,0,255,0.2)] disabled:opacity-50"
          >
            {saving === "all" ? "Saving..." : "Save Agent Config"}
          </button>
        </motion.div>

        {/* Provider Summary — dynamically shows providers from config */}
        {providerCount > 0 && (
          <>
            <hr className="border-fuchsia-500/15 my-2" />
            <div className="flex items-center gap-2 mb-1">
              <Brain size={16} className="text-fuchsia-400" />
              <h3 className="text-sm font-mono text-gray-200 uppercase tracking-wider">Connected AI Providers</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.keys(modelInfo).map(k => (
                <span key={k} className="px-3 py-1.5 rounded-lg border border-fuchsia-500/20 bg-fuchsia-900/5 text-fuchsia-300 font-mono text-xs uppercase">
                  {k} ({modelInfo[k].models?.length || 0})
                </span>
              ))}
            </div>
          </>
        )}

      </motion.div>

      {/* Status Toast */}
      {statusMsg && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-green-900/80 border border-green-500/40 text-green-300 font-mono text-sm px-4 py-2 rounded-xl backdrop-blur-lg z-50">
          {statusMsg}
        </motion.div>
      )}
    </ConfigPageShell>
  );
};

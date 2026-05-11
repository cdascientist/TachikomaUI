import React, { useState } from "react";
import { motion } from "motion/react";
import Card from "@mui/joy/Card";
import Switch from "@mui/joy/Switch";
import Typography from "@mui/joy/Typography";
import Chip from "@mui/joy/Chip";
import Stack from "@mui/joy/Stack";
import Divider from "@mui/joy/Divider";
import { ConfigPageShell } from "./ConfigPageShell";
import { useApi } from "../hooks/useApi";
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
      const updates = {
        plugins: {
          entries: { [pluginKey]: { enabled: !currentEnabled } }
        }
      };
      await fetch("/api/openclaw/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      refetch();
    } finally {
      setToggling(null);
    }
  };

  const plugins = data?.plugins?.entries || {};
  const tools = data?.tools || {};
  const pluginKeys = Object.keys(plugins);

  return (
    <ConfigPageShell title="Skills Config" description="Plugin registry, tool enablement, and skill runtime settings from OpenClaw" accentColor="cyan" loading={loading} error={error} onRetry={refetch}>
      <motion.div variants={container} initial="hidden" animate="show">
        <Typography level="title-lg" fontFamily="monospace" startDecorator={<Puzzle size={18} />} sx={{ color: "#e2e8f0", mb: 1.5 }}>
          Plugins
        </Typography>
        <Stack spacing={1.5} sx={{ mb: 3 }}>
          {pluginKeys.map(key => (
            <motion.div key={key} variants={item} whileHover={{ scale: 1.01 }}>
              <Card variant="outlined" sx={{ p: 2, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 12, borderColor: "rgba(6,182,212,0.2)", bg: "rgba(6,182,212,0.03)" }}>
                <div>
                  <Typography fontFamily="monospace" level="title-sm" sx={{ color: "#e2e8f0" }}>{key}</Typography>
                  <Typography level="body-xs" fontFamily="monospace" sx={{ color: "#6b7280" }}>
                    {plugins[key]?.enabled ? "Active" : "Disabled"}
                  </Typography>
                </div>
                <Switch
                  checked={!!plugins[key]?.enabled}
                  disabled={toggling === key}
                  onChange={() => handleToggle(key, !!plugins[key]?.enabled)}
                  sx={{ "--Switch-trackBackground": plugins[key]?.enabled ? "#06b6d4" : "#374151" }}
                />
              </Card>
            </motion.div>
          ))}
          {pluginKeys.length === 0 && (
            <Typography level="body-sm" fontFamily="monospace" sx={{ color: "#6b7280" }}>No plugins configured</Typography>
          )}
        </Stack>

        <Divider sx={{ my: 2, borderColor: "rgba(6,182,212,0.15)" }} />

        <Typography level="title-lg" fontFamily="monospace" startDecorator={<Wrench size={18} />} sx={{ color: "#e2e8f0", mb: 1.5 }}>
          Tools
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {tools?.web?.search?.enabled && (
            <Chip variant="soft" color="primary" startDecorator={<Zap size={12} />} sx={{ fontFamily: "monospace" }}>
              Web Search ({tools.web.search.provider})
            </Chip>
          )}
          {Object.keys(tools).length === 0 && (
            <Typography level="body-sm" fontFamily="monospace" sx={{ color: "#6b7280" }}>No tools configured</Typography>
          )}
        </Stack>
      </motion.div>
    </ConfigPageShell>
  );
};

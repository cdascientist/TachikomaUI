import React from "react";
import { motion } from "motion/react";
import Accordion from "@mui/joy/Accordion";
import AccordionGroup from "@mui/joy/AccordionGroup";
import AccordionSummary from "@mui/joy/AccordionSummary";
import AccordionDetails from "@mui/joy/AccordionDetails";
import Table from "@mui/joy/Table";
import Typography from "@mui/joy/Typography";
import Chip from "@mui/joy/Chip";
import Card from "@mui/joy/Card";
import LinearProgress from "@mui/joy/LinearProgress";
import CircularProgress from "@mui/joy/CircularProgress";
import Stack from "@mui/joy/Stack";
import Divider from "@mui/joy/Divider";
import { ConfigPageShell } from "./ConfigPageShell";
import { useApi } from "../hooks/useApi";
import { Cpu, HardDrive, Clock, Server, Brain } from "lucide-react";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const rowItem = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };

interface ProviderModel { id: string; name: string; contextWindow: number; maxTokens: number }
interface Provider { baseUrl: string; models: ProviderModel[] }
interface SvcInfo { active: string; substate: string; startedAt: string }
interface Resources { memory: { total: number; used: number; free: number; available: number }; disk: { total: number; used: number; available: number }; uptime: string }

const providerColors: Record<string, string> = {
  deepseek: "#06b6d4",
  moonshot: "#f59e0b",
  gemini: "#3b82f6",
};

export const SystemConfigPage: React.FC = () => {
  const { data: config, loading: cfgLoading, refetch: refetchCfg } = useApi<any>("/api/openclaw/config");
  const { data: services, loading: svcLoading, refetch: refetchSvc } = useApi<Record<string, SvcInfo>>("/api/system/services");
  const { data: resources, loading: resLoading, refetch: refetchRes } = useApi<Resources>("/api/system/resources");

  const loading = cfgLoading || svcLoading || resLoading;
  const error = null;
  const handleRetry = () => { refetchCfg(); refetchSvc(); refetchRes(); };

  const providers: Record<string, Provider> = config?.models?.providers || {};
  const servicesData = services || {};
  const res = resources;

  const ramPercent = res ? Math.round((res.memory.used / res.memory.total) * 100) : 0;
  const diskPercent = res ? Math.round((res.disk.used / res.disk.total) * 100) : 0;

  const formatBytes = (b: number) => {
    if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`;
    if (b >= 1e6) return `${(b / 1e6).toFixed(0)} MB`;
    if (b >= 1e3) return `${(b / 1e3).toFixed(0)} KB`;
    return `${b} B`;
  };

  return (
    <ConfigPageShell title="System Config" description="Model providers, service health, resource utilization, and runtime settings" accentColor="purple" loading={loading} error={error} onRetry={handleRetry}>
      <motion.div variants={container} initial="hidden" animate="show">
        {/* Model Providers */}
        <Typography level="title-lg" fontFamily="monospace" startDecorator={<Brain size={18} />} sx={{ color: "#e2e8f0", mb: 1.5 }}>
          Model Providers
        </Typography>
        <AccordionGroup sx={{ mb: 3 }}>
          {Object.entries(providers).map(([key, provider]) => (
            <motion.div key={key} variants={rowItem}>
              <Accordion sx={{ borderRadius: 12, mb: 1, borderColor: `${providerColors[key] || "#9333ea"}30`, bg: `${providerColors[key] || "#9333ea"}08` }}>
                <AccordionSummary sx={{ fontFamily: "monospace", color: providerColors[key] || "#c084fc", textTransform: "capitalize" }}>
                  {key} ({provider.models.length} models)
                </AccordionSummary>
                <AccordionDetails>
                  <Table size="sm" sx={{ "& th": { fontFamily: "monospace", fontSize: 11, color: "#a78bfa" }, "& td": { fontFamily: "monospace", fontSize: 12, color: "#d1d5db" } }}>
                    <thead><tr><th>Model ID</th><th>Context</th><th>Max Tokens</th></tr></thead>
                    <tbody>
                      {provider.models.map(m => (
                        <tr key={m.id}>
                          <td>{m.id}</td>
                          <td>{(m.contextWindow / 1000).toFixed(0)}K</td>
                          <td>{(m.maxTokens / 1000).toFixed(0)}K</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </AccordionDetails>
              </Accordion>
            </motion.div>
          ))}
          {Object.keys(providers).length === 0 && (
            <Typography level="body-sm" fontFamily="monospace" sx={{ color: "#6b7280" }}>No providers configured</Typography>
          )}
        </AccordionGroup>

        <Divider sx={{ my: 2, borderColor: "rgba(147,51,234,0.15)" }} />

        {/* Services */}
        <Typography level="title-lg" fontFamily="monospace" startDecorator={<Server size={18} />} sx={{ color: "#e2e8f0", mb: 1.5 }}>
          Services
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2.5 }}>
          {Object.entries(servicesData).map(([key, svc]) => (
            <Chip key={key} size="sm" variant="soft" color={svc.active === "running" ? "success" : "danger"} sx={{ fontFamily: "monospace", fontSize: 12 }}>
              {key.replace(".service", "")}: {svc.active === "running" ? "UP" : "DOWN"}
            </Chip>
          ))}
          {Object.keys(servicesData).length === 0 && (
            <Typography level="body-sm" fontFamily="monospace" sx={{ color: "#6b7280" }}>No service data</Typography>
          )}
        </Stack>

        {/* Resources */}
        {res && (
          <motion.div variants={rowItem}>
            <Typography level="title-lg" fontFamily="monospace" startDecorator={<Cpu size={18} />} sx={{ color: "#e2e8f0", mb: 1.5 }}>
              Resources
            </Typography>
            <Stack spacing={2}>
              <Card variant="outlined" sx={{ p: 2, borderRadius: 12, borderColor: "rgba(147,51,234,0.2)", bg: "rgba(147,51,234,0.03)" }}>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
                  <Cpu size={18} style={{ color: "#a78bfa" }} />
                  <Typography fontFamily="monospace" level="title-sm" sx={{ color: "#e2e8f0" }}>RAM</Typography>
                  <Typography fontFamily="monospace" level="body-xs" sx={{ color: "#9ca3af", ml: "auto" }}>
                    {formatBytes(res.memory.used)} / {formatBytes(res.memory.total)}
                  </Typography>
                </Stack>
                <LinearProgress determinate value={ramPercent} sx={{ color: ramPercent > 85 ? "#ef4444" : "#a78bfa", borderRadius: 8 }} />
              </Card>
              <Card variant="outlined" sx={{ p: 2, borderRadius: 12, borderColor: "rgba(147,51,234,0.2)", bg: "rgba(147,51,234,0.03)" }}>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
                  <HardDrive size={18} style={{ color: "#a78bfa" }} />
                  <Typography fontFamily="monospace" level="title-sm" sx={{ color: "#e2e8f0" }}>Disk</Typography>
                  <Typography fontFamily="monospace" level="body-xs" sx={{ color: "#9ca3af", ml: "auto" }}>
                    {formatBytes(res.disk.used)} / {formatBytes(res.disk.total)}
                  </Typography>
                </Stack>
                <LinearProgress determinate value={diskPercent} sx={{ color: diskPercent > 85 ? "#ef4444" : "#a78bfa", borderRadius: 8 }} />
              </Card>
              <Card variant="outlined" sx={{ p: 2, borderRadius: 12, borderColor: "rgba(147,51,234,0.2)", bg: "rgba(147,51,234,0.03)" }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Clock size={18} style={{ color: "#a78bfa" }} />
                  <Typography fontFamily="monospace" level="title-sm" sx={{ color: "#e2e8f0" }}>Uptime</Typography>
                  <Typography fontFamily="monospace" level="body-sm" sx={{ color: "#c084fc", ml: "auto" }}>{res.uptime}</Typography>
                </Stack>
              </Card>
            </Stack>
          </motion.div>
        )}
      </motion.div>
    </ConfigPageShell>
  );
};

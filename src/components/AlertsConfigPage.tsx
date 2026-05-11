import React from "react";
import { motion } from "motion/react";
import Table from "@mui/joy/Table";
import Typography from "@mui/joy/Typography";
import Chip from "@mui/joy/Chip";
import Card from "@mui/joy/Card";
import Stack from "@mui/joy/Stack";
import Switch from "@mui/joy/Switch";
import Divider from "@mui/joy/Divider";
import { ConfigPageShell } from "./ConfigPageShell";
import { useApi } from "../hooks/useApi";
import { Activity, Bell, Server } from "lucide-react";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };
const rowItem = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

interface SvcInfo { active: string; substate: string; startedAt: string }

const serviceLabels: Record<string, string> = {
  "tachikoma-ui.service": "TachikomaUI",
  "sendblue-poller.service": "SendBlue Poller",
  "tachikoma.service": "Tachikoma Web App",
};

export const AlertsConfigPage: React.FC = () => {
  const { data, loading, error, refetch } = useApi<Record<string, SvcInfo>>("/api/system/services");

  const services = data || {};
  const svcKeys = Object.keys(services);

  return (
    <ConfigPageShell title="Alerts Config" description="Service health, VMQ alert pipeline status, and iMessage notification monitor" accentColor="yellow" loading={loading} error={error} onRetry={refetch}>
      <motion.div variants={container} initial="hidden" animate="show">
        <Typography level="title-lg" fontFamily="monospace" startDecorator={<Server size={18} />} sx={{ color: "#e2e8f0", mb: 1.5 }}>
          Services
        </Typography>
        <Table variant="outlined" sx={{ borderRadius: 12, borderColor: "rgba(202,138,4,0.2)", mb: 3, "& th": { fontFamily: "monospace", fontSize: 12, color: "#facc15" }, "& td": { fontFamily: "monospace", fontSize: 13 } }}>
          <thead>
            <tr><th>Service</th><th>Status</th><th>Started</th></tr>
          </thead>
          <tbody>
            {svcKeys.map(key => {
              const svc = services[key];
              const running = svc.active === "running";
              return (
                <motion.tr key={key} variants={rowItem}>
                  <td style={{ color: "#e2e8f0" }}>{serviceLabels[key] || key}</td>
                  <td>
                    <Chip size="sm" variant="soft" color={running ? "success" : "danger"} sx={{ fontFamily: "monospace" }}>
                      {running ? "RUNNING" : svc.active || "unknown"}
                    </Chip>
                  </td>
                  <td style={{ color: "#9ca3af", fontSize: 11 }}>{svc.startedAt ? new Date(parseInt(svc.startedAt) / 1000).toLocaleString() : "—"}</td>
                </motion.tr>
              );
            })}
            {svcKeys.length === 0 && (
              <tr><td colSpan={3} style={{ color: "#6b7280", textAlign: "center", padding: 16 }}>No service data</td></tr>
            )}
          </tbody>
        </Table>

        <Divider sx={{ my: 2, borderColor: "rgba(202,138,4,0.15)" }} />

        <Typography level="title-lg" fontFamily="monospace" startDecorator={<Bell size={18} />} sx={{ color: "#e2e8f0", mb: 1.5 }}>
          Alert Pipeline
        </Typography>
        <Stack spacing={1.5}>
          {[
            { label: "VMQ Alerts", key: "vmq" },
            { label: "iMessage Notifications", key: "imessage" },
          ].map(cfg => (
            <motion.div key={cfg.key} variants={rowItem}>
              <Card variant="outlined" sx={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", p: 2, borderRadius: 12, borderColor: "rgba(202,138,4,0.2)", bg: "rgba(202,138,4,0.03)" }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Activity size={16} style={{ color: "#facc15" }} />
                  <Typography fontFamily="monospace" level="title-sm" sx={{ color: "#e2e8f0" }}>{cfg.label}</Typography>
                </Stack>
                <Switch defaultChecked sx={{ "--Switch-trackBackground": "#ca8a04" }} />
              </Card>
            </motion.div>
          ))}
        </Stack>
      </motion.div>
    </ConfigPageShell>
  );
};

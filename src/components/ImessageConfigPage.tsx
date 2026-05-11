import React, { useState } from "react";
import { motion } from "motion/react";
import Table from "@mui/joy/Table";
import Typography from "@mui/joy/Typography";
import Card from "@mui/joy/Card";
import Chip from "@mui/joy/Chip";
import Button from "@mui/joy/Button";
import Stack from "@mui/joy/Stack";
import Snackbar from "@mui/joy/Snackbar";
import Divider from "@mui/joy/Divider";
import { ConfigPageShell } from "./ConfigPageShell";
import { useApi } from "../hooks/useApi";
import { MessageCircle, Send, AlertTriangle, CheckCircle, Clock, Zap } from "lucide-react";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
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
    { label: "Total (7d)", value: s.total, icon: <MessageCircle size={20} />, color: "#06b6d4" },
    { label: "Responded", value: s.responded, icon: <CheckCircle size={20} />, color: "#22c55e" },
    { label: "Pending", value: s.pending, icon: <Clock size={20} />, color: "#f59e0b" },
    { label: "Failed", value: s.failed, icon: <AlertTriangle size={20} />, color: "#ef4444" },
  ];

  return (
    <ConfigPageShell title="iMessage Config" description="SendBlue relay status, message log, delivery stats, and force-respond controls" accentColor="green" loading={statsLoading && logLoading} error={null} onRetry={() => { refetchStats(); refetchLog(); }}>
      <motion.div variants={container} initial="hidden" animate="show">
        {/* Stats Row */}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 2.5 }}>
          {statCards.map(card => (
            <motion.div key={card.label} style={{ flex: 1 }} variants={rowItem}>
              <Card variant="outlined" sx={{ p: 2, textAlign: "center", borderRadius: 12, borderColor: `${card.color}30`, bg: `${card.color}08` }}>
                <Stack direction="row" spacing={1} justifyContent="center" alignItems="center" sx={{ mb: 0.5, color: card.color }}>
                  {card.icon}
                </Stack>
                <Typography level="h3" fontFamily="monospace" sx={{ color: "#e2e8f0", fontSize: "1.5rem" }}>
                  {card.value}
                </Typography>
                <Typography level="body-xs" fontFamily="monospace" sx={{ color: "#9ca3af" }}>{card.label}</Typography>
              </Card>
            </motion.div>
          ))}
        </Stack>

        <Divider sx={{ my: 2, borderColor: "rgba(22,163,74,0.15)" }} />

        {/* Force Controls */}
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
          <Typography level="title-lg" fontFamily="monospace" startDecorator={<Send size={18} />} sx={{ color: "#e2e8f0" }}>
            Message Log
          </Typography>
          <Button
            size="sm"
            loading={forcing}
            onClick={handleForce}
            color="warning"
            variant="solid"
            startDecorator={<Zap size={14} />}
            sx={{ fontFamily: "monospace", fontSize: 12, textTransform: "uppercase" }}
          >
            Force All
          </Button>
        </Stack>

        {/* Log Table */}
        <Table variant="outlined" sx={{ borderRadius: 12, borderColor: "rgba(22,163,74,0.2)", maxHeight: 360, overflow: "auto", display: "block", "& th": { fontFamily: "monospace", fontSize: 11, color: "#4ade80" }, "& td": { fontFamily: "monospace", fontSize: 12 }, "& tbody": { display: "block" }, "& thead": { display: "block" } }}>
          <thead><tr><th style={{ width: 130 }}>From</th><th style={{ width: 200 }}>Content</th><th style={{ width: 80 }}>Dir</th><th style={{ width: 90 }}>Status</th><th style={{ width: 140 }}>Time</th></tr></thead>
          <tbody style={{ display: "block", maxHeight: 300, overflow: "auto" }}>
            {logEntries.map(entry => (
              <motion.tr key={entry.id} variants={rowItem}>
                <td style={{ width: 130, color: "#e2e8f0" }}>{entry.from_number}</td>
                <td style={{ width: 200, color: "#d1d5db", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200, display: "inline-block" }}>
                  {entry.content || "—"}
                </td>
                <td style={{ width: 80 }}>
                  <Chip size="sm" variant="soft" color={entry.direction === "inbound" ? "primary" : "neutral"} sx={{ fontFamily: "monospace", fontSize: 10 }}>
                    {entry.direction}
                  </Chip>
                </td>
                <td style={{ width: 90 }}>
                  <Chip size="sm" variant="soft" color={entry.status === "responded" ? "success" : entry.status === "failed" ? "danger" : "warning"} sx={{ fontFamily: "monospace", fontSize: 10 }}>
                    {entry.status}
                  </Chip>
                </td>
                <td style={{ width: 140, color: "#6b7280", fontSize: 11 }}>{entry.created_at ? new Date(entry.created_at).toLocaleString() : "—"}</td>
              </motion.tr>
            ))}
            {logEntries.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: "center", color: "#6b7280", padding: 16 }}>No messages in log</td></tr>
            )}
          </tbody>
        </Table>
      </motion.div>
      <Snackbar open={!!forceMsg} color="success" variant="solid" autoHideDuration={3000} onClose={() => setForceMsg("")} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        {forceMsg}
      </Snackbar>
    </ConfigPageShell>
  );
};

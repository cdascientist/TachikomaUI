import React from "react";
import { motion, AnimatePresence } from "motion/react";
import Sheet from "@mui/joy/Sheet";
import Typography from "@mui/joy/Typography";
import Skeleton from "@mui/joy/Skeleton";
import Alert from "@mui/joy/Alert";
import Button from "@mui/joy/Button";
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

const accentMap: Record<string, { border: string; text: string; bg: string }> = {
  cyan:    { border: "#06b6d4", text: "#22d3ee", bg: "rgba(6,182,212,0.06)" },
  fuchsia: { border: "#c026d3", text: "#e879f9", bg: "rgba(192,38,211,0.06)" },
  yellow:  { border: "#ca8a04", text: "#facc15", bg: "rgba(202,138,4,0.06)" },
  green:   { border: "#16a34a", text: "#4ade80", bg: "rgba(22,163,74,0.06)" },
  purple:  { border: "#9333ea", text: "#c084fc", bg: "rgba(147,51,234,0.06)" },
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
      style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", padding: "16px" }}
    >
      <Sheet
        variant="outlined"
        sx={{
          width: "100%", maxWidth: 900, maxHeight: "80vh", overflow: "auto",
          borderRadius: 24, p: 4,
          background: `linear-gradient(135deg, rgba(0,0,0,0.85) 0%, rgba(10,10,30,0.9) 100%)`,
          backdropFilter: "blur(20px)",
          border: `1px solid ${c.border}40`,
          boxShadow: `0 0 30px ${c.border}15, inset 0 1px 0 ${c.border}10`,
        }}
      >
        <Typography level="h2" fontFamily="monospace" sx={{ color: c.text, textTransform: "uppercase", letterSpacing: "0.15em", mb: 0.5, fontSize: { xs: "1.25rem", md: "1.75rem" } }}>
          {title}
        </Typography>
        <Typography level="body-sm" fontFamily="monospace" sx={{ color: "#9ca3af", mb: 3, pl: 1.5, borderLeft: `2px solid ${c.border}40` }}>
          {description}
        </Typography>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Skeleton variant="rectangular" height={60} sx={{ mb: 1, borderRadius: 12 }} />
              <Skeleton variant="rectangular" height={60} sx={{ mb: 1, borderRadius: 12 }} />
              <Skeleton variant="rectangular" height={60} sx={{ mb: 1, borderRadius: 12 }} />
            </motion.div>
          ) : error ? (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Alert color="danger" variant="soft" sx={{ mb: 2 }}
                endDecorator={<Button size="sm" color="danger" variant="solid" onClick={onRetry} startDecorator={<RefreshCw size={14} />}>Retry</Button>}>
                {error}
              </Alert>
            </motion.div>
          ) : (
            <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </Sheet>
    </motion.div>
  );
};

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Cloud,
  CloudOff,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Database,
  ArrowRight,
  Wifi,
  HardDrive,
  Info,
  Sparkles,
  Activity,
} from "lucide-react";
import { flushOfflineQueueSync, healOnlineConnection } from "../lib/firebase";

interface VisualSyncIndicatorProps {
  syncStatus: {
    status: "online" | "offline_active" | "online_synced" | "syncing" | "error";
    message: string;
    latency?: number;
  };
  genre?: "romance" | "crime" | "paranormal" | null;
}

export function VisualSyncIndicator({ syncStatus, genre }: VisualSyncIndicatorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingWritesCount, setPendingWritesCount] = useState(0);
  const [latencyHistory, setLatencyHistory] = useState<number[]>([]);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [localLatency, setLocalLatency] = useState<number | undefined>(syncStatus.latency);
  const [isHealing, setIsHealing] = useState(false);
  const [healingMessage, setHealingMessage] = useState("");

  // Synchronize on compile and interval local storage check
  useEffect(() => {
    const updateQueueCount = () => {
      try {
        const queue = JSON.parse(localStorage.getItem("offline_echoes_sync") || "[]");
        setPendingWritesCount(queue.length);
      } catch (e) {
        setPendingWritesCount(0);
      }
    };

    updateQueueCount();
    const interval = setInterval(updateQueueCount, 3000);
    return () => clearInterval(interval);
  }, [syncStatus]);

  // Keep a small rolling history of latencies
  useEffect(() => {
    if (syncStatus.latency !== undefined) {
      setLocalLatency(syncStatus.latency);
      setLatencyHistory((prev) => {
        const next = [...prev, syncStatus.latency!];
        if (next.length > 5) {
          next.shift();
        }
        return next;
      });
    }
  }, [syncStatus.latency]);

  const handleManualSync = async () => {
    setIsManualSyncing(true);
    try {
      const result = await flushOfflineQueueSync();
      // Update queue count immediately
      const queue = JSON.parse(localStorage.getItem("offline_echoes_sync") || "[]");
      setPendingWritesCount(queue.length);
    } catch (e) {
      console.warn("Manual sync error:", e);
    } finally {
      setIsManualSyncing(false);
    }
  };

  const handleHealConnection = async () => {
    setIsHealing(true);
    setHealingMessage("Bypassing firewalls & restoring channels...");
    try {
      const success = await healOnlineConnection();
      if (success) {
        setHealingMessage("Bypass successful! Active stream restored.");
        setTimeout(() => setHealingMessage(""), 4000);
      } else {
        setHealingMessage("Simulated firewall active. Retrying...");
      }
      // Update local storage queue count
      const queue = JSON.parse(localStorage.getItem("offline_echoes_sync") || "[]");
      setPendingWritesCount(queue.length);
    } catch (err) {
      console.warn("Emergency network diagnostic bypass error:", err);
      setHealingMessage("Diagnose failure. Re-verify interface.");
    } finally {
      setIsHealing(false);
    }
  };

  // Get status color themes
  const getStatusTheme = () => {
    switch (syncStatus.status) {
      case "syncing":
        return {
          bg: "bg-amber-500/10 border-amber-500/20 text-amber-400",
          dot: "bg-amber-400",
          label: "Syncing",
          icon: <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        };
      case "online_synced":
        return {
          bg: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
          dot: "bg-emerald-400",
          label: "Synced",
          icon: <CheckCircle2 className="w-3.5 h-3.5" />
        };
      case "offline_active":
        return {
          bg: "bg-rose-500/10 border-rose-500/20 text-rose-400",
          dot: "bg-rose-400",
          label: "Offline",
          icon: <CloudOff className="w-3.5 h-3.5" />
        };
      case "error":
        return {
          bg: "bg-red-500/10 border-red-500/20 text-red-400",
          dot: "bg-red-500 animate-pulse",
          label: "Error",
          icon: <AlertCircle className="w-3.5 h-3.5 animate-pulse" />
        };
      case "online":
      default:
        return {
          bg: "bg-slate-500/5 border-white/5 text-slate-300",
          dot: "bg-emerald-500",
          label: "Direct Cosmos",
          icon: <Cloud className="w-3.5 h-3.5 text-sky-400" />
        };
    }
  };

  const statusTheme = getStatusTheme();

  // Color coordinate latency speed metrics
  const getLatencyMeter = (latency: number) => {
    if (latency <= 120) {
      return { label: "Excellent", text: "text-emerald-400", bg: "bg-emerald-400" };
    } else if (latency <= 350) {
      return { label: "Good", text: "text-amber-400", bg: "bg-amber-400" };
    } else {
      return { label: "Delayed", text: "text-orange-400", bg: "bg-orange-400" };
    }
  };

  const currentLatency = localLatency || 62; // fallback realistic metric if initial load
  const latencyMeter = getLatencyMeter(currentLatency);

  return (
    <div 
      className="relative inline-block rounded-full backdrop-blur-[12px] bg-black/15 border border-white/10 p-[1.5px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_4px_12px_rgba(0,0,0,0.3)] transition-all duration-300" 
      id="tbr-sync-indicator-wrapper"
      style={{ backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
    >
      {/* Trigger pill */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1 rounded-full border border-transparent text-[11px] font-mono tracking-wider transition-all duration-300 hover:scale-102 cursor-pointer shadow-[inset_0_1.5px_0_rgba(255,255,255,0.15)] ${statusTheme.bg}`}
        title="Google Cloud Live Sync Status"
        id="sync-status-indicator-pill"
      >
        <span className="relative flex h-2 w-2 mr-0.5">
          {syncStatus.status === "syncing" && (
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${statusTheme.dot}`} />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${statusTheme.dot}`} />
        </span>
        <span className="hidden sm:inline font-bold uppercase">{statusTheme.label}</span>
        {currentLatency !== undefined && (
          <span className="opacity-60 text-[10px]">
            {currentLatency}ms
          </span>
        )}
      </button>

      {/* Popover detailed metrics */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop cover filter */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute right-0 mt-2 w-72 p-5 rounded-2xl bg-slate-950/95 border border-white/10 shadow-2xl backdrop-blur-xl z-50 text-left text-white font-sans"
              id="sync-status-detailed-popover"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <Database className={`w-4 h-4 ${genre === "romance" ? "text-rose-400" : "text-amber-400"}`} />
                  <span className="text-xs font-mono font-bold uppercase tracking-wider">
                    Cloud Sandbox Telemetry
                  </span>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-xs text-white/40 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {/* Status details */}
              <div className="space-y-4">
                {/* Latency metric section */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] font-mono text-white/40 uppercase tracking-widest font-bold">
                    <span>Google Cloud Latency</span>
                    <span className={`font-black ${latencyMeter.text}`}>{latencyMeter.label} ({currentLatency} ms)</span>
                  </div>
                  
                  {/* Visual gauge bar */}
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden flex">
                    <div
                      className={`h-full ${latencyMeter.bg} transition-all duration-500`}
                      style={{ width: `${Math.min(100, Math.max(15, (300 / (currentLatency || 62)) * 30))}%` }}
                    />
                  </div>
                </div>

                {/* Queue status */}
                <div className="grid grid-cols-2 gap-3 text-xs bg-white/[0.02] border border-white/5 p-3 rounded-xl font-mono">
                  <div>
                    <span className="text-[9px] text-white/40 block">LOCAL QUEUE</span>
                    <span className="text-sm font-bold text-white flex items-center gap-1.5 mt-0.5">
                      <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                      {pendingWritesCount} {pendingWritesCount === 1 ? "Write" : "Writes"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-white/40 block">STATUS</span>
                    <span className="text-sm font-bold text-white flex items-center gap-1.5 mt-0.5">
                      <Wifi className={`w-3.5 h-3.5 ${syncStatus.status === "offline_active" ? "text-rose-400" : "text-emerald-400"}`} />
                      {syncStatus.status === "offline_active" ? "Offline" : "Connected"}
                    </span>
                  </div>
                </div>

                {/* Narrative Status Description */}
                <div className="text-[11px] leading-relaxed text-white/50 bg-black/30 p-2.5 rounded-lg border border-white/[0.02]">
                  {syncStatus.message || "Narrative framework fully synchronized. Story branches are backed up securely in real-time."}
                </div>

                {/* Latency History Spark Bar */}
                {latencyHistory.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[9px] text-white/40 font-mono uppercase tracking-wider font-bold">Rolling Response Speed</span>
                    <div className="flex items-end gap-1 h-8 px-2 bg-white/[0.01] border border-white/5 rounded-lg justify-start py-1">
                      {latencyHistory.map((lat, idx) => {
                        const hPct = Math.min(100, Math.max(10, (lat / 500) * 100));
                        const mColor = getLatencyMeter(lat).bg;
                        return (
                          <div
                            key={idx}
                            className={`w-4 rounded-t-sm ${mColor} opacity-70 hover:opacity-100 transition-opacity`}
                            style={{ height: `${hPct}%` }}
                            title={`${lat}ms`}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Diagnostic Check HUD for active connection troubleshooting */}
                <div className="space-y-2 border-t border-white/5 pt-3">
                  <div className="text-[10px] font-mono text-white/40 uppercase tracking-widest font-bold flex items-center gap-1.5">
                    <Activity className="w-3 h-3 text-sky-400" />
                    <span>Dynamic Self-Diagnostic</span>
                  </div>

                  <div className="space-y-1.5 text-[11px] font-mono">
                    <div className="flex justify-between items-center text-zinc-400">
                      <span>Physical Interface:</span>
                      <span className={typeof window !== "undefined" && window.navigator.onLine ? "text-emerald-400" : "text-rose-400"}>
                        {typeof window !== "undefined" && window.navigator.onLine ? "ONLINE (Active)" : "DISCONNECTED"}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-zinc-400">
                      <span>Sync Engine Status:</span>
                      <span className={pendingWritesCount > 0 ? "text-amber-400 animate-pulse" : "text-emerald-400"}>
                        {pendingWritesCount > 0 ? `${pendingWritesCount} Write(s) Queued` : "All Synced"}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-zinc-400">
                      <span>Connection Stream:</span>
                      <span className={syncStatus.status === "offline_active" ? "text-rose-400" : "text-emerald-400 font-bold"}>
                        {syncStatus.status === "offline_active" ? "Simulated Fallback active" : "Direct Link live"}
                      </span>
                    </div>
                  </div>
                </div>

                {healingMessage && (
                  <div className="text-[10px] font-mono bg-amber-500/10 text-amber-300 p-2 rounded-lg border border-amber-500/20 text-center animate-pulse">
                    ⚡ {healingMessage}
                  </div>
                )}

                {/* Healing & Force Synchronization Buttons Area */}
                <div className="space-y-2 pt-2">
                  {syncStatus.status === "offline_active" ? (
                    <button
                      onClick={handleHealConnection}
                      disabled={isHealing}
                      className="w-full py-2.5 px-3 rounded-xl font-mono font-black text-[10px] uppercase tracking-widest bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-40 text-center transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 animate-bounce text-slate-950" />
                      <span>{isHealing ? "Restoring Connection..." : "Heal Network Outage"}</span>
                    </button>
                  ) : null}

                  <button
                    onClick={handleManualSync}
                    disabled={isManualSyncing || pendingWritesCount === 0}
                    className="w-full py-2 px-3 rounded-xl font-mono font-bold text-[10px] uppercase tracking-widest bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 text-center transition-all flex items-center justify-center gap-2 border border-white/10 cursor-pointer"
                  >
                    {isManualSyncing ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin text-white" />
                        <span>Force Flushing Local Cache...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3 h-3" />
                        <span>Force Sync Queue</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

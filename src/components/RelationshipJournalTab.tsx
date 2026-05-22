import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Heart,
  Eye,
  TrendingUp,
  TrendingDown,
  Calendar,
  Sparkles,
  Scroll,
  User,
  Activity,
  History,
  AlertTriangle
} from "lucide-react";
import { db } from "../lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine
} from "recharts";

interface RelationshipLog {
  id: string;
  name: string;
  relationshipType: "affinity" | "suspicion";
  affinityChange: number;
  reason: string;
  timestamp: string;
}

interface RelationshipJournalTabProps {
  currentUserId: string;
  currentStoryId: string;
  genre: string | null;
}

export function RelationshipJournalTab({
  currentUserId,
  currentStoryId,
  genre
}: RelationshipJournalTabProps) {
  const [logs, setLogs] = useState<RelationshipLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNpc, setSelectedNpc] = useState<string | null>(null);

  // Subscribe to real-time relationship logs subcollection
  useEffect(() => {
    if (!currentUserId || !currentStoryId) return;

    const logsRef = collection(
      db,
      "users",
      currentUserId,
      "stories",
      currentStoryId,
      "relationship_logs"
    );
    const q = query(logsRef, orderBy("timestamp", "asc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loadedLogs: RelationshipLog[] = [];
        snapshot.forEach((doc) => {
          loadedLogs.push({ id: doc.id, ...doc.data() } as RelationshipLog);
        });
        setLogs(loadedLogs);
        setLoading(false);

        // Auto-select first NPC with logs if none chosen
        if (loadedLogs.length > 0) {
          const uniqueNpcs = Array.from(new Set(loadedLogs.map((l) => l.name)));
          setSelectedNpc((prev) => (prev && uniqueNpcs.includes(prev) ? prev : uniqueNpcs[0]));
        }
      },
      (error) => {
        console.error("Error fetching relationship logs:", error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [currentUserId, currentStoryId]);

  // List of unique NPCs from the logs
  const uniqueNpcs = Array.from(new Set(logs.map((l) => l.name)));

  // Generate dynamic chart data and running scores for a specific NPC
  const getChartDataForNpc = (npcName: string) => {
    const npclogs = logs.filter((l) => l.name === npcName);
    const dataPoints: { step: string; affinity: number; suspicion: number; reason: string }[] = [];

    let currentAffinity = 0;
    let currentSuspicion = 0;

    // Zero baseline
    dataPoints.push({
      step: "Start",
      affinity: 0,
      suspicion: 0,
      reason: "Initial baseline"
    });

    npclogs.forEach((log, index) => {
      const change = log.affinityChange;
      if (log.relationshipType === "suspicion") {
        currentSuspicion = Math.max(-100, Math.min(100, currentSuspicion + change));
      } else {
        currentAffinity = Math.max(-100, Math.min(100, currentAffinity + change));
      }

      dataPoints.push({
        step: `Choice ${index + 1}`,
        affinity: currentAffinity,
        suspicion: currentSuspicion,
        reason: log.reason
      });
    });

    return {
      points: dataPoints,
      currentAffinity,
      currentSuspicion,
      logsFiltered: npclogs
    };
  };

  const getGenreAesthetics = () => {
    switch (genre) {
      case "romance":
        return {
          themeText: "text-rose-950",
          themeBorder: "border-rose-200/50",
          themeBg: "bg-rose-50/10",
          barColorAffinity: "#f43f5e", // Rose 500
          barColorSuspicion: "#8b5cf6", // Violet 500
          gradientAffinity: "from-rose-500/20 to-rose-500/0",
          gradientSuspicion: "from-violet-500/20 to-violet-500/0",
          iconColor: "text-rose-500",
          activeChip: "bg-rose-500 text-white shadow-md shadow-rose-200",
          inactiveChip: "bg-rose-100/40 hover:bg-rose-100 text-rose-800 border-rose-100",
          chartGrid: "rgba(244, 63, 148, 0.05)"
        };
      case "crime":
        return {
          themeText: "text-yellow-100",
          themeBorder: "border-yellow-500/20",
          themeBg: "bg-zinc-950/40",
          barColorAffinity: "#10b981", // Emerald 500
          barColorSuspicion: "#ef4444", // Red 500 (Suspect)
          gradientAffinity: "from-emerald-500/20 to-emerald-500/0",
          gradientSuspicion: "from-red-500/20 to-red-500/0",
          iconColor: "text-yellow-500",
          activeChip: "bg-yellow-500 text-black font-semibold shadow-md",
          inactiveChip: "bg-white/[0.04] hover:bg-white/10 text-zinc-300 border-white/5",
          chartGrid: "rgba(255, 255, 255, 0.05)"
        };
      case "paranormal":
      default:
        return {
          themeText: "text-purple-100",
          themeBorder: "border-purple-500/20",
          themeBg: "bg-zinc-950/40",
          barColorAffinity: "#38bdf8", // Sky 400
          barColorSuspicion: "#a855f7", // Purple 500
          gradientAffinity: "from-sky-500/20 to-sky-500/0",
          gradientSuspicion: "from-purple-500/20 to-purple-500/0",
          iconColor: "text-purple-400",
          activeChip: "bg-purple-600 text-white shadow-lg shadow-purple-900/40 border-purple-500/40",
          inactiveChip: "bg-white/[0.04] hover:bg-white/10 text-zinc-300 border-white/5",
          chartGrid: "rgba(255, 255, 255, 0.05)"
        };
    }
  };

  const aes = getGenreAesthetics();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Activity className={`w-8 h-8 animate-pulse ${aes.iconColor}`} />
        <p className="text-xs font-mono opacity-50 tracking-widest uppercase">
          Aligning Affinity Metrics...
        </p>
      </div>
    );
  }

  if (logs.length === 0 || !selectedNpc) {
    return (
      <div className="py-16 text-center space-y-4 font-mono opacity-50 flex flex-col items-center justify-center border border-dashed border-current/15 rounded-2xl bg-white/[0.01]">
        <History className={`w-12 h-12 stroke-[1.25] scale-110 mb-2 opacity-80 ${aes.iconColor}`} />
        <p className="text-sm font-semibold tracking-wide uppercase">
          No NPC Relationships Established
        </p>
        <p className="text-[10px] max-w-sm tracking-wider leading-relaxed">
          Relationships, affinity logs, and suspicion charts will populate once you begin taking paths that involve other figures or characters.
        </p>
      </div>
    );
  }

  const { points: chartPoints, currentAffinity, currentSuspicion, logsFiltered } = getChartDataForNpc(selectedNpc);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6 items-start">
      {/* Left Column: NPC Selector Sidebar */}
      <div className="flex flex-col gap-3">
        <span className="text-[10px] uppercase font-black tracking-wider opacity-60 px-1 flex items-center gap-1.5">
          <User className="w-3.5 h-3.5" />
          Active Personas ({uniqueNpcs.length})
        </span>
        <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 scrollbar-none">
          {uniqueNpcs.map((name) => {
            const isSelected = selectedNpc === name;
            const npcLogs = logs.filter((l) => l.name === name);
            
            // Calc current totals for side mini scores
            let finalAff = 0;
            let finalSus = 0;
            npcLogs.forEach((l) => {
              if (l.relationshipType === "suspicion") {
                finalSus = Math.max(-100, Math.min(100, finalSus + l.affinityChange));
              } else {
                finalAff = Math.max(-100, Math.min(100, finalAff + l.affinityChange));
              }
            });

            return (
              <button
                key={name}
                onClick={() => setSelectedNpc(name)}
                className={`flex-none lg:w-full text-left px-4 py-3 rounded-xl border transition-all flex flex-col gap-1.5 border-current/5 min-w-[140px] ${
                  isSelected ? aes.activeChip : aes.inactiveChip
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold font-sans truncate">{name}</span>
                  <Activity className={`w-3 h-3 opacity-60 ${isSelected ? "animate-pulse" : ""}`} />
                </div>
                {/* Micro mini indicators */}
                <div className="flex items-center gap-2.5 text-[9px] font-mono opacity-80">
                  {finalAff !== 0 && (
                    <span className="flex items-center gap-0.5" title="Affinity">
                      <Heart className="w-2.5 h-2.5 fill-current/10" />
                      {finalAff > 0 ? `+${finalAff}` : finalAff}
                    </span>
                  )}
                  {finalSus !== 0 && (
                    <span className="flex items-center gap-0.5" title="Suspicion">
                      <Eye className="w-2.5 h-2.5" />
                      {finalSus > 0 ? `+${finalSus}` : finalSus}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Column: Detailed Relationship Dashboard */}
      <div className={`p-6 md:p-8 rounded-3xl border ${aes.themeBorder} ${aes.themeBg} space-y-8 min-h-[450px]`}>
        {/* Header Profile Dashboard */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-current/10">
          <div>
            <h3 className="text-xl font-bold tracking-tight uppercase border-b-2 border-current/10 pb-1 flex items-center gap-2">
              <span>{selectedNpc}</span>
              <span className="text-[10px] font-mono font-normal normal-case border px-2 py-0.5 rounded-full border-current/20 opacity-70">
                Log Timeline Active
              </span>
            </h3>
            <p className="text-xs opacity-60 font-medium mt-1.5 leading-relaxed font-sans max-w-md">
              Chronologically tracking interaction triggers, behavior changes, and mental states.
            </p>
          </div>

          {/* Current Score Cards */}
          <div className="flex items-center gap-3">
            {/* Affinity Gauge */}
            <div className="p-3 px-4 rounded-xl bg-black/10 border border-current/5 text-center flex flex-col gap-1 min-w-[90px]">
              <span className="text-[9px] font-mono opacity-50 uppercase tracking-widest flex items-center justify-center gap-1">
                <Heart className="w-2.5 h-2.5" />
                Affinity
              </span>
              <span className={`text-sm font-black font-sans ${currentAffinity > 0 ? "text-emerald-500" : currentAffinity < 0 ? "text-rose-500" : ""}`}>
                {currentAffinity > 0 ? `+${currentAffinity}` : currentAffinity}
              </span>
            </div>

            {/* Suspicion Gauge */}
            <div className="p-3 px-4 rounded-xl bg-black/10 border border-current/5 text-center flex flex-col gap-1 min-w-[90px]">
              <span className="text-[9px] font-mono opacity-50 uppercase tracking-widest flex items-center justify-center gap-1">
                <Eye className="w-2.5 h-2.5" />
                Suspicion
              </span>
              <span className={`text-sm font-black font-sans ${currentSuspicion > 0 ? "text-red-500" : currentSuspicion < 0 ? "text-blue-400" : ""}`}>
                {currentSuspicion > 0 ? `+${currentSuspicion}` : currentSuspicion}
              </span>
            </div>
          </div>
        </div>

        {/* Visual Trend Chart */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase tracking-wider opacity-60 px-1">
            <span>Affinity & Suspicion Progression</span>
            <span>Scale [-100 to 100]</span>
          </div>
          <div className="h-[210px] w-full bg-black/10 rounded-2xl border border-current/5 p-4 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartPoints} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAffinity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={aes.barColorAffinity} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={aes.barColorAffinity} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorSuspicion" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={aes.barColorSuspicion} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={aes.barColorSuspicion} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={aes.chartGrid} vertical={false} />
                <XAxis dataKey="step" stroke="currentColor" opacity={0.3} fontSize={9} fontStyle="italic" />
                <YAxis domain={[-100, 100]} stroke="currentColor" opacity={0.3} fontSize={9} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="p-3 rounded-xl bg-zinc-950 border border-white/10 shadow-2xl space-y-1 max-w-[220px] font-mono text-[9px]">
                          <p className="font-bold text-white uppercase tracking-wider">{data.step}</p>
                          <p className="text-zinc-400 font-serif italic border-b border-white/5 pb-1 mb-1 leading-normal">&quot;{data.reason}&quot;</p>
                          {payload.map((p) => (
                            <div key={p.name} className="flex justify-between gap-4 items-center">
                              <span className="opacity-60 text-white capitalize">{p.name}:</span>
                              <span className="font-bold font-sans" style={{ color: p.color }}>
                                {Number(p.value) > 0 ? `+${p.value}` : p.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine y={0} stroke="rgba(255, 255, 255, 0.15)" strokeDasharray="5 5" />
                <Area
                  type="monotone"
                  name="affinity"
                  dataKey="affinity"
                  stroke={aes.barColorAffinity}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorAffinity)"
                />
                <Area
                  type="monotone"
                  name="suspicion"
                  dataKey="suspicion"
                  stroke={aes.barColorSuspicion}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorSuspicion)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chronological Timeline Feed */}
        <div className="space-y-4">
          <span className="text-[10px] uppercase font-mono font-bold tracking-wider opacity-60 px-1 flex items-center gap-1.5">
            <History className="w-3.5 h-3.5" />
            Chronological Timeline Feed ({logsFiltered.length} updates)
          </span>

          <div className="space-y-4 max-h-[280px] overflow-y-auto pr-1">
            <AnimatePresence mode="popLayout">
              {logsFiltered.map((log, index) => {
                const isAff = log.relationshipType === "affinity";
                const change = log.affinityChange;
                const isPositive = change > 0;

                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex gap-4 p-4 rounded-xl border border-current/5 bg-black/5"
                  >
                    {/* Directional Icon Badge */}
                    <div className="flex-none flex flex-col items-center gap-1.5">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-black/20 border border-current/10`}>
                        {isAff ? (
                          <Heart className={`w-4 h-4 ${isPositive ? "text-emerald-500 fill-emerald-500/10" : "text-rose-500"}`} />
                        ) : (
                          <Eye className={`w-4 h-4 ${isPositive ? "text-red-500" : "text-blue-400"}`} />
                        )}
                      </div>
                      <span className="text-[8px] font-mono opacity-40 font-bold">
                        #{index + 1}
                      </span>
                    </div>

                    {/* Content Details */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <span className="text-xs font-bold leading-none font-sans flex items-center gap-1.5">
                          {isAff ? "Affinity Adjustment" : "Suspicion Adjustment"}
                          <span
                            className={`inline-flex items-center gap-0.5 text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                              isPositive
                                ? isAff
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                  : "bg-red-500/10 text-red-400 border-red-500/20"
                                : isAff
                                ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                            }`}
                          >
                            {isPositive ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : (
                              <TrendingDown className="w-3 h-3" />
                            )}
                            {isPositive ? `+${change}` : change}
                          </span>
                        </span>
                        <div className="flex items-center gap-1 text-[8px] font-mono opacity-40">
                          <Calendar className="w-2.5 h-2.5" />
                          <span>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>

                      <p className="text-xs font-serif italic leading-relaxed opacity-80 pl-1 border-l border-current/15">
                        &quot;{log.reason}&quot;
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

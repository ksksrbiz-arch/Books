import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  BookOpen,
  Users,
  MapPin,
  Sparkles,
  Search,
  Plus,
  Trash2,
  Edit2,
  X,
  FileText,
  Bookmark,
  Check,
  Eye,
  BookmarkCheck,
  Compass,
  KeyRound,
  Fingerprint,
  Heart,
  Scroll,
  Dna,
  RefreshCw,
  Star,
  Activity
} from "lucide-react";
import {
  db,
  auth,
  setDocSafe as setDoc,
  addDocSafe as addDoc
} from "../lib/firebase";
import {
  collection,
  doc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  updateDoc
} from "firebase/firestore";
import Markdown from "react-markdown";
import { RelationshipJournalTab } from "./RelationshipJournalTab";

export interface CodexEntry {
  id: string;
  title: string;
  category: "character" | "location" | "item" | "clue" | "lore" | "faction";
  content: string;
  sourceScene?: string;
  discoveredAt: string;
  status: "discovered" | "revealed" | "updated";
}

interface CodexLoreGlossaryProps {
  currentStoryId: string;
  currentNode: { sceneTitle: string; sceneDescription: string } | null;
  onClose: () => void;
  genre: string | null;
}

export function CodexLoreGlossary({
  currentStoryId,
  currentNode,
  onClose,
  genre
}: CodexLoreGlossaryProps) {
  const [entries, setEntries] = useState<CodexEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  // Form State for creating/editing entries
  const [isCreating, setIsCreating] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState<CodexEntry["category"]>("lore");
  const [formContent, setFormContent] = useState("");

  const currentUserId = auth.currentUser?.uid;

  // Real-time listener for codex collection
  useEffect(() => {
    if (!currentUserId || !currentStoryId) return;

    const codexRef = collection(db, "users", currentUserId, "stories", currentStoryId, "codex");
    const q = query(codexRef, orderBy("discoveredAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loadedEntries: CodexEntry[] = [];
        snapshot.forEach((doc) => {
          loadedEntries.push({ id: doc.id, ...doc.data() } as CodexEntry);
        });
        setEntries(loadedEntries);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching codex entries:", error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [currentUserId, currentStoryId]);

  // Auto-scan scene on mount if no entries exist
  useEffect(() => {
    if (!loading && entries.length === 0 && currentNode) {
      autoScanLore();
    }
  }, [loading, entries.length, currentNode]);

  const autoScanLore = async () => {
    try {
      setIsScanning(true);
      setScanMessage("Your archivist is exploring the atmosphere for details...");
      
      const response = await fetch("/api/story/codex/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneTitle: currentNode?.sceneTitle || "",
          sceneDescription: currentNode?.sceneDescription || "",
          existingCodex: entries.map(e => ({ title: e.title, category: e.category })),
          genre: genre || "mystery"
        })
      });

      if (!response.ok) throw new Error("Lore extraction failed");
      const data = await response.json();

      if (data.entries && data.entries.length > 0) {
        let addedCount = 0;
        for (const item of data.entries) {
          // Check if it already exists to avoid race conditions
          const exists = entries.some(e => e.title.toLowerCase() === item.title.toLowerCase());
          if (!exists) {
            const entryId = `codex_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            const codexDocRef = doc(db, "users", currentUserId!, "stories", currentStoryId, "codex", entryId);
            await setDoc(codexDocRef, {
              title: item.title,
              category: item.category,
              content: item.content,
              status: item.status || "discovered",
              sourceScene: currentNode?.sceneTitle || "Proem",
              discoveredAt: new Date().toISOString()
            });
            addedCount++;
          }
        }
        setScanMessage(`Success! Identified ${addedCount} lore elements in this scene!`);
      } else {
        setScanMessage("Scanned scene! No major new lore cards required.");
      }
    } catch (err) {
      console.error(err);
      setScanMessage("Archivist is currently resting.");
    } finally {
      setIsScanning(false);
      setTimeout(() => setScanMessage(null), 4000);
    }
  };

  const handleManualCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formContent.trim() || !currentUserId) return;

    try {
      const entryId = editingEntryId || `codex_${Date.now()}`;
      const codexDocRef = doc(db, "users", currentUserId, "stories", currentStoryId, "codex", entryId);
      
      const payload = {
        title: formTitle.trim(),
        category: formCategory,
        content: formContent.trim(),
        status: editingEntryId ? "updated" : "discovered",
        sourceScene: "Player Journal",
        discoveredAt: new Date().toISOString()
      };

      await setDoc(codexDocRef, payload);

      setIsCreating(false);
      setEditingEntryId(null);
      setFormTitle("");
      setFormCategory("lore");
      setFormContent("");
    } catch (err) {
      console.error("Error writing codex entry:", err);
    }
  };

  const startEdit = (entry: CodexEntry) => {
    setEditingEntryId(entry.id);
    setFormTitle(entry.title);
    setFormCategory(entry.category);
    setFormContent(entry.content);
    setIsCreating(true);
  };

  const handleDelete = async (entryId: string) => {
    if (!currentUserId) return;
    try {
      const docRef = doc(db, "users", currentUserId, "stories", currentStoryId, "codex", entryId);
      await deleteDoc(docRef);
    } catch (err) {
      console.error("Error deleting codex entry:", err);
    }
  };

  // Theme Config according to Genre
  const getThemeConfig = () => {
    switch (genre) {
      case "romance":
        return {
          title: "The Codex of Passion",
          subtitle: "Every heart, embrace, and vow recorded in destiny",
          bgColor: "bg-rose-50/90 border-rose-100 text-rose-950",
          cardBg: "bg-white hover:border-rose-300 border-rose-100 shadow-rose-100/30 text-rose-900",
          accentColor: "rose",
          tabStyle: {
            active: "bg-rose-500 text-white shadow-md shadow-rose-200",
            inactive: "text-rose-700 hover:bg-rose-100/80 bg-rose-50/50"
          },
          accentSvg: <Heart className="w-5 h-5 text-rose-500 fill-rose-500/20" />
        };
      case "crime":
        return {
          title: "Crime Dossier Ledger",
          subtitle: "Case file evidence log, suspects, and clues catalogue",
          bgColor: "bg-zinc-900/90 border-yellow-500/20 text-yellow-100",
          cardBg: "bg-zinc-950/80 hover:border-yellow-500/40 border-white/5 text-zinc-100 shadow-black",
          accentColor: "yellow",
          tabStyle: {
            active: "bg-yellow-500 text-black font-semibold shadow-md",
            inactive: "text-zinc-400 hover:bg-white/5 bg-white/[0.02]"
          },
          accentSvg: <Fingerprint className="w-5 h-5 text-yellow-500" />
        };
      case "paranormal":
      default:
        return {
          title: "The Grimoire of Truth",
          subtitle: "Mystic sightings, magical artifacts, and occult lore discovered",
          bgColor: "bg-zinc-950/95 border-purple-500/20 text-purple-100",
          cardBg: "bg-zinc-900/40 hover:border-purple-500/30 border-white/5 text-zinc-100 shadow-purple-950/20",
          accentColor: "purple",
          tabStyle: {
            active: "bg-purple-600 text-white shadow-lg shadow-purple-900/30",
            inactive: "text-zinc-400 hover:bg-white/5 bg-white/[0.02]"
          },
          accentSvg: <Scroll className="w-5 h-5 text-purple-400" />
        };
    }
  };

  const themeConfig = getThemeConfig();

  const getStatusStyling = (status: CodexEntry["status"]) => {
    const isRomance = genre === "romance";
    switch (status) {
      case "updated":
        return {
          label: "Updated",
          icon: <RefreshCw className="w-3 h-3 text-amber-500 animate-[spin_4s_linear_infinite]" />,
          badgeClass: isRomance 
            ? "bg-amber-100/95 text-amber-800 border-amber-200/60" 
            : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
          cardClass: isRomance
            ? "bg-amber-50/10 hover:bg-amber-50/30 border-amber-200 hover:border-amber-400 shadow-sm shadow-amber-100/30 text-rose-900"
            : "bg-yellow-950/10 hover:bg-yellow-950/20 border-yellow-500/20 hover:border-yellow-500/40 shadow-sm shadow-black text-zinc-100"
        };
      case "revealed":
        return {
          label: "Recently Revealed",
          icon: <Star className="w-3 h-3 text-blue-400 fill-blue-400/20 animate-pulse" />,
          badgeClass: isRomance 
            ? "bg-blue-100/95 text-blue-800 border-blue-200/60" 
            : "bg-blue-500/10 text-blue-400 border-blue-500/20",
          cardClass: isRomance
            ? "bg-blue-50/10 hover:bg-blue-50/30 border-blue-200 hover:border-blue-400 shadow-sm shadow-blue-100/30 text-rose-900"
            : "bg-blue-950/10 hover:bg-blue-950/20 border-blue-500/20 hover:border-blue-500/40 shadow-sm shadow-black text-zinc-100"
        };
      case "discovered":
      default:
        return {
          label: "Discovered",
          icon: <Check className="w-3 h-3 text-emerald-500 font-bold" />,
          badgeClass: isRomance 
            ? "bg-emerald-100/95 text-emerald-800 border-emerald-200/60" 
            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
          cardClass: isRomance
            ? "bg-emerald-50/10 hover:bg-emerald-50/30 border-emerald-200 hover:border-emerald-400 shadow-sm shadow-emerald-100/30 text-rose-900"
            : "bg-emerald-950/10 hover:bg-emerald-950/20 border-emerald-500/10 hover:border-emerald-500/30 shadow-sm shadow-black text-zinc-100"
        };
    }
  };

  // Helper icons for categories
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "character":
        return <Users className="w-4 h-4 text-emerald-400" />;
      case "location":
        return <MapPin className="w-4 h-4 text-rose-400" />;
      case "item":
        return <Compass className="w-4 h-4 text-blue-400" />;
      case "clue":
        return <KeyRound className="w-4 h-4 text-yellow-400" />;
      case "faction":
        return <Dna className="w-4 h-4 text-teal-400" />;
      case "lore":
      default:
        return <BookOpen className="w-4 h-4 text-purple-400" />;
    }
  };

  const filteredEntries = entries.filter((entry) => {
    const matchesQuery =
      entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.content.toLowerCase().includes(searchQuery.toLowerCase());

    if (activeTab === "all") return matchesQuery;
    return entry.category === activeTab && matchesQuery;
  });

  return (
    <div
      className={`w-full h-full flex flex-col rounded-[2rem] border shadow-2xl overflow-hidden ${themeConfig.bgColor} backdrop-blur-2xl`}
    >
      {/* Header and Story Context */}
      <div className="p-6 md:p-8 border-b border-current/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/5 rounded-2xl border border-current/10">
            {themeConfig.accentSvg}
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
              {themeConfig.title}
              <span className="text-xs font-normal border px-2 py-0.5 rounded-full border-current/20 opacity-70">
                {genre}
              </span>
            </h2>
            <p className="text-sm opacity-65 font-medium mt-1">
              {themeConfig.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto self-stretch md:self-auto">
          {currentNode && activeTab !== "relationships" && (
            <button
              onClick={autoScanLore}
              disabled={isScanning}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all shadow-sm ${
                isScanning
                  ? "bg-current/10 text-current opacity-60 cursor-not-allowed"
                  : genre === "romance"
                  ? "bg-rose-500 text-white hover:bg-rose-600 border-rose-400"
                  : genre === "crime"
                  ? "bg-yellow-500 text-black hover:bg-yellow-600 border-yellow-400"
                  : "bg-purple-600 text-white hover:bg-purple-700 border-purple-500"
              }`}
            >
              <Sparkles className={`w-4 h-4 ${isScanning ? "animate-spin" : ""}`} />
              {isScanning ? "Scanning Lore..." : "Extract Scene Lore"}
            </button>
          )}

          {activeTab !== "relationships" && (
            <button
              onClick={() => {
                setIsCreating(true);
                setEditingEntryId(null);
                setFormTitle("");
                setFormCategory("lore");
                setFormContent("");
              }}
              className="flex items-center justify-center p-2.5 rounded-xl border border-current/10 hover:bg-white/10 transition-colors"
              title="Log Custom Discovery Journals"
            >
              <Plus className="w-5 h-5" />
            </button>
          )}

          <button
            onClick={onClose}
            className="p-2.5 hover:bg-white/10 rounded-xl transition-colors border border-current/10 flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {scanMessage && (
        <div className="bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-400 py-2.5 px-6 text-xs text-center font-bold tracking-wide animate-slideDown flex items-center justify-center gap-1.5 matches">
          <BookmarkCheck className="w-4 h-4 animate-bounce" />
          {scanMessage}
        </div>
      )}

      {/* Primary Layout Controls */}
      <div className="p-4 md:p-6 bg-current/[0.02] border-b border-current/10 flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Tab Filters */}
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {[
            { id: "all", label: "All Records" },
            { id: "character", label: "👥 Characters" },
            { id: "location", label: "📍 Locations" },
            { id: "item", label: "✨ Artifacts/Items" },
            { id: "clue", label: "🔍 Secrets/Clues" },
            { id: "lore", label: "📜 Lore/Legends" },
            { id: "faction", label: "🛡️ Factions" },
            { id: "relationships", label: "💞 Relationship Journal" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setIsCreating(false);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === tab.id
                  ? themeConfig.tabStyle.active
                  : themeConfig.tabStyle.inactive
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search / Context Info */}
        {activeTab === "relationships" ? (
          <div className="text-[10px] font-mono opacity-50 uppercase tracking-widest text-right hidden md:block">
            Calculated From Interactive Choices
          </div>
        ) : (
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
            <input
              type="text"
              placeholder="Search discovered lore..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-current/10 rounded-xl py-2 pl-10 pr-4 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-current/30 text-current placeholder-current/40"
            />
          </div>
        )}
      </div>

      {/* Main Content Workspace */}
      <div className="flex-1 p-6 md:p-8 overflow-y-auto min-h-0">
        <AnimatePresence mode="popLayout">
          {isCreating ? (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="max-w-2xl mx-auto p-6 bg-white/5 border border-current/10 rounded-2xl"
            >
              <div className="flex justify-between items-center mb-6 border-b border-current/10 pb-4">
                <h3 className="text-lg font-bold">
                  {editingEntryId ? "Modify Codex Record" : "Log New Lore Discovery"}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="p-1.5 hover:bg-white/10 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleManualCreate} className="space-y-5">
                <div>
                  <label className="block text-xs uppercase font-bold tracking-wider opacity-60 mb-2">
                    Entry Title / Identity Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Inspector Thorne, Blue Lotus Shard, Cathedral of Whispers"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full bg-white/5 border border-current/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-current/40 text-current placeholder-current/30"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs uppercase font-bold tracking-wider opacity-60 mb-2">
                      Codex Category
                    </label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value as CodexEntry["category"])}
                      className="w-full bg-zinc-900 border border-current/10 text-current rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-current/40 appearance-none"
                    >
                      <option value="character">👥 Character Info</option>
                      <option value="location">📍 Location of Interest</option>
                      <option value="item">✨ Important Item / Artifacts</option>
                      <option value="clue">🔍 Plot Clues / Secrets</option>
                      <option value="lore">📜 Background Lore & Mythos</option>
                      <option value="faction">🛡️ Factions & Houses</option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    <span className="text-xs opacity-50 px-4 py-3 bg-white/5 rounded-xl border border-current/5 block w-full text-center">
                      Saving to persistent database
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs uppercase font-bold tracking-wider opacity-60 mb-2">
                    Description & Narrative Biography (Markdown Supported)
                  </label>
                  <textarea
                    required
                    rows={6}
                    placeholder="Provide detailed, atmospheric record cards..."
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    className="w-full bg-white/5 border border-current/10 rounded-xl p-4 text-sm focus:outline-none focus:ring-1 focus:ring-current/40 text-current placeholder-current/30 font-serif leading-relaxed"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="px-4 py-2.5 border border-current/10 hover:bg-white/10 rounded-xl text-xs font-bold uppercase tracking-wide"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 text-black hover:opacity-95 ${
                      genre === "romance"
                        ? "bg-rose-400"
                        : genre === "crime"
                        ? "bg-yellow-400"
                        : "bg-purple-400"
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    {editingEntryId ? "Save Modifications" : "Authenticate Record"}
                  </button>
                </div>
              </form>
            </motion.div>
          ) : activeTab === "relationships" ? (
            <RelationshipJournalTab
              currentUserId={currentUserId || ""}
              currentStoryId={currentStoryId}
              genre={genre}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence mode="popLayout">
                {filteredEntries.map((entry) => {
                  const statusInfo = getStatusStyling(entry.status || "discovered");
                  return (
                    <motion.div
                      key={entry.id}
                      layoutId={entry.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className={`flex flex-col p-5 rounded-2xl border transition-all hover:scale-[1.01] hover:-translate-y-1 relative group ${statusInfo.cardClass}`}
                    >
                      <div className="flex justify-between items-start gap-2 mb-3">
                        <div className="flex flex-col xl:flex-row xl:items-center gap-2">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-black/10 rounded-lg">
                              {getCategoryIcon(entry.category)}
                            </div>
                            <span className="text-[10px] uppercase font-black tracking-wider opacity-60">
                              {entry.category}
                            </span>
                          </div>
                          {/* Rich visual state badge */}
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[8px] font-bold uppercase tracking-wider w-fit ${statusInfo.badgeClass}`}>
                            {statusInfo.icon}
                            <span>{statusInfo.label}</span>
                          </span>
                        </div>

                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5">
                          <button
                            onClick={() => startEdit(entry)}
                            className="p-1 bg-current/[0.05] hover:bg-current/[0.15] text-current rounded-lg transition-colors"
                            title="Edit Entry"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(entry.id)}
                            className="p-1 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white rounded-lg transition-all"
                            title="Delete Entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <h3 className="font-sans font-black tracking-tight text-lg mb-2">
                        {entry.title}
                      </h3>

                      <div className="text-sm opacity-80 flex-1 leading-relaxed font-serif markdown-body prose prose-invert overflow-auto">
                        <Markdown>{entry.content}</Markdown>
                      </div>

                      <div className="mt-4 pt-3 border-t border-current/5 flex justify-between items-center text-[10px] opacity-50 font-medium">
                        <span className="truncate max-w-[150px]" title={entry.sourceScene}>
                          📍 {entry.sourceScene || "Undetermined"}
                        </span>
                        <span>
                          {new Date(entry.discoveredAt).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Accent corner blinking status beacon */}
                      <span className="absolute top-3.5 right-3.5 flex h-2 w-2">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                          entry.status === "updated" 
                            ? "bg-yellow-400" 
                            : entry.status === "revealed" 
                            ? "bg-blue-400" 
                            : "bg-emerald-400"
                        }`}></span>
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${
                          entry.status === "updated" 
                            ? "bg-yellow-500" 
                            : entry.status === "revealed" 
                            ? "bg-blue-500" 
                            : "bg-emerald-500"
                        }`}></span>
                      </span>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {filteredEntries.length === 0 && (
                <div className="col-span-full py-16 text-center space-y-4 font-mono opacity-50 flex flex-col items-center justify-center border border-dashed border-current/15 rounded-2xl bg-white/[0.01]">
                  <Scroll className="w-12 h-12 stroke-[1.25] text-current scale-110 mb-2 opacity-80" />
                  <p className="text-sm font-semibold tracking-wide">
                    NO DISCOVERED LOGS IN THE {activeTab.toUpperCase()} LEDGER
                  </p>
                  <p className="text-[10px] max-w-sm tracking-wider leading-relaxed">
                    Advance the narrative path or click &quot;Extract Scene Lore&quot; to awaken dynamic codex scrolls.
                  </p>
                </div>
              )}
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer statistics */}
      <div className="p-4 px-6 md:px-8 border-t border-current/10 flex justify-between items-center text-[10px] tracking-widest uppercase opacity-50 font-bold">
        <span>Discovery Count: {entries.length} items logged</span>
        <span>Destiny Chronicle Engine v1.0</span>
      </div>
    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, Suspense, lazy } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Book,
  ChevronRight,
  Skull,
  Heart,
  Loader2,
  RefreshCcw,
  Sparkles,
  Camera,
  History,
  Moon,
  Eye,
  Zap,
  LogIn,
  LogOut,
  User as UserIcon,
  Volume2,
  VolumeX,
  X,
  Settings,
  ArrowLeft,
  Lightbulb,
  Library as LibraryIcon,
  Type,
  Users,
  Sliders,
  Music,
  Wind,
  Menu,
  Link,
  ArrowRight,
  Share2,
  Download,
  Plus,
  MessageSquare,
  ChevronDown,
  Check,
  ExternalLink,
  Lock,
  Bookmark,
  Trash,
  GitBranch,
} from "lucide-react";
import {
  auth,
  db,
  googleProvider,
  OperationType,
  handleFirestoreError,
} from "./lib/firebase";
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";

const AtmosphericEffects = lazy(() =>
  import("./components/AtmosphericEffects").then((m) => ({
    default: m.AtmosphericEffects,
  })),
);
const SoundtrackManager = lazy(() =>
  import("./components/SoundtrackManager").then((m) => ({
    default: m.SoundtrackManager,
  })),
);
const EffectsOverlay = lazy(() =>
  import("./components/EffectsOverlay").then((m) => ({
    default: m.EffectsOverlay,
  })),
);
import { EnhancedImageContainer } from "./components/EnhancedImageContainer";
const IntroductionParticles = lazy(() =>
  import("./components/IntroductionParticles").then((m) => ({
    default: m.IntroductionParticles,
  })),
);
import { ImageFallbackContainer } from "./components/ImageFallbackContainer";
import OnboardingTutorial from "./components/OnboardingTutorial";
import { RelationshipMeter } from "./components/RelationshipMeter";
import { BranchingTimeline } from "./components/BranchingTimeline";
import { GoogleKeepWorkspace } from "./components/GoogleKeepWorkspace";
import { CodexLoreGlossary } from "./components/CodexLoreGlossary";
import { VoiceNarratorPanel } from "./components/VoiceNarratorPanel";
import { AtmosphericFateLoader } from "./components/AtmosphericFateLoader";
import { BookOpen } from "lucide-react";
import {
  doc,
  collection,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  limit,
} from "firebase/firestore";
import { 
  setDocSafe as setDoc, 
  addDocSafe as addDoc,
  getDocSafe as getDoc,
  getDocsSafe as getDocs
} from "./lib/firebase";

interface Choice {
  text: string;
  nextContext: string;
}

interface StoryNode {
  sceneTitle: string;
  sceneDescription: string;
  imagePrompt: string;
  mediaType: "image" | "video";
  choices: Choice[];
  mood: string;
  intensity: number;
  imageUrl?: string;
  videoUrl?: string;
  isEnding?: boolean;
  endingType?: string;
  imageGenFailed?: boolean;
  echoes?: {
    shortTermEcho: string;
    mediumTermEcho: string;
    longTermEcho: string;
    fateComplexityScore: number;
  };
}

type Genre = "romance" | "crime" | "paranormal" | null;
type StoryLength = "short" | "medium" | "epic";
type PlotComplexity = "simple" | "complex" | "layered";
type StoryTone = "subtle" | "intense" | "experimental";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8 text-center space-y-4">
          <Moon className="w-16 h-16 opacity-50" />
          <h2 className="text-2xl font-bold font-serif opacity-80">
            The Tapestry Frayed
          </h2>
          <p className="text-sm opacity-50 max-w-md font-mono">
            {this.state.error?.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 mt-4 bg-white/10 hover:bg-white/20 rounded-xl uppercase tracking-widest text-xs font-black transition-colors"
          >
            Reweave Fate
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function AppWrapper() {
  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div className="fixed inset-0 bg-black flex items-center justify-center text-white">
            <Loader2 className="w-8 h-8 animate-spin opacity-50" />
          </div>
        }
      >
        <App />
      </Suspense>
    </ErrorBoundary>
  );
}

const PREMADE_PREMISES: Record<
  string,
  { title: string; archetype: string; backstory: string; customBasis: string }[]
> = {
  romance: [
    {
      title: "The Royal Secret",
      archetype: "Undercover Noble",
      backstory:
        "You hid your lineage to escape an arranged marriage, finding solace among commoners.",
      customBasis:
        "A masquerade ball where an unexpected dance reignites a forbidden flame.",
    },
    {
      title: "Rivals to Lovers",
      archetype: "Ambitious Protege",
      backstory:
        "You've worked your whole life to be the top scholar, only to be rivaled by the one person you despise.",
      customBasis:
        "A mandatory partnered assignment forces you into close quarters late at night.",
    },
  ],
  crime: [
    {
      title: "Neon Shadows",
      archetype: "Disgraced Detective",
      backstory: "A botched case cost you your badge and your partner's life.",
      customBasis:
        "A mysterious caller claims to have evidence from your old case, setting up a meeting in a deserted alley.",
    },
    {
      title: "The Heist",
      archetype: "Master Thief",
      backstory:
        "You pulled off the biggest job in history, but someone betrayed you. Now you want revenge.",
      customBasis:
        "You assemble a new crew for one last impossible job: breaking into the betrayer's fortress.",
    },
  ],
  paranormal: [
    {
      title: "Blood Covenant",
      archetype: "Reluctant Vampire",
      backstory:
        "Turned against your will centuries ago, you refuse to feed on humans.",
      customBasis:
        "A young human arrives at your door, carrying the scent of your long-lost mortal love.",
    },
    {
      title: "Witch's Gambit",
      archetype: "Exiled Witch",
      backstory:
        "Banished from the coven for practicing forbidden magic to save a loved one.",
      customBasis:
        "A demonic entity threatens the town, and the coven must beg for your help.",
    },
  ],
};

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [genre, setGenre] = useState<Genre>(null);
  const [storyParameters, setStoryParameters] = useState<{
    length: StoryLength;
    archetype: string;
    backstory: string;
    complexity: PlotComplexity;
    tone: StoryTone;
    isAdultContent: boolean;
    customBasis: string;
  }>({
    length: "medium",
    archetype: "",
    backstory: "",
    complexity: "complex",
    tone: "intense",
    isAdultContent: false,
    customBasis: "",
  });
  const [customActionText, setCustomActionText] = useState("");
  const [showParameterSetup, setShowParameterSetup] = useState(false);
  const [premiseMode, setPremiseMode] = useState<"custom" | "premade" | "ai">(
    "custom",
  );
  const [aiPremises, setAiPremises] = useState<any[]>([]);
  const [generatingPremises, setGeneratingPremises] = useState(false);
  const [currentNode, setCurrentNode] = useState<StoryNode | null>(null);
  const [isSceneFadingOut, setIsSceneFadingOut] = useState(false);
  const [history, setHistory] = useState<
    { sceneDescription: string; choiceTaken: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [videoStatus, setVideoStatus] = useState<{
    status: "idle" | "generating" | "downloading" | "failed";
    progress?: string;
  }>({ status: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [currentStoryId, setCurrentStoryId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showKeepNotes, setShowKeepNotes] = useState(false);
  const [showCodex, setShowCodex] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [userStories, setUserStories] = useState<any[]>([]);
  const [syncStatus, setSyncStatus] = useState<{ status: "online" | "offline_active" | "online_synced"; message: string }>({ status: "online", message: "" });
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  useEffect(() => {
    const handleSyncStatus = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setSyncStatus(detail);
      if (detail.status === "online_synced") {
        setTimeout(() => {
          setSyncStatus(prev => prev.status === "online_synced" ? { status: "online", message: "" } : prev);
        }, 4000);
      }
    };
    window.addEventListener("firestore_sync_status", handleSyncStatus);
    return () => window.removeEventListener("firestore_sync_status", handleSyncStatus);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const hasSeenTutorial = localStorage.getItem("hasSeenTutorial");
      if (!hasSeenTutorial) {
        setShowTutorial(true);
      }
    }
  }, []);

  // Real-time Collab variables
  const [roomCode, setRoomCode] = useState("");
  const [activeRoom, setActiveRoom] = useState<any | null>(null);
  const [chatMessage, setChatMessage] = useState("");
  const [joiningRoomCode, setJoiningRoomCode] = useState("");
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);

  const [sharedEchoSnapshot, setSharedEchoSnapshot] = useState<any | null>(null);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [bookmarks, setBookmarks] = useState<any[]>([]);

  // Load Individual Bookmarks
  useEffect(() => {
    if (currentStoryId) {
      const storedBookmarks = localStorage.getItem(`echoes_bookmarks_${currentStoryId}`);
      if (storedBookmarks) {
        try {
          setBookmarks(JSON.parse(storedBookmarks));
        } catch (e) {
          console.error("Failed to parse saved bookmarks", e);
          setBookmarks([]);
        }
      } else {
        setBookmarks([]);
      }
    } else {
      setBookmarks([]);
    }
  }, [currentStoryId]);

  const saveBookmarksToStorage = (updatedList: any[]) => {
    if (currentStoryId) {
      localStorage.setItem(`echoes_bookmarks_${currentStoryId}`, JSON.stringify(updatedList));
      setBookmarks(updatedList);
    }
  };

  // Toggle current active step bookmark
  const handleToggleCurrentBookmark = () => {
    if (!currentNode || !currentStoryId || allSteps.length === 0) return;
    
    const activeIndex = allSteps.length - 1;
    const isAlreadyBookmarked = bookmarks.some((b: any) => b.stepIndex === activeIndex);

    if (isAlreadyBookmarked) {
      const updated = bookmarks.filter((b: any) => b.stepIndex !== activeIndex);
      saveBookmarksToStorage(updated);
    } else {
      const targetStep = allSteps[activeIndex];
      const newBookmark = {
        id: `bookmark_${Date.now()}`,
        stepIndex: activeIndex,
        sceneTitle: targetStep.sceneTitle,
        playerNote: `Scene ${activeIndex + 1} - ${targetStep.sceneTitle}`,
        timestamp: Date.now(),
        stepsSnapshot: JSON.parse(JSON.stringify(allSteps)),
        relationshipsSnapshot: JSON.parse(JSON.stringify(relationships)),
        consequencesSnapshot: JSON.parse(JSON.stringify(consequences)),
        storyMilestonesSnapshot: JSON.parse(JSON.stringify(storyMilestones)),
      };
      const updated = [newBookmark, ...bookmarks];
      saveBookmarksToStorage(updated);
    }
  };

  const handleClearAllBookmarks = () => {
    if (window.confirm("Are you sure you want to clear all bookmarks in this story?")) {
      saveBookmarksToStorage([]);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const echoId = params.get("sharedEcho");
      if (echoId) {
        const loadSharedSnapshot = async () => {
          try {
            const docRef = doc(db, "shared_echoes", echoId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              setSharedEchoSnapshot(docSnap.data());
            }
          } catch (e) {
            console.error("Failed loading shared snapshot: ", e);
          }
        };
        loadSharedSnapshot();
      }
    }
  }, []);

  useEffect(() => {
    if (!activeRoom || !activeRoom.roomId) return;
    const roomRef = doc(db, "rooms", activeRoom.roomId);
    const unsubscribe = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setActiveRoom({ roomId: snapshot.id, ...data });
        
        if (data.activeStoryId && data.activeStoryId !== currentStoryId) {
          loadSharedStoryState(data.activeStoryId);
        }
      }
    });
    return () => unsubscribe();
  }, [activeRoom?.roomId, currentStoryId]);
  const [hoveredStoryId, setHoveredStoryId] = useState<string | null>(null);
  const [hoveredGenre, setHoveredGenre] = useState<"romance" | "crime" | "paranormal" | null>(null);
  const [allSteps, setAllSteps] = useState<any[]>([]);

  // Dual Modes & Creative Suite States
  const [appMode, setAppMode] = useState<"player" | "creator">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("appMode") as "player" | "creator") || "player";
    }
    return "player";
  });
  const [customTwist, setCustomTwist] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isDirty, setIsDirty] = useState(false);
  const lastStateRef = useRef<string>("");

  // Temporal "What If" alternate branch states
  const [isWhatIfMode, setIsWhatIfMode] = useState(false);
  const [backupTimelineState, setBackupTimelineState] = useState<{
    currentNode: any;
    history: any[];
    relationships: any;
    storyMilestones: any;
    consequences: any;
    allSteps: any[];
  } | null>(null);

  // Dynamic Ripple Feed database timeline stores
  const [echoTimeline, setEchoTimeline] = useState<Array<{
    id: string;
    sceneTitle: string;
    choiceTaken: string;
    shortTerm: string;
    mediumTerm: string;
    longTerm: string;
    complexityScore: number;
    timestamp: string;
  }>>([]);
  const [creatorTab, setCreatorTab] = useState<"outline" | "grimoire" | "parameters" | "ripples" | "collab" | "export">("outline");
  const [showCreatorPanel, setShowCreatorPanel] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [sharedLink, setSharedLink] = useState<string | null>(null);

  const [choicePreviews, setChoicePreviews] = useState<Record<number, boolean>>({});
  const [microActionText, setMicroActionText] = useState<string | null>(null);
  const [activeMicroAction, setActiveMicroAction] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState("");
  const [selectionCoords, setSelectionCoords] = useState<{ x: number; y: number } | null>(null);
  const [extractingLore, setExtractingLore] = useState(false);
  const [relationships, setRelationships] = useState<
    Record<string, { affinity: number; suspicion: number }>
  >({});
  const [npcUpdateNotifs, setNpcUpdateNotifs] = useState<any[]>([]);
  const [storyMilestones, setStoryMilestones] = useState<string[]>([]);
  const [consequences, setConsequences] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState({
    fontSize: "md", // sm, md, lg, xl
    lineSpacing: "relaxed", // tight, normal, relaxed
    textAlign: "left", // left, center, justify
    fontWeight: "normal", // light, normal, bold
    fontFamily: "default", // default, sans, serif, mono
    letterSpacing: "normal", // normal, wide, widest
    typewriter: true,
    showImages: true,
    textGlow: false,
    reducedMotion: false,
    readerMode: false,
    volume: 50,
    volumeMusic: 50,
    volumeSFX: 70,
    volumeAmbient: 60,
    isMuted: false,
    simulationMode: "standard" as "light" | "standard" | "deep",
    fateTokens: 3840,
  });

  // Helper to serialize our core narrative state for precise dirty tracking
  const serializeState = () => {
    return JSON.stringify({
      sceneTitle: currentNode?.sceneTitle || "",
      milestones: storyMilestones || [],
      consequences: consequences || {},
      relationships: relationships || {},
      parameters: {
        length: storyParameters.length || "medium",
        archetype: storyParameters.archetype || "",
        backstory: storyParameters.backstory || "",
        complexity: storyParameters.complexity || "complex",
        tone: storyParameters.tone || "intense",
        isAdultContent: !!storyParameters.isAdultContent,
        customBasis: storyParameters.customBasis || "",
      },
      customTwist: customTwist || "",
    });
  };

  // Reset lastStateRef when active story changes
  useEffect(() => {
    lastStateRef.current = "";
    setIsDirty(false);
    setSaveStatus("idle");
  }, [currentStoryId]);

  // Synchronise dirty states based on value hashing
  useEffect(() => {
    if (!user || !currentStoryId || !currentNode || loading) {
      return;
    }

    const currentStr = serializeState();
    if (lastStateRef.current === "") {
      // Initialize on load
      lastStateRef.current = currentStr;
      setIsDirty(false);
      return;
    }

    if (currentStr !== lastStateRef.current) {
      setIsDirty(true);
    } else {
      setIsDirty(false);
    }
  }, [currentNode, storyMilestones, consequences, relationships, storyParameters, customTwist, currentStoryId, loading, user]);

  // Debounced Auto-Saver + 60s backup interval
  useEffect(() => {
    if (!isDirty || !user || !currentStoryId || !currentNode || loading) {
      return;
    }

    let debounceTimer: NodeJS.Timeout | null = null;
    let intervalTimer: NodeJS.Timeout | null = null;

    const performSave = async () => {
      setSaveStatus("saving");
      try {
        await setDoc(
          doc(db, "users", user.uid, "stories", currentStoryId),
          {
            updatedAt: serverTimestamp(),
            relationships: relationships || {},
            storyMilestones: storyMilestones || [],
            consequences: consequences || {},
            storyParameters: {
              length: storyParameters.length || "medium",
              archetype: storyParameters.archetype || "",
              backstory: storyParameters.backstory || "",
              complexity: storyParameters.complexity || "complex",
              tone: storyParameters.tone || "intense",
              isAdultContent: !!storyParameters.isAdultContent,
              customBasis: storyParameters.customBasis || "",
            },
            customTwist: customTwist || "",
            currentNodePosition: {
              sceneTitle: currentNode.sceneTitle || "",
              sceneDescription: currentNode.sceneDescription || "",
              choices: currentNode.choices || [],
              imagePrompt: currentNode.imagePrompt || "",
              mediaType: currentNode.mediaType || "image",
              mood: currentNode.mood || "mystery",
              intensity: currentNode.intensity || 3,
              imageUrl: currentNode.imageUrl || null,
              videoUrl: currentNode.videoUrl || null,
              isEnding: !!currentNode.isEnding,
              endingType: currentNode.endingType || null,
            },
          },
          { merge: true }
        ).catch((err) =>
          handleFirestoreError(
            err,
            OperationType.UPDATE,
            `users/${user.uid}/stories/${currentStoryId}`
          )
        );

        lastStateRef.current = serializeState();
        setIsDirty(false);
        setSaveStatus("saved");
        setTimeout(() => {
          setSaveStatus("idle");
        }, 3000);
      } catch (err: any) {
        console.error("Auto-save operation exception: ", err);
        setSaveStatus("error");
      }
    };

    // Debounce save by 3.5 seconds of user quiescence
    debounceTimer = setTimeout(() => {
      performSave();
    }, 3500);

    // Save interval of 60 seconds forced fallback
    intervalTimer = setInterval(() => {
      performSave();
    }, 60000);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (intervalTimer) clearInterval(intervalTimer);
    };
  }, [isDirty, user, currentStoryId, currentNode, loading, relationships, consequences, storyMilestones, storyParameters, customTwist]);

  // Temporal Reality Fork (What If Mode) Operations
  const toggleWhatIfMode = () => {
    if (!isWhatIfMode) {
      setBackupTimelineState({
        currentNode,
        history,
        relationships,
        storyMilestones,
        consequences,
        allSteps
      });
      setIsWhatIfMode(true);
      
      // Inject timeline notification
      setNpcUpdateNotifs((prev) => [
        ...prev,
        {
          id: Date.now() + Math.random(),
          name: "Temporal Pivot",
          affinityChange: -1,
          relationshipType: "suspicion",
          reason: "Alternate temporal branch spawned. Real-time changes are non-persistent."
        }
      ]);
    } else {
      snapBackTimeline();
    }
  };

  const commitWhatIfTimeline = async () => {
    setBackupTimelineState(null);
    setIsWhatIfMode(false);
    
    // Inject fusion notification
    setNpcUpdateNotifs((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        name: "Timeline Fusion",
        affinityChange: 100,
        relationshipType: "affinity",
        reason: "Alternate timeline permanently prioritized and woven into main branch."
      }
    ]);
  };

  const snapBackTimeline = () => {
    if (backupTimelineState) {
      setCurrentNode(backupTimelineState.currentNode);
      setHistory(backupTimelineState.history);
      setRelationships(backupTimelineState.relationships);
      setStoryMilestones(backupTimelineState.storyMilestones);
      setConsequences(backupTimelineState.consequences);
      setAllSteps(backupTimelineState.allSteps);
    }
    setBackupTimelineState(null);
    setIsWhatIfMode(false);
    
    // Inject snap back notification
    setNpcUpdateNotifs((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        name: "Snap Back",
        affinityChange: -100,
        relationshipType: "suspicion",
        reason: "Snapped back successfully to primordial parent coordinate timeline."
      }
    ]);
  };

  // Scroll to top on node change
  const contentRef = useRef<HTMLDivElement>(null);

  // Typewriter effect hook
  function useTypewriter(
    text: string,
    speed: number = 20,
    enabled: boolean = true,
  ) {
    const [displayedText, setDisplayedText] = useState("");
    const [isComplete, setIsComplete] = useState(false);

    useEffect(() => {
      if (!enabled) {
        setDisplayedText(text);
        setIsComplete(true);
        return;
      }

      setDisplayedText("");
      setIsComplete(false);
      let index = 0;
      const interval = setInterval(() => {
        if (index < text.length) {
          index++;
          setDisplayedText(text.slice(0, index));
        } else {
          setIsComplete(true);
          clearInterval(interval);
        }
      }, speed);

      return () => clearInterval(interval);
    }, [text, speed, enabled]);

    return { displayedText, isComplete };
  }

  const { displayedText: typewriterText, isComplete: typewriterComplete } =
    useTypewriter(currentNode?.sceneDescription || "", 15, settings.typewriter);

  const bgOpacity = genre === "romance" ? 0.3 : 0.6;

  // Audio effect disabled to debug white screen
  useEffect(() => {
    // audioManager.setMood(currentMood);
  }, [genre, currentNode]);

  // Handle jump/winding narrative to a specific historic scene
  const handleJumpToScene = (title: string) => {
    if (!title) return;
    const index = allSteps.findIndex(s => s.sceneTitle?.toLowerCase().trim() === title.toLowerCase().trim());
    if (index !== -1) {
      branchToStep(index);
      setShowKeepNotes(false);
    } else {
      // substring search as fallback
      const subIndex = allSteps.findIndex(s => s.sceneTitle?.toLowerCase().includes(title.toLowerCase()) || title.toLowerCase().includes(s.sceneTitle?.toLowerCase() || ""));
      if (subIndex !== -1) {
        branchToStep(subIndex);
        setShowKeepNotes(false);
      }
    }
  };

  // Text selection listener for lore extraction
  useEffect(() => {
    const handleSelectionChange = () => {
      if (typeof window === "undefined") return;
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        setSelectedText("");
        setSelectionCoords(null);
        return;
      }

      const text = selection.toString().trim();
      const container = document.getElementById("story-content");
      if (text && text.length > 2 && container && container.contains(selection.anchorNode)) {
        setSelectedText(text);
        try {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          setSelectionCoords({
            x: rect.left + window.scrollX,
            y: rect.top + window.scrollY - 48,
          });
        } catch (e) {
          // ignore coords issue
        }
      }
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [allSteps]);

  const handleQuickExtractCodex = async (category: "character" | "location" | "item" | "clue" | "lore") => {
    if (!selectedText || !user || !currentStoryId) return;
    setExtractingLore(true);
    try {
      const entryId = `codex_${Date.now()}_highlight`;
      const codexDocRef = doc(db, "users", user.uid, "stories", currentStoryId, "codex", entryId);
      
      let shortTitle = selectedText;
      if (shortTitle.length > 30) {
        shortTitle = shortTitle.substring(0, 27) + "...";
      }

      await setDoc(codexDocRef, {
        title: shortTitle,
        category: category,
        content: selectedText,
        status: "discovered",
        sourceScene: currentNode?.sceneTitle || "Scene Highlight",
        discoveredAt: new Date().toISOString()
      });

      alert(`Successfully inscribed selected text into Codex under "${category.toUpperCase()}"!`);
      
      window.getSelection()?.removeAllRanges();
      setSelectedText("");
      setSelectionCoords(null);
    } catch (e) {
      console.error(e);
    } finally {
      setExtractingLore(false);
    }
  };

  const handleQuickExtractKeep = async () => {
    if (!selectedText || !user || !currentStoryId) return;
    setExtractingLore(true);
    try {
      const notesCol = collection(db, "users", user.uid, "stories", currentStoryId, "notes");
      
      let shortTitle = selectedText;
      if (shortTitle.length > 30) {
        shortTitle = shortTitle.substring(0, 27) + "...";
      }

      await addDoc(notesCol, {
        title: `Selection: ${shortTitle}`,
        type: "text",
        content: selectedText,
        color: "bg-white/5 border-white/10 text-white",
        pinned: false,
        labels: ["Reference"],
        linkedSceneId: currentNode ? currentNode.sceneTitle : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      alert("Successfully added selection as reference note on Keep Board!");
      
      window.getSelection()?.removeAllRanges();
      setSelectedText("");
      setSelectionCoords(null);
    } catch (e) {
      console.error(e);
    } finally {
      setExtractingLore(false);
    }
  };

  const toggleMute = () => {
    setSettings((s) => ({ ...s, isMuted: !s.isMuted }));
  };

  const fetchUserStories = async (uid: string) => {
    try {
      const storiesRef = collection(db, "users", uid, "stories");
      const q = query(storiesRef, orderBy("updatedAt", "desc"));
      const snapshot = await getDocs(q);
      setUserStories(
        snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      );
    } catch (err) {
      console.error("Fetch failure", err);
    }
  };

  const resumeActiveStory = async (uid: string) => {
    const storiesRef = collection(db, "users", uid, "stories");
    // Simplified query to avoid index requirement during debug
    const q = query(storiesRef, limit(10));
    try {
      const snapshot = await getDocs(q);
      const storyDoc = snapshot.docs.find((d) => d.data().status === "active");

      if (storyDoc) {
        const storyData = storyDoc.data();
        setCurrentStoryId(storyDoc.id);
        setGenre(storyData.genre as Genre);
        setStoryParameters({
          length: (storyData.storyLength as StoryLength) || "medium",
          archetype: storyData.characterArchetype || "",
          backstory: storyData.backstory || "",
          complexity: (storyData.plotComplexity as PlotComplexity) || "complex",
          tone: (storyData.tone as StoryTone) || "intense",
          isAdultContent: storyData.isAdultContent || false,
          customBasis: storyData.customBasis || "",
        });

        // Fetch steps
        const stepsRef = collection(
          db,
          "users",
          uid,
          "stories",
          storyDoc.id,
          "steps",
        );
        const stepsSnapshot = await getDocs(stepsRef);
        const stepsData = stepsSnapshot.docs.map((d) => ({
          ...d.data(),
          id: d.id,
        })) as any[];
        // Sort in memory instead of Firestore to avoid index requirement
        const steps = stepsData
          .sort(
            (a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0),
          )
          .map((d) => ({
            id: d.id,
            sceneTitle: d.sceneTitle,
            sceneDescription: d.sceneDescription,
            imageUrl: d.imageUrl,
            videoUrl: d.videoUrl,
            choiceTaken: d.choiceTaken,
            choices: d.choices,
            imagePrompt: d.imagePrompt,
            mediaType: d.mediaType,
            mood: d.mood || "mystery",
            intensity: d.intensity || 3,
          }));

        setAllSteps(steps);
        setHistory(
          steps
            .filter((s) => s.choiceTaken)
            .map((s) => ({
              sceneDescription: s.sceneDescription,
              choiceTaken: s.choiceTaken,
            })),
        );

        if (steps.length > 0) {
          const lastStep = steps[steps.length - 1];
          setCurrentNode({
            sceneTitle: lastStep.sceneTitle,
            sceneDescription: lastStep.sceneDescription,
            choices: lastStep.choices || [],
            imagePrompt: lastStep.imagePrompt || "",
            mediaType: (lastStep.mediaType as any) || "image",
            mood: lastStep.mood,
            intensity: lastStep.intensity || 3,
            imageUrl: lastStep.imageUrl,
            videoUrl: lastStep.videoUrl,
          });
        }
      }
    } catch (err) {
      console.error("Resuming failed", err);
    }
  };

  // Auth Listener
  useEffect(() => {
    console.log("Auth listener mounting");
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      console.log("Auth state changed:", u ? "user logged in" : "no user");
      setUser(u);
      setAuthLoading(false);
      if (u) {
        // Sync user profile safely
        const userRef = doc(db, "users", u.uid);
        getDoc(userRef).then((docSnap) => {
          if (!docSnap.exists()) {
            setDoc(userRef, {
              uid: u.uid,
              email: u.email,
              displayName: u.displayName,
              photoURL: u.photoURL,
              createdAt: serverTimestamp(),
            }).catch((err) => {
              console.error("Profile sync error:", err);
              handleFirestoreError(err, OperationType.CREATE, `users/${u.uid}`);
            });
          } else {
            // Standard update without touching createdAt
            setDoc(
              userRef,
              {
                displayName: u.displayName,
                photoURL: u.photoURL,
              },
              { merge: true },
            ).catch((err) => {
              console.error("Profile update error:", err);
              handleFirestoreError(err, OperationType.UPDATE, `users/${u.uid}`);
            });
          }
        });

        // Try to resume active story
        resumeActiveStory(u.uid);
        fetchUserStories(u.uid);
      } else {
        resetGame();
      }
    });
    return () => unsubscribe();
  }, []);

  const loadStory = async (storyId: string) => {
    if (!user) return;
    setLoading(true);
    setGenre(null);
    setCurrentNode(null);
    setHistory([]);
    setAllSteps([]);
    setShowLibrary(false);

    try {
      const storyDoc = await getDoc(
        doc(db, "users", user.uid, "stories", storyId),
      );
      if (storyDoc.exists()) {
        const storyData = storyDoc.data();

        // Check for alternate-reality restoration trigger from the Tapestry panel
        const restoreTriggerStr = localStorage.getItem(`echoes_restore_trigger_${storyId}`);
        if (restoreTriggerStr) {
          try {
            const restoredReality = JSON.parse(restoreTriggerStr);
            localStorage.removeItem(`echoes_restore_trigger_${storyId}`);
            console.log("Restoring alternate timeline reality stream:", restoredReality.name);

            // 1. Synchronize story markers to root Story doc
            await setDoc(
              doc(db, "users", user.uid, "stories", storyId),
              {
                consequences: restoredReality.consequences || {},
                storyMilestones: restoredReality.storyMilestones || [],
                relationships: restoredReality.relationships || {},
                updatedAt: serverTimestamp(),
              },
              { merge: true },
            );

            // 2. Purge existing path steps
            const stepsRef = collection(db, "users", user.uid, "stories", storyId, "steps");
            const stepsSnap = await getDocs(stepsRef);
            for (const docSnap of stepsSnap.docs) {
              await deleteDoc(docSnap.ref);
            }

            // 3. Append the alternate timeline nodes
            for (let i = 0; i < restoredReality.steps.length; i++) {
              const step = restoredReality.steps[i];
              const cleanUrl = await ensureCompactImageUrl(
                step.imageUrl,
                step.imagePrompt || step.sceneTitle || "",
                step.mood || "mystery"
              );
              await addDoc(stepsRef, {
                sceneTitle: step.sceneTitle,
                sceneDescription: step.sceneDescription,
                imageUrl: cleanUrl || null,
                videoUrl: step.videoUrl || null,
                choiceTaken: step.choiceTaken || null,
                choices: step.choices || [],
                imagePrompt: step.imagePrompt || "",
                mediaType: step.mediaType || "image",
                mood: step.mood || "mystery",
                intensity: step.intensity || 3,
                milestonesAchieved: step.milestonesAchieved || [],
                newConsequences: step.newConsequences || {},
                timestamp: serverTimestamp()
              });
              await new Promise((resolve) => setTimeout(resolve, 30));
            }

            // Set variables for instant UI alignment
            storyData.consequences = restoredReality.consequences || {};
            storyData.storyMilestones = restoredReality.storyMilestones || [];
            storyData.relationships = restoredReality.relationships || {};
          } catch (restoreErr) {
            console.error("Alternate timeline restore failure", restoreErr);
          }
        }

        setCurrentStoryId(storyId);
        setGenre(storyData.genre as Genre);
        setStoryParameters({
          length: (storyData.storyLength as StoryLength) || "medium",
          archetype: storyData.characterArchetype || "",
          backstory: storyData.backstory || "",
          complexity: (storyData.plotComplexity as PlotComplexity) || "complex",
          tone: (storyData.tone as StoryTone) || "intense",
          isAdultContent: storyData.isAdultContent || false,
          customBasis: storyData.customBasis || "",
        });
        setConsequences(storyData.consequences || {});
        setStoryMilestones(storyData.storyMilestones || []);
        setRelationships(storyData.relationships || {});

        const stepsRef = collection(
          db,
          "users",
          user.uid,
          "stories",
          storyId,
          "steps",
        );
        const stepsSnapshot = await getDocs(stepsRef);
        const stepsData = stepsSnapshot.docs.map((d) => ({
          ...d.data(),
          id: d.id,
        })) as any[];
        // @ts-ignore
        const steps = stepsData
          .sort(
            (a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0),
          )
          .map((d) => ({
            id: d.id,
            sceneTitle: d.sceneTitle,
            sceneDescription: d.sceneDescription,
            imageUrl: d.imageUrl,
            videoUrl: d.videoUrl,
            choiceTaken: d.choiceTaken,
            choices: d.choices,
            imagePrompt: d.imagePrompt,
            mediaType: d.mediaType,
            mood: d.mood || "mystery",
            intensity: d.intensity || 3,
          }));

        setAllSteps(steps);
        setHistory(
          steps
            .filter((s) => s.choiceTaken)
            .map((s) => ({
              sceneDescription: s.sceneDescription,
              choiceTaken: s.choiceTaken,
            })),
        );

        if (steps.length > 0) {
          const lastStep = steps[steps.length - 1];
          setCurrentNode({
            sceneTitle: lastStep.sceneTitle,
            sceneDescription: lastStep.sceneDescription,
            choices: lastStep.choices || [],
            imagePrompt: lastStep.imagePrompt || "",
            mediaType: (lastStep.mediaType as any) || "image",
            mood: lastStep.mood,
            intensity: lastStep.intensity || 3,
            imageUrl: lastStep.imageUrl,
            videoUrl: lastStep.videoUrl,
          });
        }
      }
    } catch (err) {
      console.error("Loading story failed", err);
      setError("Failed to load story.");
    } finally {
      setLoading(false);
    }
  };

  const goBack = async () => {
    if (!user || !currentStoryId || allSteps.length <= 1) return;

    setLoading(true);
    try {
      // Find the last step that was a choice
      const lastChoiceStepIndex = allSteps.length - 1;
      const previousStep = allSteps[allSteps.length - 2];

      // Update local state
      const newSteps = allSteps.slice(0, -1);
      setAllSteps(newSteps);
      setHistory(
        newSteps
          .filter((s) => s.choiceTaken)
          .map((s) => ({
            sceneDescription: s.sceneDescription,
            choiceTaken: s.choiceTaken,
          })),
      );

      setCurrentNode({
        sceneTitle: previousStep.sceneTitle,
        sceneDescription: previousStep.sceneDescription,
        choices: previousStep.choices || [],
        imagePrompt: previousStep.imagePrompt || "",
        mediaType: (previousStep.mediaType as any) || "image",
        mood: previousStep.mood,
        intensity: previousStep.intensity || 3,
        imageUrl: previousStep.imageUrl,
        videoUrl: previousStep.videoUrl,
      });

      // You might want to delete the step from Firestore as well,
      // but usually for "Undo" we just move the pointer or allow it to be overwritten.
      // For simplicity here, we leave the step in DB but it won't be in the resumed history local state.
    } catch (err) {
      console.error("Go back failed", err);
    } finally {
      setLoading(false);
    }
  };

  const branchToStep = async (stepIndex: number) => {
    if (!user || !currentStoryId || allSteps.length <= stepIndex) return;

    setLoading(true);
    try {
      const newSteps = allSteps.slice(0, stepIndex + 1);
      
      // Update local memory state
      setAllSteps(newSteps);
      setHistory(
        newSteps
          .filter((s) => s.choiceTaken)
          .map((s) => ({
            sceneDescription: s.sceneDescription,
            choiceTaken: s.choiceTaken,
          })),
      );

      const targetStep = newSteps[newSteps.length - 1];
      setCurrentNode({
        sceneTitle: targetStep.sceneTitle,
        sceneDescription: targetStep.sceneDescription,
        choices: targetStep.choices || [],
        imagePrompt: targetStep.imagePrompt || "",
        mediaType: (targetStep.mediaType as any) || "image",
        mood: targetStep.mood,
        intensity: targetStep.intensity || 3,
        imageUrl: targetStep.imageUrl,
        videoUrl: targetStep.videoUrl,
      });

      // Prune subsequent steps in Firestore to maintain clean timeline states
      const stepsRef = collection(
        db,
        "users",
        user.uid,
        "stories",
        currentStoryId,
        "steps",
      );
      const stepsSnapshot = await getDocs(stepsRef);
      const stepsWithDocs = stepsSnapshot.docs.map((d) => ({
        docId: d.id,
        ref: d.ref,
        timestamp: d.data().timestamp?.seconds || 0,
      }));

      // Sort chronological
      stepsWithDocs.sort((a, b) => a.timestamp - b.timestamp);

      // Prune elements starting from stepIndex + 1
      for (let i = stepIndex + 1; i < stepsWithDocs.length; i++) {
        await deleteDoc(stepsWithDocs[i].ref);
      }
      
      console.log(`Pruned ${stepsWithDocs.length - (stepIndex + 1)} steps from Firestore.`);
    } catch (err) {
      console.error("Timeline fork backtracking failed", err);
    } finally {
      setLoading(false);
    }
  };

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error("Login Error:", err);
      setError(`Login failed: ${err.message}`);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  const startStory = async (selectedGenre: Genre) => {
    setGenre(selectedGenre);
    setShowParameterSetup(true);
    setPremiseMode("custom");
  };

  const generateAIPremises = async (ignoreCache: boolean = false) => {
    if (!genre) return;
    setGeneratingPremises(true);
    setAiPremises([]);
    try {
      const response = await fetch("/api/story/premise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ genre, ignoreCache }),
      });
      if (!response.ok) throw new Error("Failed to generate premises");
      const data = await response.json();
      setAiPremises(data);
    } catch (err) {
      console.error(err);
      setError("Failed to generate AI premises");
    } finally {
      setGeneratingPremises(false);
    }
  };

  const applyPremise = (premise: {
    archetype: string;
    backstory: string;
    customBasis: string;
  }) => {
    setStoryParameters((p) => ({
      ...p,
      archetype: premise.archetype,
      backstory: premise.backstory,
      customBasis: premise.customBasis,
    }));
  };

  const confirmStartStory = async () => {
    if (!user || !genre) return;

    // Validation
    if (!storyParameters.archetype.trim()) {
      setError(
        "Please define your character's archetype (e.g. Broken Detective, Fated Witch).",
      );
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let g = "Romance";
      if (genre === "crime") g = "True Crime Noir";
      if (genre === "paranormal") g = "Paranormal Occult Indie";

      const response = await fetch("/api/story/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          genre: g,
          storyLength: storyParameters.length,
          characterArchetype: storyParameters.archetype,
          backstory: storyParameters.backstory,
          plotComplexity: storyParameters.complexity,
          tone: storyParameters.tone,
          isAdultContent: storyParameters.isAdultContent,
          customBasis: storyParameters.customBasis,
        }),
      });
      if (!response.ok) throw new Error("Failed to start story");
      const data = await response.json();

      // Clear/Initialize echo timeline with initial cinematic ripples
      if (data.echoes) {
        setEchoTimeline([
          {
            id: Date.now().toString() + Math.random().toString(),
            sceneTitle: data.sceneTitle || "Genesis Pivot",
            choiceTaken: "Story Initialized",
            shortTerm: data.echoes.shortTermEcho || "Reality canvas constructed.",
            mediumTerm: data.echoes.mediumTermEcho || "Initial variables localized.",
            longTerm: data.echoes.longTermEcho || "Primary anchor threads locked.",
            complexityScore: data.echoes.fateComplexityScore || 35,
            timestamp: new Date().toLocaleTimeString(),
          }
        ]);
      } else {
        setEchoTimeline([]);
      }

      // Initialize relationships empty on new story
      setRelationships({});
      setNpcUpdateNotifs([]);
      setStoryMilestones(data.milestonesAchieved || []);
      setConsequences(data.newConsequences || {});

      if (data.npcUpdates && Array.isArray(data.npcUpdates)) {
        setRelationships((prev) => {
          const next = { ...prev };
          data.npcUpdates.forEach((update: any) => {
            if (!next[update.name])
              next[update.name] = { affinity: 0, suspicion: 0 };
            if (update.relationshipType === "suspicion") {
              next[update.name].suspicion = Math.max(
                -100,
                Math.min(
                  100,
                  next[update.name].suspicion + update.affinityChange,
                ),
              );
            } else {
              next[update.name].affinity = Math.max(
                -100,
                Math.min(
                  100,
                  next[update.name].affinity + update.affinityChange,
                ),
              );
            }
          });
          return next;
        });

        setNpcUpdateNotifs(
          data.npcUpdates.map((u: any) => ({
            ...u,
            id: Date.now() + Math.random(),
          })),
        );
      }

      setShowParameterSetup(false);
      setCurrentNode(data);

      // Create story in Firestore
      const storyRef = await addDoc(
        collection(db, "users", user.uid, "stories"),
        {
          userId: user.uid,
          genre: genre,
          storyLength: storyParameters.length,
          characterArchetype: storyParameters.archetype,
          backstory: storyParameters.backstory,
          plotComplexity: storyParameters.complexity,
          tone: storyParameters.tone,
          isAdultContent: storyParameters.isAdultContent,
          customBasis: storyParameters.customBasis,
          status: "active",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          storyMilestones: data.milestonesAchieved || [],
          consequences: data.newConsequences || {},
        },
      ).catch((err) =>
        handleFirestoreError(
          err,
          OperationType.CREATE,
          `users/${user.uid}/stories`,
        ),
      );

      const isDocRef = (ref: any): ref is { id: string } =>
        ref && typeof ref === "object" && "id" in ref;

      if (isDocRef(storyRef)) {
        setCurrentStoryId(storyRef.id);

        // Save initial NPC relationship updates to subcollection
        if (data.npcUpdates && Array.isArray(data.npcUpdates)) {
          for (const update of data.npcUpdates) {
            await addDoc(
              collection(db, "users", user.uid, "stories", storyRef.id, "relationship_logs"),
              {
                name: update.name,
                relationshipType: update.relationshipType,
                affinityChange: update.affinityChange,
                reason: update.reason || "Baseline integration",
                timestamp: new Date().toISOString()
              }
            ).catch(err => console.error("Error saving initial rel log: ", err));
          }
        }

        // Add initial step
        await addDoc(
          collection(db, "users", user.uid, "stories", storyRef.id, "steps"),
          {
            sceneTitle: data.sceneTitle,
            sceneDescription: data.sceneDescription,
            imageUrl: null,
            choiceTaken: null,
            imagePrompt: data.imagePrompt,
            mediaType: data.mediaType,
            choices: data.choices || [],
            mood: data.mood,
            intensity: data.intensity,
            isEnding: !!data.isEnding,
            endingType: data.endingType || null,
            milestonesAchieved: data.milestonesAchieved || [],
            timestamp: serverTimestamp(),
          },
        ).catch((err) =>
          handleFirestoreError(
            err,
            OperationType.CREATE,
            `users/${user.uid}/stories/${storyRef.id}/steps`,
          ),
        );

        generateMedia(data.imagePrompt, data.mood, data.mediaType, storyRef.id);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChoice = async (choice: Choice) => {
    if (!currentNode || !user || !currentStoryId) return;

    // Trigger visual fade-out flow
    setIsSceneFadingOut(true);
    setLoading(true);
    setError(null);

    const newHistory = [
      ...history,
      {
        sceneDescription: currentNode.sceneDescription,
        choiceTaken: choice.text,
      },
    ];
    const savedNode = currentNode; // Save in case of failure
    setHistory(newHistory);

    const delayDuration = settings.reducedMotion || settings.readerMode ? 300 : 750;

    // Start fetching story in parallel with transition sequence
    const fetchPromise = (async () => {
      let g = "Romance";
      if (genre === "crime") g = "True Crime Noir";
      if (genre === "paranormal") g = "Paranormal Occult Indie";

      const maxTurns =
        storyParameters.length === "short"
          ? 2
          : storyParameters.length === "medium"
            ? 5
            : 8;
      const isFinalChoice = newHistory.length >= maxTurns;

      const response = await fetch("/api/story/continue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: newHistory,
          choice,
          genre: g,
          storyLength: storyParameters.length,
          characterArchetype: storyParameters.archetype,
          backstory: storyParameters.backstory,
          plotComplexity: storyParameters.complexity,
          tone: storyParameters.tone,
          isAdultContent: storyParameters.isAdultContent,
          customBasis: storyParameters.customBasis,
          relationships,
          storyMilestones,
          consequences,
          isFinalChoice,
          customTwist: appMode === "creator" ? customTwist : "",
          simulationMode: settings.simulationMode || "standard",
          isWhatIfMode: isWhatIfMode || false,
        }),
      });
      if (!response.ok) throw new Error("Failed to continue story");
      return await response.json();
    })();

    try {
      // Wait for both the network and the beautiful visual fade-out sequence
      const [data] = await Promise.all([
        fetchPromise,
        new Promise((resolve) => setTimeout(resolve, delayDuration))
      ]);

      // Reset the fade state before binding the new story node
      setIsSceneFadingOut(false);

      // Handle NPC Relationships
      let updatedRelationships = { ...relationships };
      if (data.npcUpdates && Array.isArray(data.npcUpdates)) {
        data.npcUpdates.forEach((update: any) => {
          if (!updatedRelationships[update.name]) {
            updatedRelationships[update.name] = { affinity: 0, suspicion: 0 };
          }
          if (update.relationshipType === "suspicion") {
            updatedRelationships[update.name].suspicion = Math.max(
              -100,
              Math.min(
                100,
                updatedRelationships[update.name].suspicion + update.affinityChange,
              ),
            );
          } else {
            updatedRelationships[update.name].affinity = Math.max(
              -100,
              Math.min(
                100,
                updatedRelationships[update.name].affinity + update.affinityChange,
              ),
            );
          }
        });
        setRelationships(updatedRelationships);

        // Add to notifications queue
        setNpcUpdateNotifs((prev) => [
          ...prev,
          ...data.npcUpdates.map((u: any) => ({
            ...u,
            id: Date.now() + Math.random(),
          })),
        ]);
      }

      const updatedMilestones = [...storyMilestones, ...(data.milestonesAchieved || [])];
      if (data.milestonesAchieved && Array.isArray(data.milestonesAchieved)) {
        setStoryMilestones(updatedMilestones);
      }
      
      const updatedConsequences = { ...consequences, ...(data.newConsequences || {}) };
      if (data.newConsequences) {
        setConsequences(updatedConsequences);
      }

      // Clear layout and mount the new scene node
      setCurrentNode(null);
      setTimeout(() => {
        setCurrentNode(data);
        setCustomTwist("");
      }, 50);

      // Deduct simulated token expenditures based on active complexity mode
      const cost = settings.simulationMode === "light" ? 10 : settings.simulationMode === "deep" ? 60 : 30;
      setSettings((s) => ({
        ...s,
        fateTokens: Math.max(0, (s.fateTokens || 3840) - cost),
      }));

      // Record newly generated narrative echoes & ripples
      if (data.echoes) {
        setEchoTimeline((prev) => [
          ...prev,
          {
            id: Date.now().toString() + Math.random().toString(),
            sceneTitle: data.sceneTitle || "Reality Pivot",
            choiceTaken: choice.text,
            shortTerm: data.echoes.shortTermEcho || "Immediate local shift.",
            mediumTerm: data.echoes.mediumTermEcho || "Secondary ripple propagating.",
            longTerm: data.echoes.longTermEcho || "Permanent world paradigm adjusted.",
            complexityScore: data.echoes.fateComplexityScore || 35,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      }

      let stepRef: any = null;

      if (!isWhatIfMode) {
        // Update Firestore database
        await setDoc(
          doc(db, "users", user.uid, "stories", currentStoryId),
          {
            updatedAt: serverTimestamp(),
            consequences: updatedConsequences,
            storyMilestones: updatedMilestones,
            relationships: updatedRelationships,
          },
          { merge: true },
        ).catch((err) =>
          handleFirestoreError(
            err,
            OperationType.UPDATE,
            `users/${user.uid}/stories/${currentStoryId}`,
          ),
        );

        // Save new NPC relationship updates to subcollection
        if (data.npcUpdates && Array.isArray(data.npcUpdates)) {
          for (const update of data.npcUpdates) {
            await addDoc(
              collection(db, "users", user.uid, "stories", currentStoryId, "relationship_logs"),
              {
                name: update.name,
                relationshipType: update.relationshipType,
                affinityChange: update.affinityChange,
                reason: update.reason || "Decisive player action",
                timestamp: new Date().toISOString()
              }
            ).catch(err => console.error("Error saving rel log: ", err));
          }
        }

        stepRef = await addDoc(
          collection(db, "users", user.uid, "stories", currentStoryId, "steps"),
          {
            sceneTitle: data.sceneTitle,
            sceneDescription: data.sceneDescription,
            imageUrl: null,
            videoUrl: null,
            choiceTaken: choice.text,
            imagePrompt: data.imagePrompt,
            mediaType: data.mediaType,
            choices: data.choices || [],
            mood: data.mood,
            intensity: data.intensity,
            isEnding: !!data.isEnding,
            endingType: data.endingType || null,
            milestonesAchieved: data.milestonesAchieved || [],
            timestamp: serverTimestamp(),
          },
        ).catch((err) =>
          handleFirestoreError(
            err,
            OperationType.CREATE,
            `users/${user.uid}/stories/${currentStoryId}/steps`,
          ),
        );
      } else {
        // Virtual mock coordinate for client alternate rendering
        stepRef = { id: "what-if-step-" + Date.now() };
      }

      const isDocRef = (ref: any): ref is { id: string } =>
        ref && typeof ref === "object" && "id" in ref;
      if (isDocRef(stepRef) || (stepRef && stepRef.id)) {
        setAllSteps((prev) => [
          ...prev,
          { 
            ...data, 
            id: stepRef ? stepRef.id : ("step-" + Date.now()), 
            choiceTaken: choice.text,
            isAlternativeBranch: isWhatIfMode 
          },
        ]);
      }

      if (!isWhatIfMode) {
        generateMedia(
          data.imagePrompt,
          data.mood,
          data.mediaType,
          currentStoryId,
        );
      }
    } catch (err: any) {
      setIsSceneFadingOut(false);
      setCurrentNode(savedNode); // Restore the old scene so user can retry the choice
      setHistory(history); // Rollback history
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- Creator & Collab Helpers ---

  // Export Story Package
  const handleExportStory = () => {
    if (!currentNode) return;
    try {
      const title = storyParameters.archetype || "My Echoes Story";
      let md = `# STORY EXPORT: ${title}\n`;
      md += `**Genre**: ${genre}\n`;
      md += `**Backstory**: ${storyParameters.backstory}\n`;
      md += `**Tone**: ${storyParameters.tone} | **Complexity**: ${storyParameters.complexity}\n\n`;
      
      md += `## CHRONICLES / NARRATIVE TRAILING:\n\n`;
      allSteps.forEach((step, idx) => {
        md += `### Scene ${idx + 1}: ${step.sceneTitle}\n`;
        md += `${step.sceneDescription}\n\n`;
        if (step.choiceTaken) {
          md += `*Choice Taken*: **${step.choiceTaken}**\n\n`;
        }
        if (step.imagePrompt) {
          md += `*Atmosphere Visual Prompt*: _${step.imagePrompt}_\n\n`;
        }
        md += `---------------------------------\n\n`;
      });

      md += `\n## GRIMOIRE & CODEX DISCOVERIES:\n\n`;
      md += `### Active Relationships\n`;
      Object.keys(relationships).forEach(name => {
        const rel = relationships[name];
        md += `- **${name}**: Affinity: ${rel.affinity}% | Suspicion: ${rel.suspicion}%\n`;
      });
      
      md += `\n### Achieved Goals & Milestones:\n`;
      storyMilestones.forEach(milestone => {
        md += `- ${milestone}\n`;
      });

      md += `\n### Long-Term Consequences of Choices:\n`;
      Object.keys(consequences).forEach(key => {
        md += `- **${key}**: ${consequences[key]}\n`;
      });

      // Save as file in browser
      const blob = new Blob([md], { type: "text/markdown;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${title.toLowerCase().replace(/[^a-z0-9]/g, "_")}_grimoire_bundle.md`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error(e);
    }
  };

  // Publish / Share Echo Pathway
  const handleShareStory = async () => {
    if (!user || !currentStoryId) return;
    setIsSharing(true);
    setSharedLink(null);
    try {
      const echoId = `shared_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const sharedDocRef = doc(db, "shared_echoes", echoId);
      
      const snapshotSteps = allSteps.map(step => ({
        sceneTitle: step.sceneTitle || "Uncharted Scene",
        sceneDescription: step.sceneDescription || "",
        choiceTaken: step.choiceTaken || null,
        imageUrl: step.imageUrl || null,
        imagePrompt: step.imagePrompt || null
      }));

      await setDoc(sharedDocRef, {
        storyId: currentStoryId,
        userId: user.uid,
        creatorName: user.displayName || user.email?.split("@")[0] || "Mysterious Creator",
        genre: genre,
        characterArchetype: storyParameters.archetype,
        customBasis: storyParameters.customBasis,
        stepsSnapshot: snapshotSteps,
        createdAt: new Date().toISOString()
      });

      const urlValue = `${window.location.origin}/?sharedEcho=${echoId}`;
      setSharedLink(urlValue);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSharing(false);
    }
  };

  // Create Collaborative Lobby
  const handleCreateRoom = async () => {
    if (!user || !currentStoryId) return;
    setIsCreatingRoom(true);
    try {
      const code = `ROOM-${Math.floor(1000 + Math.random() * 9000)}`;
      setRoomCode(code);
      const roomRef = doc(db, "rooms", code);
      
      const newRoom = {
        roomId: code,
        hostId: user.uid,
        hostName: user.displayName || user.email?.split("@")[0] || "Host",
        genre: genre,
        status: "active",
        activeStoryId: currentStoryId,
        participants: [{ uid: user.uid, name: user.displayName || user.email?.split("@")[0] || "Host" }],
        currentVotes: {},
        chat: [{ sender: "System", message: `Collab Space ${code} is active! Share the code to invite allies.`, timestamp: new Date().toISOString() }],
        createdAt: new Date().toISOString()
      };

      await setDoc(roomRef, newRoom);
      setActiveRoom(newRoom);
    } catch (e) {
      console.error(e);
    } finally {
      setIsCreatingRoom(false);
    }
  };

  // Join Collaborative Lobby
  const handleJoinRoom = async () => {
    if (!user || !joiningRoomCode) return;
    setIsJoiningRoom(true);
    setError(null);
    try {
      const cleanCode = joiningRoomCode.trim().toUpperCase();
      const roomRef = doc(db, "rooms", cleanCode);
      const roomDoc = await getDoc(roomRef);
      
      if (!roomDoc.exists()) {
        throw new Error("Collab room does not exist. Check code.");
      }

      const roomData = roomDoc.data();
      const name = user.displayName || user.email?.split("@")[0] || "Allie";
      
      // Add participant if not already present
      const hasJoined = (roomData.participants || []).some((p: any) => p.uid === user.uid);
      let updatedParticipants = [...(roomData.participants || [])];
      if (!hasJoined) {
        updatedParticipants.push({ uid: user.uid, name });
      }

      const updatedChat = [
        ...(roomData.chat || []),
        { sender: "System", message: `${name} has joined the fate-weaving lobby.`, timestamp: new Date().toISOString() }
      ];

      await setDoc(roomRef, {
        participants: updatedParticipants,
        chat: updatedChat
      }, { merge: true });

      setActiveRoom({ roomId: cleanCode, ...roomData, participants: updatedParticipants, chat: updatedChat });
      setRoomCode(cleanCode);
      
      // Load active story or trigger load
      if (roomData.activeStoryId) {
        loadSharedStoryState(roomData.activeStoryId);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsJoiningRoom(false);
    }
  };

  // Live Sync Story State (called onRoomSync change)
  const loadSharedStoryState = async (storyId: string) => {
    if (!user) return;
    try {
      const storyDoc = await getDoc(doc(db, "users", user.uid, "stories", storyId));
      if (storyDoc.exists()) {
        const storyData = storyDoc.data();
        setCurrentStoryId(storyId);
        setGenre(storyData.genre);
        setStoryParameters({
          length: storyData.storyLength || "medium",
          archetype: storyData.characterArchetype || "",
          backstory: storyData.backstory || "",
          complexity: storyData.plotComplexity || "complex",
          tone: storyData.tone || "intense",
          isAdultContent: storyData.isAdultContent || false,
          customBasis: storyData.customBasis || ""
        });
        
        // Fetch steps
        const stepsCol = collection(db, "users", user.uid, "stories", storyId, "steps");
        const stepsSnapshot = await getDocs(query(stepsCol, orderBy("timestamp", "asc")));
        const steps = stepsSnapshot.docs.map(d => d.data());
        if (steps.length > 0) {
          setAllSteps(steps as any[]);
          setCurrentNode(steps[steps.length - 1] as StoryNode);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Leave active room
  const handleLeaveRoom = async () => {
    if (!user || !activeRoom) return;
    try {
      const cleanCode = activeRoom.roomId;
      const roomRef = doc(db, "rooms", cleanCode);
      const name = user.displayName || user.email?.split("@")[0] || "Allie";
      
      const filteredParticipants = (activeRoom.participants || []).filter((p: any) => p.uid !== user.uid);
      const updatedChat = [
        ...(activeRoom.chat || []),
        { sender: "System", message: `${name} has left the fate-weaving lobby.`, timestamp: new Date().toISOString() }
      ];

      await setDoc(roomRef, {
        participants: filteredParticipants,
        chat: updatedChat
      }, { merge: true });

      setActiveRoom(null);
      setRoomCode("");
    } catch (e) {
      console.error(e);
    }
  };

  // Cast choice vote in real-time
  const handleCastVote = async (choiceIndex: number) => {
    if (!user || !activeRoom) return;
    try {
      const roomRef = doc(db, "rooms", activeRoom.roomId);
      const votes = { ...(activeRoom.currentVotes || {}) };
      
      // Remove previous vote by this user if any
      Object.keys(votes).forEach(idxStr => {
        if (Array.isArray(votes[idxStr])) {
          votes[idxStr] = votes[idxStr].filter((uid: string) => uid !== user.uid);
        }
      });

      // Add vote
      const indexKey = String(choiceIndex);
      if (!Array.isArray(votes[indexKey])) {
        votes[indexKey] = [];
      }
      votes[indexKey].push(user.uid);

      await setDoc(roomRef, {
        currentVotes: votes
      }, { merge: true });
    } catch (e) {
      console.error(e);
    }
  };

  // Send Chat message
  const handleSendChatMessage = async () => {
    if (!user || !activeRoom || !chatMessage.trim()) return;
    try {
      const roomRef = doc(db, "rooms", activeRoom.roomId);
      const name = user.displayName || user.email?.split("@")[0] || "Allie";
      const newMsg = {
        sender: name,
        message: chatMessage.trim(),
        timestamp: new Date().toISOString()
      };
      
      await setDoc(roomRef, {
        chat: [...(activeRoom.chat || []), newMsg]
      }, { merge: true });
      
      setChatMessage("");
    } catch (e) {
      console.error(e);
    }
  };

  const ensureCompactImageUrl = async (
    url: string | null | undefined,
    prompt: string = "",
    mood: string = "mystery",
  ): Promise<string | null> => {
    if (!url) return null;
    if (url.startsWith("data:image/") && url.length > 5000) {
      try {
        const res = await fetch("/api/story/cache-base64", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64: url, prompt, mood, genre }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.imageUrl) {
            return data.imageUrl;
          }
        }
      } catch (err) {
        console.error("Failed to automatically minimize and cache base64 image", err);
      }
    }
    return url;
  };

  const generateMedia = async (
    prompt: string,
    mood: string,
    type: "image" | "video",
    storyId?: string | null,
  ) => {
    if (type === "video") {
      await generateVideo(prompt, mood, storyId);
    } else {
      await generateImage(prompt, mood, storyId);
    }
  };

  const generateVideo = async (prompt: string, mood: string, storyId?: string | null) => {
    setVideoStatus({ status: "generating" });
    setGenerationProgress(5);
    try {
      const startRes = await fetch("/api/story/video/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!startRes.ok) throw new Error("Video generation failed to start");
      const { operationName } = await startRes.json();
      setGenerationProgress(15);

      // Poll for status
      let done = false;
      let pollCount = 0;
      while (!done) {
        await new Promise((r) => setTimeout(r, 5000));
        pollCount++;
        // Simulate progress increasing slowly during polling
        setGenerationProgress((prev) => {
          if (prev < 85) return prev + Math.max(1, (90 - prev) / 10);
          return prev;
        });

        const statusRes = await fetch("/api/story/video/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operationName }),
        });
        const statusData = await statusRes.json();
        done = statusData.done;
      }

      setGenerationProgress(90);
      setVideoStatus({ status: "downloading" });
      const downloadRes = await fetch("/api/story/video/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operationName }),
      });
      if (!downloadRes.ok) throw new Error("Video download failed");

      setGenerationProgress(95);
      const blob = await downloadRes.blob();
      const videoUrl = URL.createObjectURL(blob);
      setGenerationProgress(100);
      setCurrentNode((prev) =>
        prev ? { ...prev, videoUrl, mediaType: "video" } : null,
      );

      if (user && storyId) {
        const stepsRef = collection(
          db,
          "users",
          user.uid,
          "stories",
          storyId,
          "steps",
        );
        const q = query(stepsRef, orderBy("timestamp", "desc"), limit(1));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          // Note: Blobs can't be stored directly in Firestore, usually we'd upload to Storage.
          // For this preview, the blob is enough for the session resume if we don't refresh.
          // But to be consistent, we'd need a real URL.
          await setDoc(
            doc(
              db,
              "users",
              user.uid,
              "stories",
              storyId,
              "steps",
              snapshot.docs[0].id,
            ),
            {
              videoUrl: "local-blob-session", // Placeholder
            },
            { merge: true },
          ).catch((err) =>
            handleFirestoreError(
              err,
              OperationType.UPDATE,
              `users/${user.uid}/stories/${storyId}/steps/${snapshot.docs[0].id}`,
            ),
          );
        }
      }
    } catch (err: any) {
      console.error("Video gen failed", err);
      setVideoStatus({ status: "failed" });

      // Fallback to image generation if video fails - using the direct mood parameter passed
      console.log("Falling back to image generation...");
      generateImage(prompt, mood, storyId);
    } finally {
      setVideoStatus({ status: "idle" });
      const currentProgress = generationProgress;
      if (currentProgress < 100) setGenerationProgress(0);
      else setTimeout(() => setGenerationProgress(0), 2000);
    }
  };

  const generateImage = async (
    prompt: string,
    mood: string,
    storyId?: string | null,
  ) => {
    setImageLoading(true);
    setGenerationProgress(10);
    setCurrentNode((prev) =>
      prev ? { ...prev, imageGenFailed: false } : null,
    );
    // Fake progress interval for image
    const progressInterval = setInterval(() => {
      setGenerationProgress((prev) => {
        if (prev < 90) return prev + 5;
        return prev;
      });
    }, 400);

    try {
      const response = await fetch("/api/story/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, mood, genre }),
      });
      if (!response.ok) throw new Error("Failed to generate image");
      const data = await response.json();
      setGenerationProgress(100);
      setCurrentNode((prev) =>
        prev ? { ...prev, imageUrl: data.imageUrl, imageGenFailed: false } : null,
      );

      // Update latest step with image URL if possible
      if (user && storyId) {
        const stepsRef = collection(
          db,
          "users",
          user.uid,
          "stories",
          storyId,
          "steps",
        );
        const q = query(stepsRef, orderBy("timestamp", "desc"), limit(1));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          await setDoc(
            doc(
              db,
              "users",
              user.uid,
              "stories",
              storyId,
              "steps",
              snapshot.docs[0].id,
            ),
            {
              imageUrl: data.imageUrl,
            },
            { merge: true },
          ).catch((err) =>
            handleFirestoreError(
              err,
              OperationType.UPDATE,
              `users/${user.uid}/stories/${storyId}/steps/${snapshot.docs[0].id}`,
            ),
          );
        }
      }
    } catch (err: any) {
      console.error("Image gen failed", err);
      setError(`Image generation failed: ${err.message}`);
      setCurrentNode((prev) =>
        prev ? { ...prev, imageGenFailed: true } : null,
      );
    } finally {
      clearInterval(progressInterval);
      setImageLoading(false);
      setTimeout(() => setGenerationProgress(0), 1000);
    }
  };

  const resetGame = async () => {
    if (user && currentStoryId) {
      await setDoc(
        doc(db, "users", user.uid, "stories", currentStoryId),
        {
          status: "completed",
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ).catch((err) =>
        handleFirestoreError(
          err,
          OperationType.UPDATE,
          `users/${user.uid}/stories/${currentStoryId}`,
        ),
      );
    }
    setGenre(null);
    setStoryParameters({
      length: "medium",
      archetype: "",
      backstory: "",
      complexity: "complex",
      tone: "intense",
      isAdultContent: false,
      customBasis: "",
    });
    setCustomActionText("");
    setShowParameterSetup(false);
    setCurrentNode(null);
    setHistory([]);
    setError(null);
    setCurrentStoryId(null);
    setConsequences({});
  };

  const themeClasses =
    genre === "romance"
      ? "bg-[#FCF8F8] text-[#3D2626] font-sans selection:bg-rose-200 selection:text-rose-900 cursor-default"
      : genre === "crime"
        ? "bg-[#0A0C10] text-[#E5E7EB] font-sans selection:bg-sky-900 selection:text-white cursor-crosshair"
        : genre === "paranormal"
          ? "bg-[#0D0A14] text-[#DBCFEF] font-sans selection:bg-purple-900 selection:text-white cursor-help"
          : "bg-[#050505] text-white font-sans";

  const headingFont =
    genre === "romance"
      ? "font-serif italic text-rose-950"
      : genre === "paranormal"
        ? "font-serif italic tracking-wide text-purple-100"
        : "font-display uppercase tracking-tight text-white";
  const bodyFont =
    settings.fontFamily && settings.fontFamily !== "default"
      ? (settings.fontFamily === "sans" ? "font-sans" : settings.fontFamily === "serif" ? "font-serif text-[110%] leading-relaxed" : "font-mono text-[92%]")
      : (genre === "romance"
        ? "font-sans"
        : genre === "paranormal"
          ? "font-sans opacity-90"
          : "font-mono");

  const getGenreAccent = () => {
    switch (genre) {
      case "romance":
        return "rose";
      case "paranormal":
        return "purple";
      case "crime":
        return "sky";
      default:
        return "gray";
    }
  };

  const accent = getGenreAccent();

  const buttonPrimary =
    genre === "romance"
      ? "bg-rose-500 hover:bg-rose-600 text-white shadow-rose-200"
      : genre === "paranormal"
        ? "bg-purple-600 hover:bg-purple-500 text-white shadow-purple-900/20"
        : "bg-sky-600 hover:bg-sky-500 text-white shadow-sky-900/20";

  const buttonSecondary =
    genre === "romance"
      ? "bg-rose-50 border-rose-100 text-rose-500 hover:bg-rose-100"
      : genre === "paranormal"
        ? "bg-purple-900/20 border-purple-500/20 text-purple-300 hover:bg-purple-900/40"
        : "bg-white/5 border-white/10 text-sky-400 hover:bg-white/10";

  const cardBase =
    genre === "romance"
      ? "bg-white/80 border-rose-100 shadow-xl shadow-rose-900/5"
      : genre === "paranormal"
        ? "bg-[#0a0510]/80 border-purple-500/10 shadow-2xl shadow-black"
        : "bg-black/60 border-white/5 shadow-2xl";

  const fontSizeClass =
    settings.fontSize === "sm"
      ? "text-sm"
      : settings.fontSize === "lg"
        ? "text-xl"
        : settings.fontSize === "xl"
          ? "text-2xl"
          : "text-lg";
  const lineSpacingClass =
    settings.lineSpacing === "tight"
      ? "leading-tight"
      : settings.lineSpacing === "relaxed"
        ? "leading-relaxed"
        : "leading-normal";
  const textAlignClass =
    settings.textAlign === "center"
      ? "text-center"
      : settings.textAlign === "justify"
        ? "text-justify"
        : "text-left";
  const fontWeightClass =
    settings.fontWeight === "light"
      ? "font-light"
      : settings.fontWeight === "bold"
        ? "font-bold"
        : "font-normal";
  const letterSpacingClass =
    settings.letterSpacing === "widest"
      ? "tracking-widest"
      : settings.letterSpacing === "wide"
        ? "tracking-wide"
        : "tracking-normal";

  return (
    <div
      className={`min-h-screen transition-all duration-1000 ease-in-out ${themeClasses} overflow-x-hidden ${settings.reducedMotion ? "motion-reduce" : ""}`}
    >
      <Suspense fallback={null}>
        <AtmosphericEffects genre={genre} mood={currentNode?.mood} reducedMotion={settings.reducedMotion || settings.readerMode} />
        <SoundtrackManager
          mood={currentNode?.mood}
          intensity={currentNode?.intensity}
          genre={genre}
          volume={settings.volume}
          volumeMusic={settings.volumeMusic}
          isMuted={settings.isMuted}
        />
      </Suspense>

      <AnimatePresence>
        {syncStatus.status !== "online" && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 right-6 z-[1000] flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg border backdrop-blur-md"
            style={{
              backgroundColor: syncStatus.status === "offline_active" ? "rgba(239, 68, 68, 0.15)" : "rgba(16, 185, 129, 0.15)",
              borderColor: syncStatus.status === "offline_active" ? "rgba(239, 68, 68, 0.3)" : "rgba(16, 185, 129, 0.3)",
              color: syncStatus.status === "offline_active" ? "#ef4444" : "#10b981",
            }}
          >
            {syncStatus.status === "offline_active" ? (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
            ) : (
              <span className="relative flex h-2 w-2">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            )}
            <span className="text-xs font-mono font-medium tracking-wide">
              {syncStatus.message}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTutorial && (
          <OnboardingTutorial
            genre={genre}
            onClose={() => {
              setShowTutorial(false);
              localStorage.setItem("hasSeenTutorial", "true");
            }}
          />
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-xl bg-black/50 overflow-y-auto">
          <div
            className={`w-full max-w-lg p-6 md:p-8 rounded-[2.5rem] border shadow-2xl transition-all duration-300 ${
              genre === "romance"
                ? "bg-[#FCF8F8] border-rose-200 text-rose-950"
                : genre === "paranormal"
                  ? "bg-[#0E0A16] border-purple-500/20 text-purple-200"
                  : "bg-zinc-900 border-white/10 text-white"
            } max-h-[90vh] flex flex-col`}
          >
            <div className="flex justify-between items-center mb-6 shrink-0 border-b border-rose-100 pb-4 dark:border-white/5">
              <div className="space-y-1 text-left">
                <h3
                  className={`text-2xl font-black uppercase tracking-tight flex items-center gap-2 ${genre === "romance" ? "text-rose-900 font-serif" : "text-white"}`}
                >
                  <Sliders className="w-5 h-5 opacity-75 text-sky-400" /> Set Choice Reality Parameters
                </h3>
                <p className="text-[9px] uppercase tracking-widest opacity-40 font-mono">Customize your immersive story canvas</p>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="p-2 hover:bg-black/10 dark:hover:bg-white/5 rounded-full transition-colors shrink-0"
                aria-label="Close settings"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6 overflow-y-auto pr-2 custom-scrollbar flex-1 pb-4">
              
              {/* SECTION: AUDIO LEVEL MANAGEMENT */}
              <div className="space-y-4 p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
                <h4 className="text-[10px] font-mono uppercase tracking-wider font-extrabold pb-2 border-b border-black/5 dark:border-white/5 flex items-center justify-between text-left">
                  <span>🔊 Immersive Audio Core</span>
                  {settings.isMuted && <span className="text-red-500 text-[8.5px] uppercase tracking-widest animate-pulse">[ MUTED ]</span>}
                </h4>

                {/* Master Mute Trigger */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 text-left">
                    <p className="text-[11px] font-bold uppercase tracking-wider">Silence Realm Soundtrack</p>
                    <p className="text-[9px] opacity-40">Mute all background and atmospheric sound elements</p>
                  </div>
                  <button
                    onClick={toggleMute}
                    className={`w-12 h-6 rounded-full relative transition-colors ${
                      settings.isMuted 
                        ? "bg-rose-600" 
                        : genre === "romance" ? "bg-rose-200" : "bg-sky-500"
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.isMuted ? "left-7" : "left-1"}`}
                    />
                  </button>
                </div>
                
                {/* Granular Audio Sliders */}
                <div className="space-y-3 pt-2">
                  {/* Slider 1: Soundtrack Music */}
                  <div className="space-y-1 text-left">
                    <div className="flex justify-between items-center text-[10px] uppercase font-mono tracking-wider opacity-60">
                      <span>🎵 Soundtrack & Themes</span>
                      <span>{settings.isMuted ? "0%" : `${settings.volumeMusic}%`}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Music className="w-3.5 h-3.5 opacity-50 shrink-0" />
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={settings.volumeMusic}
                        disabled={settings.isMuted}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            volumeMusic: parseInt(e.target.value),
                            volume: parseInt(e.target.value) // Sync legacy volume variable
                          }))
                        }
                        className={`flex-1 h-1 rounded-lg appearance-none cursor-pointer disabled:opacity-30 ${
                          genre === "romance" ? "bg-rose-100 accent-rose-500" : "bg-white/10 accent-sky-500"
                        }`}
                      />
                    </div>
                  </div>

                  {/* Slider 2: Sound Effects */}
                  <div className="space-y-1 text-left">
                    <div className="flex justify-between items-center text-[10px] uppercase font-mono tracking-wider opacity-60">
                      <span>⚡ Turning Point SFX</span>
                      <span>{settings.isMuted ? "0%" : `${settings.volumeSFX}%`}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Zap className="w-3.5 h-3.5 opacity-50 shrink-0" />
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={settings.volumeSFX}
                        disabled={settings.isMuted}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            volumeSFX: parseInt(e.target.value),
                          }))
                        }
                        className={`flex-1 h-1 rounded-lg appearance-none cursor-pointer disabled:opacity-30 ${
                          genre === "romance" ? "bg-rose-100 accent-rose-500" : "bg-white/10 accent-sky-500"
                        }`}
                      />
                    </div>
                  </div>

                  {/* Slider 3: Ambient Atmosphere */}
                  <div className="space-y-1 text-left">
                    <div className="flex justify-between items-center text-[10px] uppercase font-mono tracking-wider opacity-60">
                      <span>🌫️ Ambient Whispers</span>
                      <span>{settings.isMuted ? "0%" : `${settings.volumeAmbient}%`}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Wind className="w-3.5 h-3.5 opacity-50 shrink-0" />
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={settings.volumeAmbient}
                        disabled={settings.isMuted}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            volumeAmbient: parseInt(e.target.value),
                          }))
                        }
                        className={`flex-1 h-1 rounded-lg appearance-none cursor-pointer disabled:opacity-30 ${
                          genre === "romance" ? "bg-rose-100 accent-rose-500" : "bg-white/10 accent-sky-500"
                        }`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION: ADVANCED TYPOGRAPHY PROFILES */}
              <div className="space-y-5 p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
                <h4 className="text-[10px] font-mono uppercase tracking-wider font-extrabold pb-2 border-b border-black/5 dark:border-white/5 flex items-center gap-1.5 text-left">
                  <Type className="w-3.5 h-3.5 opacity-70" /> Granular Typography Canvas
                </h4>

                {/* Font Family selector */}
                <div className="space-y-2 text-left">
                  <span className="text-[9px] uppercase font-bold tracking-widest opacity-50">Visual Font Deck</span>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { key: "default", label: "Theme Default" },
                      { key: "sans", label: "Inter Sans" },
                      { key: "serif", label: "Novels Serif" },
                      { key: "mono", label: "Retro Mono" },
                    ].map((fontSpec) => (
                      <button
                        key={fontSpec.key}
                        onClick={() => setSettings((s) => ({ ...s, fontFamily: fontSpec.key }))}
                        className={`py-2 rounded-lg border text-[9px] font-bold uppercase tracking-wider transition-all truncate px-1 ${
                          settings.fontFamily === fontSpec.key
                            ? `bg-${accent}-500 border-${accent}-500 text-white`
                            : genre === "romance"
                              ? "border-rose-100 text-rose-800 hover:bg-rose-50"
                              : "border-white/10 text-white/50 hover:bg-white/5"
                        }`}
                      >
                        {fontSpec.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font Size deck */}
                <div className="space-y-2 text-left">
                  <span className="text-[9px] uppercase font-bold tracking-widest opacity-50">Reading Text Scale</span>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { key: "sm", label: "Small" },
                      { key: "md", label: "Medium" },
                      { key: "lg", label: "Large" },
                      { key: "xl", label: "Extra Large" },
                    ].map((sizeSpec) => (
                      <button
                        key={sizeSpec.key}
                        onClick={() => setSettings((s) => ({ ...s, fontSize: sizeSpec.key as any }))}
                        className={`py-2 rounded-lg border text-[9px] font-bold uppercase tracking-wider transition-all truncate px-1 ${
                          settings.fontSize === sizeSpec.key
                            ? `bg-${accent}-500 border-${accent}-500 text-white`
                            : genre === "romance"
                              ? "border-rose-100 text-rose-800 hover:bg-rose-50"
                              : "border-white/10 text-white/50 hover:bg-white/5"
                        }`}
                      >
                        {sizeSpec.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Letter Spacing deck */}
                <div className="space-y-2 text-left">
                  <span className="text-[9px] uppercase font-bold tracking-widest opacity-50">Kerning (Double Spacing)</span>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: "normal", label: "Normal" },
                      { key: "wide", label: "Spacious" },
                      { key: "widest", label: "Widespread" },
                    ].map((letterSpec) => (
                      <button
                        key={letterSpec.key}
                        onClick={() => setSettings((s) => ({ ...s, letterSpacing: letterSpec.key }))}
                        className={`py-2 rounded-lg border text-[9px] font-bold uppercase tracking-wider transition-all truncate px-1 ${
                          settings.letterSpacing === letterSpec.key
                            ? `bg-${accent}-500 border-${accent}-500 text-white`
                            : genre === "romance"
                              ? "border-rose-100 text-rose-800 hover:bg-rose-50"
                              : "border-white/10 text-white/50 hover:bg-white/5"
                        }`}
                      >
                        {letterSpec.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Multi Layout options row combo */}
                <div className="grid grid-cols-2 gap-4 pt-1 text-left">
                  {/* Line Spacing selector */}
                  <div className="space-y-2">
                    <span className="text-[9px] uppercase font-bold tracking-widest opacity-50">Line Spacing Height</span>
                    <select
                      value={settings.lineSpacing}
                      onChange={(e) => setSettings((s) => ({ ...s, lineSpacing: e.target.value as any }))}
                      className={`w-full py-2 px-3 rounded-xl border text-[11px] font-serif bg-transparent focus:outline-none ${
                        genre === "romance"
                          ? "border-rose-200 text-rose-950 bg-white"
                          : "border-white/10 text-white bg-zinc-950"
                      }`}
                    >
                      <option value="tight" className="dark:bg-zinc-900 text-black dark:text-white">Tight Line height</option>
                      <option value="normal" className="dark:bg-zinc-900 text-black dark:text-white">Normal Line height</option>
                      <option value="relaxed" className="dark:bg-zinc-900 text-black dark:text-white">Relaxed Line height</option>
                    </select>
                  </div>

                  {/* Text Alignment selector */}
                  <div className="space-y-2">
                    <span className="text-[9px] uppercase font-bold tracking-widest opacity-50">Story Align Orientation</span>
                    <select
                      value={settings.textAlign}
                      onChange={(e) => setSettings((s) => ({ ...s, textAlign: e.target.value as any }))}
                      className={`w-full py-2 px-3 rounded-xl border text-[11px] font-serif bg-transparent focus:outline-none ${
                        genre === "romance"
                          ? "border-rose-200 text-rose-950 bg-white"
                          : "border-white/10 text-white bg-zinc-950"
                      }`}
                    >
                      <option value="left" className="dark:bg-zinc-900 text-black dark:text-white">Left Justified</option>
                      <option value="center" className="dark:bg-zinc-900 text-black dark:text-white">Centered Display</option>
                      <option value="justify" className="dark:bg-zinc-900 text-black dark:text-white">Full Block Justified</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION: DETAILED VISUAL EFFECT CONTROLS */}
              <div className="space-y-4 p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
                <h4 className="text-[10px] font-mono uppercase tracking-wider font-extrabold pb-2 border-b border-black/5 dark:border-white/5 flex items-center gap-1.5 text-left">
                  <Sparkles className="w-3.5 h-3.5 opacity-70 text-amber-400" /> Atmos & Sensory Simulation Realism
                </h4>

                {/* Sub Option: Typewriter Effect */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 text-left">
                    <p className="text-[11px] font-bold uppercase tracking-wider">Holographic Typewriter</p>
                    <p className="text-[9px] opacity-40">Reveal scene narrative segments using dynamic tracking letter timing</p>
                  </div>
                  <button
                    onClick={() => setSettings((s) => ({ ...s, typewriter: !s.typewriter }))}
                    className={`w-12 h-6 rounded-full relative transition-colors ${settings.typewriter ? `bg-${accent}-500` : "bg-white/10"}`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.typewriter ? "left-7" : "left-1"}`}
                    />
                  </button>
                </div>

                {/* Sub Option: Atmospheric Deep Glow */}
                <div className="flex items-center justify-between border-t border-black/5 dark:border-white/5 pt-3">
                  <div className="space-y-0.5 text-left">
                    <p className="text-[11px] font-bold uppercase tracking-wider">Atmospheric Text Backglow</p>
                    <p className="text-[9px] opacity-40">Apply soft, mystical neon color aura behind narrative print</p>
                  </div>
                  <button
                    onClick={() => setSettings((s) => ({ ...s, textGlow: !s.textGlow }))}
                    className={`w-12 h-6 rounded-full relative transition-colors ${settings.textGlow ? `bg-${accent}-500` : "bg-white/10"}`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.textGlow ? "left-7" : "left-1"}`}
                    />
                  </button>
                </div>

                {/* Sub Option: Image Illustration display */}
                <div className="flex items-center justify-between border-t border-black/5 dark:border-white/5 pt-3">
                  <div className="space-y-0.5 text-left">
                    <p className="text-[11px] font-bold uppercase tracking-wider">Enable Story Imagery</p>
                    <p className="text-[9px] opacity-40">Render rich visual illustrations representing scenes</p>
                  </div>
                  <button
                    onClick={() => setSettings((s) => ({ ...s, showImages: !s.showImages }))}
                    className={`w-12 h-6 rounded-full relative transition-colors ${settings.showImages ? `bg-${accent}-500` : "bg-white/10"}`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.showImages ? "left-7" : "left-1"}`}
                    />
                  </button>
                </div>

                {/* Sub Option: Reader Mode */}
                <div className="flex items-center justify-between border-t border-black/5 dark:border-white/5 pt-3">
                  <div className="space-y-0.5 text-left">
                    <p className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                      📖 Distraction-Free Reader Mode
                    </p>
                    <p className="text-[9px] opacity-40">Strip away graphics, cinematic headers, and complex panels for a text-centric book feel</p>
                  </div>
                  <button
                    onClick={() => setSettings((s) => ({ ...s, readerMode: !s.readerMode }))}
                    className={`w-12 h-6 rounded-full relative transition-colors ${settings.readerMode ? `bg-${accent}-500` : "bg-white/10"}`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.readerMode ? "left-7" : "left-1"}`}
                    />
                  </button>
                </div>

                {/* Sub Option: Reduced Motion comfort */}
                <div className="flex items-center justify-between border-t border-black/5 dark:border-white/5 pt-3">
                  <div className="space-y-0.5 text-left">
                    <p className="text-[11px] font-bold uppercase tracking-wider">Accessibility: Reduced Motion</p>
                    <p className="text-[9px] opacity-40">Deactivate intensive panning backgrounds and floating particles</p>
                  </div>
                  <button
                    onClick={() => setSettings((s) => ({ ...s, reducedMotion: !s.reducedMotion }))}
                    className={`w-12 h-6 rounded-full relative transition-colors ${settings.reducedMotion ? `bg-${accent}-500` : "bg-white/10"}`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.reducedMotion ? "left-7" : "left-1"}`}
                    />
                  </button>
                </div>
              </div>

            </div>

            {/* Prompt footer info */}
            <div className="pt-4 shrink-0 border-t border-rose-100 dark:border-white/5 flex gap-2 justify-end">
              <button
                onClick={() => setShowSettings(false)}
                className={`px-6 py-2.5 rounded-xl text-[10px] uppercase tracking-widest font-black transition-all ${
                  genre === "romance"
                    ? "bg-rose-100 hover:bg-rose-200 text-rose-950 px-8"
                    : "bg-white/5 hover:bg-white/10 text-white"
                }`}
              >
                Sync Fate Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Library Modal */}
      {showLibrary && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-xl bg-black/60">
          <div
            className={`w-full max-w-4xl h-[80vh] flex flex-col p-8 rounded-[2.5rem] border shadow-2xl ${
              genre === "romance"
                ? "bg-white border-rose-100 text-rose-900"
                : "bg-zinc-950 border-white/10 text-white"
            }`}
          >
            <div className="flex justify-between items-center mb-8 px-4">
              <div className="space-y-1">
                <h3 className="text-3xl font-black uppercase tracking-tight">
                  Your Fates
                </h3>
                <p className="text-[10px] uppercase font-black tracking-[0.2em] opacity-40">
                  Previous and active narratives
                </p>
              </div>
              <button
                onClick={() => setShowLibrary(false)}
                className="p-2 hover:bg-white/5 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 p-4 custom-scrollbar">
              {userStories.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-20 gap-4">
                  <LibraryIcon className="w-12 h-12" />
                  <p className="text-xs font-black uppercase tracking-[0.3em]">
                    No stories woven yet
                  </p>
                </div>
              ) : (
                userStories.map((story) => (
                  <button
                    key={story.id}
                    onClick={() => loadStory(story.id)}
                    onMouseEnter={() => setHoveredStoryId(story.id)}
                    onMouseLeave={() => setHoveredStoryId(null)}
                    className={`w-full text-left p-6 rounded-3xl border transition-all group relative flex items-center justify-between overflow-hidden ${
                      story.id === currentStoryId
                        ? "border-sky-500 bg-sky-500/10"
                        : genre === "romance"
                          ? "border-rose-100 hover:bg-rose-50"
                          : "border-white/5 hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-6 relative z-10">
                      <div
                        className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 ${
                          story.genre === "romance"
                            ? "bg-rose-100 text-rose-500"
                            : story.genre === "crime"
                              ? "bg-sky-900/40 text-sky-400"
                              : "bg-purple-900/40 text-purple-400"
                        }`}
                      >
                        {story.genre === "romance" ? (
                          <Heart className="w-8 h-8" />
                        ) : story.genre === "crime" ? (
                          <Skull className="w-8 h-8" />
                        ) : (
                          <Moon className="w-8 h-8" />
                        )}
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-black uppercase tracking-widest opacity-40">
                          {story.genre || "Unknown"}
                        </p>
                        <h4 className="text-lg font-bold tracking-tight truncate max-w-[200px] md:max-w-md">
                          {story.characterArchetype || "Untitled Narrative"}
                        </h4>
                        <div className="flex gap-4 items-center">
                          <span className="text-[10px] font-mono opacity-60">
                            {story.updatedAt?.seconds
                              ? new Date(
                                  story.updatedAt.seconds * 1000,
                                ).toLocaleDateString()
                              : "Active"}
                          </span>
                          <span
                            className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full ${
                              story.status === "active"
                                ? "bg-green-500/20 text-green-500"
                                : "bg-gray-500/20 text-gray-500"
                            }`}
                          >
                            {story.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    <AnimatePresence>
                      {hoveredStoryId === story.id && (
                        <motion.div
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          className={`absolute right-12 left-[12rem] top-0 bottom-0 py-6 px-10 flex flex-col justify-center bg-transparent pointer-events-none hidden md:flex`}
                        >
                          <div
                            className={`h-full border-l pl-6 flex flex-col justify-center ${genre === "romance" ? "border-rose-100" : "border-white/10"}`}
                          >
                            <p
                              className={`text-[10px] uppercase font-black tracking-widest opacity-30 mb-2`}
                            >
                              Premise Preview
                            </p>
                            <p
                              className={`text-[11px] font-medium line-clamp-2 leading-relaxed italic ${genre === "romance" ? "text-rose-900/60" : "text-white/40"}`}
                            >
                              {story.customBasis ||
                                story.backstory ||
                                "The tapestry of fate is yet to be fully revealed..."}
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <ChevronRight className="w-5 h-5 opacity-0 group-hover:opacity-40 transition-all transform group-hover:translate-x-2 shrink-0" />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Google Keep Workspace Board Modal */}
      {showKeepNotes && currentStoryId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 backdrop-blur-xl bg-black/70 animate-fadeIn hover:cursor-default">
          <div className="w-full max-w-6xl h-[85vh] md:h-[90vh]">
            <GoogleKeepWorkspace
              currentStoryId={currentStoryId}
              currentNode={currentNode}
              onClose={() => setShowKeepNotes(false)}
              genre={genre}
              onJumpToScene={handleJumpToScene}
            />
          </div>
        </div>
      )}

      {/* Persistent Codex & Lore Glossary Modal */}
      {showCodex && currentStoryId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 backdrop-blur-xl bg-black/70 animate-fadeIn hover:cursor-default">
          <div className="w-full max-w-6xl h-[85vh] md:h-[90vh]">
            <CodexLoreGlossary
              currentStoryId={currentStoryId}
              currentNode={currentNode}
              onClose={() => setShowCodex(false)}
              genre={genre}
            />
          </div>
        </div>
      )}

      {/* Floating Selection Extract Menu */}
      <AnimatePresence>
        {selectedText && selectionCoords && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 5 }}
            style={{
              position: "absolute",
              left: selectionCoords.x,
              top: selectionCoords.y,
            }}
            className="z-50 bg-slate-950 border border-amber-500/30 backdrop-blur-md rounded-xl p-2 shadow-2xl flex items-center gap-1.5 text-[10px] text-white select-none whitespace-nowrap"
          >
            <span className="text-amber-400 font-extrabold px-1.5 items-center flex gap-1 border-r border-white/5 mr-0.5 pr-2">
              <Sparkles className="w-3.5 h-3.5 animate-pulse text-amber-400" /> Extract To:
            </span>
            {extractingLore ? (
              <span className="flex items-center gap-1 text-gray-400 px-2 font-black uppercase tracking-wider">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" /> Recording...
              </span>
            ) : (
              <>
                <button
                  onClick={() => handleQuickExtractCodex("character")}
                  className="px-2 py-1 bg-white/5 hover:bg-amber-500/20 hover:text-amber-300 rounded font-bold transition-all cursor-pointer"
                >
                  Character
                </button>
                <button
                  onClick={() => handleQuickExtractCodex("location")}
                  className="px-2 py-1 bg-white/5 hover:bg-amber-500/20 hover:text-amber-300 rounded font-bold transition-all cursor-pointer"
                >
                  Location
                </button>
                <button
                  onClick={() => handleQuickExtractCodex("clue")}
                  className="px-2 py-1 bg-white/5 hover:bg-amber-500/20 hover:text-amber-300 rounded font-bold transition-all cursor-pointer"
                >
                  Clue
                </button>
                <button
                  onClick={() => handleQuickExtractCodex("lore")}
                  className="px-2 py-1 bg-white/5 hover:bg-amber-500/20 hover:text-amber-300 rounded font-bold transition-all cursor-pointer"
                >
                  Lore
                </button>
                <div className="w-[1px] h-4 bg-white/10 mx-1" />
                <button
                  onClick={handleQuickExtractKeep}
                  className="px-2.5 py-1 bg-amber-500 text-slate-950 hover:bg-amber-600 rounded font-black transition-all cursor-pointer shadow-md"
                >
                  📌 Keep Sticky
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic Background Gradient */}
      <div
        style={{ opacity: settings.readerMode ? 0 : bgOpacity }}
        className={`fixed inset-0 pointer-events-none transition-opacity duration-1000 ${genre ? "opacity-100" : "opacity-0"}`}
      >
        <div
          className={`absolute inset-0 max-w-7xl mx-auto transition-all duration-1000 ${
            genre === "romance"
              ? "bg-[radial-gradient(circle_at_20%_30%,#fecdd3_0%,transparent_50%),radial-gradient(circle_at_80%_70%,#fda4af_0%,transparent_50%)] blur-[80px]"
              : genre === "crime"
                ? "bg-[radial-gradient(circle_at_20%_30%,#0f172a_0%,transparent_40%),radial-gradient(circle_at_80%_70%,#1e293b_0%,transparent_40%),radial-gradient(circle_at_50%_50%,#020617_0%,transparent_60%)] blur-[150px]"
                : "bg-[radial-gradient(circle_at_20%_30%,#581c87_0%,transparent_50%),radial-gradient(circle_at_80%_70%,#3b0764_0%,transparent_50%),radial-gradient(circle_at_50%_10%,#1e1b4b_0%,transparent_50%)] blur-[120px]"
          }`}
        />
      </div>

      {sharedEchoSnapshot && (
        <div className="sticky top-0 z-[120] w-full bg-amber-500 text-slate-950 px-4 py-2.5 flex justify-between items-center font-bold text-xs shrink-0 shadow-lg text-left">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 animate-pulse text-amber-950" />
            <span>You are reading a Shared Public Echo created by <strong className="uppercase font-extrabold text-amber-950">{sharedEchoSnapshot.creatorName}</strong> ({sharedEchoSnapshot.genre || "Mystery"} | Archetype: {sharedEchoSnapshot.characterArchetype || "unknown"})</span>
          </div>
          <button
            onClick={() => {
              setSharedEchoSnapshot(null);
              window.history.pushState({}, "", window.location.pathname);
            }}
            className="px-3 py-1 hover:bg-slate-900 hover:text-white rounded transition-colors text-[10px] font-black uppercase cursor-pointer"
          >
            Close Preview
          </button>
        </div>
      )}

      {/* HUD / Header */}
      <nav
        className={`fixed top-0 w-full z-50 p-6 border-b transition-all duration-700 ${
          genre === "romance"
            ? "bg-white/40 border-rose-100/50"
            : genre === "crime"
              ? "bg-black/40 border-white/5"
              : genre === "paranormal"
                ? "bg-black/20 border-purple-500/10"
                : "bg-transparent border-transparent"
        } backdrop-blur-xl flex justify-between items-center`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-xl transition-colors duration-700 ${
              genre === "romance"
                ? "bg-rose-50"
                : genre === "crime"
                  ? "bg-white/5 border border-white/5"
                  : genre === "paranormal"
                    ? "bg-purple-900/20 border border-purple-500/20"
                    : "bg-transparent"
            }`}
          >
            <Book
              className={`w-5 h-5 transition-colors duration-700 ${
                genre === "romance"
                  ? "text-rose-500"
                  : genre === "crime"
                    ? "text-sky-400"
                    : genre === "paranormal"
                      ? "text-purple-400"
                      : "text-gray-400"
              }`}
            />
          </div>
          <div className="flex flex-col">
            <span
              className={`text-xl font-black tracking-tighter transition-colors duration-700 ${genre === "romance" ? "text-rose-900" : "text-white"}`}
            >
              Echoes
            </span>
            <span className={`text-[8px] font-bold tracking-widest uppercase transition-colors duration-700 ${genre === "romance" ? "text-rose-700" : "text-amber-400"}`}>
              By To Be Read
            </span>
          </div>
          <span className="hidden sm:inline-block h-6 w-[1px] bg-white/10 mx-2" />
          <a
            href="https://to-be-read-clackamas.netlify.app/"
            target="_blank"
            rel="noopener noreferrer"
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1 hover:scale-102 rounded-full border border-amber-500/20 bg-amber-500/5 text-[10px] font-bold uppercase tracking-wider hover:bg-amber-500/10 hover:border-amber-500/40 transition-all font-sans cursor-pointer ${genre === "romance" ? "text-rose-800 border-rose-300 bg-rose-50 hover:bg-rose-100" : "text-amber-400"}`}
            title="Return to Clackamas Bookstore"
          >
            <span>Back to Bookstore</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        
        {/* Responsive Header Controls */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Desktop HUD Panel */}
          {user && (
            <div className="hidden md:flex items-center gap-2">
              {/* App Mode Switcher */}
              <div className="flex items-center gap-1 bg-white/5 border border-white/10 p-1 rounded-full mr-2">
                <button
                  onClick={() => {
                    setAppMode("player");
                    localStorage.setItem("appMode", "player");
                  }}
                  className={`px-3 py-1 text-[9px] font-black uppercase tracking-wider rounded-full transition-all flex items-center gap-1 cursor-pointer ${
                    appMode === "player"
                      ? "bg-sky-500 text-slate-950 font-bold shadow-md shadow-sky-500/20"
                      : "text-gray-400 hover:text-white"
                  }`}
                  title="Immersive Playing Mode"
                >
                  <Eye className="w-3 h-3" /> Play
                </button>
                <button
                  onClick={() => {
                    setAppMode("creator");
                    localStorage.setItem("appMode", "creator");
                  }}
                  className={`px-3 py-1 text-[9px] font-black uppercase tracking-wider rounded-full transition-all flex items-center gap-1 cursor-pointer ${
                    appMode === "creator"
                      ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
                      : "text-gray-400 hover:text-white"
                  }`}
                  title="Creative Writer Suite"
                >
                  <Sparkles className="w-3 h-3 text-amber-950" /> Writer
                </button>
              </div>

              {/* Creator Suite Tool Panel Toggle */}
              {appMode === "creator" && (
                <button
                  onClick={() => setShowCreatorPanel(!showCreatorPanel)}
                  className={`p-2 rounded-full transition-all relative ${
                    showCreatorPanel
                      ? "text-amber-400 bg-amber-500/20 border border-amber-500/30 shadow-[0_0_11px_rgba(245,158,11,0.3)]"
                      : "text-gray-400 hover:bg-white/5"
                  }`}
                  title="Configure Storyboard & Parameters"
                >
                  <Sliders className="w-4 h-4 text-amber-400" />
                  <span className="absolute -top-0.5 -right-0.5 flex h-1.5 w-1.5">
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400"></span>
                  </span>
                </button>
              )}

              <button
                onClick={() => setShowTutorial(true)}
                className={`p-2 rounded-full transition-colors ${
                  genre === "romance"
                    ? "text-rose-400 hover:bg-rose-50"
                    : "text-gray-400 hover:bg-white/5"
                }`}
                title="How to Play"
              >
                <Book className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  fetchUserStories(user.uid);
                  setShowLibrary(true);
                }}
                className={`p-2 rounded-full transition-colors ${
                  genre === "romance"
                    ? "text-rose-400 hover:bg-rose-50"
                    : "text-gray-400 hover:bg-white/5"
                }`}
                title="Story Library"
              >
                <LibraryIcon className="w-4 h-4" />
              </button>
              {currentStoryId && (
                <button
                  onClick={() => setShowKeepNotes(!showKeepNotes)}
                  className={`p-2 rounded-full transition-colors relative ${
                    showKeepNotes
                      ? "text-amber-400 bg-amber-500/20"
                      : genre === "romance"
                      ? "text-rose-400 hover:bg-rose-50"
                      : "text-gray-400 hover:bg-white/5"
                  }`}
                  title="Collaborative Keep Note Board"
                >
                  <Lightbulb className="w-4 h-4" />
                  <span className="absolute -top-0.5 -right-0.5 flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                  </span>
                </button>
              )}
              {currentStoryId && (
                <button
                  onClick={() => setShowCodex(!showCodex)}
                  className={`p-2 rounded-full transition-colors relative ${
                    showCodex
                      ? genre === "romance"
                        ? "text-rose-400 bg-rose-5050/20"
                        : genre === "crime"
                        ? "text-yellow-400 bg-yellow-500/20"
                        : "text-purple-400 bg-purple-500/20"
                      : genre === "romance"
                      ? "text-rose-400 hover:bg-rose-50"
                      : "text-gray-400 hover:bg-white/5"
                  }`}
                  title="Story Codex & Lore"
                >
                  <BookOpen className="w-4 h-4" />
                  <span className="absolute -top-0.5 -right-0.5 flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-70"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current"></span>
                  </span>
                </button>
              )}
              {currentStoryId && (
                <button
                  onClick={() => setShowBookmarks(!showBookmarks)}
                  className={`p-2 rounded-full transition-colors relative cursor-pointer ${
                    showBookmarks
                      ? "text-amber-400 bg-amber-500/20 border border-amber-500/30"
                      : genre === "romance"
                      ? "text-rose-400 hover:bg-rose-50"
                      : "text-gray-400 hover:bg-white/5"
                  }`}
                  title="Story Bookmarks"
                >
                  <Bookmark className="w-4 h-4" />
                  {bookmarks.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-1.5 w-1.5">
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                    </span>
                  )}
                </button>
              )}
              {currentStoryId && (
                <button
                  onClick={() => setSettings(s => ({ ...s, readerMode: !s.readerMode }))}
                  className={`p-2 rounded-full transition-all relative ${
                    settings.readerMode
                      ? "text-emerald-400 bg-emerald-500/20 shadow-sm"
                      : genre === "romance"
                      ? "text-rose-400 hover:bg-rose-50"
                      : "text-gray-400 hover:bg-white/5"
                  }`}
                  title={settings.readerMode ? "Switch to Scenic Mode" : "Switch to Distraction-Free Reader Mode"}
                >
                  <Book className="w-4 h-4" />
                  {settings.readerMode && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-1.5 w-1.5">
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                    </span>
                  )}
                </button>
              )}
              <button
                onClick={() => setShowSettings(true)}
                className={`p-2 rounded-full transition-colors ${
                  genre === "romance"
                    ? "text-rose-400 hover:bg-rose-50"
                    : "text-gray-400 hover:bg-white/5"
                }`}
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>

              {/* Premium Auto-Save Feedback UI Indicator */}
              {currentStoryId && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/5 text-[10px] font-medium transition-all duration-300">
                  {saveStatus === "saving" && (
                    <span className="flex items-center gap-1.5 text-amber-400">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span className="font-mono text-[9px] uppercase tracking-wider animate-pulse">Saving...</span>
                    </span>
                  )}
                  {saveStatus === "saved" && (
                    <span className="flex items-center gap-1.5 text-emerald-400 animate-bounce">
                      <Check className="w-3 h-3 text-emerald-400 animate-pulse" />
                      <span className="font-mono text-[9px] uppercase tracking-wider font-extrabold">Saved</span>
                    </span>
                  )}
                  {saveStatus === "error" && (
                    <span className="flex items-center gap-1.5 text-rose-400">
                      <X className="w-3 h-3 text-rose-400" />
                      <span className="font-mono text-[9px] uppercase tracking-wider font-extrabold">Sync Err</span>
                    </span>
                  )}
                  {saveStatus === "idle" && (
                    <span className="flex items-center gap-1.5 text-gray-500 hover:text-gray-300 transition-colors">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/50"></span>
                      <span className="font-mono text-[9px] uppercase tracking-wider">Sync Active</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Desktop Profiler Display */}
          {user && (
            <div className="hidden md:flex items-center gap-3 px-4 py-2 rounded-full bg-white/5 border border-white/5">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  className="w-6 h-6 rounded-full border border-white/10"
                  alt=""
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center">
                  <UserIcon className="w-3 h-3 text-gray-400" />
                </div>
              )}
              <span className="text-[10px] font-bold tracking-widest uppercase opacity-60 truncate max-w-[100px]">
                {user.displayName || user.email?.split("@")[0]}
              </span>
              <button
                onClick={logout}
                className="p-1 hover:text-rose-400 transition-colors"
                title="Logout"
              >
                <LogOut className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Ambient Soundtrack controls: accessible everywhere on any device hierarchy */}
          <button
            onClick={toggleMute}
            className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
              genre === "romance"
                ? "text-rose-400 hover:bg-rose-50"
                : genre === "paranormal"
                  ? "text-purple-400 hover:bg-purple-500/10"
                  : "text-gray-400 hover:bg-white/5"
            }`}
            title={
              settings.isMuted ? "Unmute Ambient Sound" : "Mute Ambient Sound"
            }
          >
            {settings.isMuted ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>

          {/* New Fate trigger for desktop viewports */}
          {genre && (
            <button
              onClick={resetGame}
              className={`hidden md:flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] transition-all px-4 py-2 rounded-full border ${
                genre === "romance"
                  ? "border-rose-100 text-rose-400 hover:bg-rose-50"
                  : genre === "paranormal"
                    ? "border-purple-500/20 text-purple-400 hover:bg-purple-500/10"
                    : "border-white/10 text-gray-500 hover:bg-white/5"
              }`}
            >
              <RefreshCcw className="w-3 h-3" />
              Start Fresh Timeline
            </button>
          )}

          {/* Mobile Hamburg Toggle Button - Generates massive overlay drawer for perfect touch ergonomics */}
          {user && (
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className={`flex md:hidden items-center justify-center w-10 h-10 rounded-xl transition-all border ${
                genre === "romance"
                  ? "border-rose-100 text-rose-500 bg-rose-50/50"
                  : genre === "paranormal"
                    ? "border-purple-500/20 text-purple-400 bg-purple-900/10"
                    : "border-white/10 text-white bg-white/5"
              }`}
              aria-label="Toggle Menu"
            >
              {showMobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          )}
        </div>
      </nav>

      {/* Full-Screen Immersive Mobile Navigation Overlay */}
      <AnimatePresence>
        {showMobileMenu && user && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            className={`fixed inset-x-0 top-[88px] bottom-0 z-[49] p-6 md:hidden backdrop-blur-3xl overflow-y-auto flex flex-col justify-between ${
              genre === "romance"
                ? "bg-white/95 text-rose-950 border-t border-rose-100/50"
                : genre === "crime"
                  ? "bg-black/95 text-white border-t border-white/5"
                  : genre === "paranormal"
                    ? "bg-[#0c0517]/95 text-purple-100 border-t border-purple-500/10"
                    : "bg-black/95 text-white border-t border-white/5"
            }`}
          >
            <div className="space-y-6">
              {/* Mobile Identity Card */}
              <div className={`p-4 rounded-3xl flex items-center gap-4 border ${
                genre === "romance" ? "bg-rose-50/50 border-rose-100" : "bg-white/5 border-white/5"
              }`}>
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    className="w-10 h-10 rounded-full border border-white/10"
                    alt=""
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center">
                    <UserIcon className="w-5 h-5 text-gray-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-mono tracking-widest uppercase opacity-40">Narrator</p>
                  <p className="text-sm font-bold truncate">
                    {user.displayName || user.email?.split("@")[0]}
                  </p>
                </div>
              </div>

              {/* Action Buttons list (Generous Touch Targets min-44px, usually 50px+) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowTutorial(true);
                    setShowMobileMenu(false);
                  }}
                  className={`w-full py-4 px-6 rounded-2xl flex items-center gap-4 font-bold text-xs uppercase tracking-wider text-left border ${
                    genre === "romance" ? "bg-rose-50/50 border-rose-100/70 hover:bg-rose-100/50" : "bg-white/5 border-white/10 hover:bg-white/10"
                  }`}
                >
                  <Book className="w-5 h-5 text-rose-400 shrink-0" />
                  <span>How to Play</span>
                </button>

                <button
                  onClick={() => {
                    fetchUserStories(user.uid);
                    setShowLibrary(true);
                    setShowMobileMenu(false);
                  }}
                  className={`w-full py-4 px-6 rounded-2xl flex items-center gap-4 font-bold text-xs uppercase tracking-wider text-left border ${
                    genre === "romance" ? "bg-rose-50/50 border-rose-100/70 hover:bg-rose-100/50" : "bg-white/5 border-white/10 hover:bg-white/10"
                  }`}
                >
                  <LibraryIcon className="w-5 h-5 text-sky-400 shrink-0" />
                  <span>Story Library</span>
                </button>

                {currentStoryId && (
                  <button
                    onClick={() => {
                      setShowKeepNotes(!showKeepNotes);
                      setShowMobileMenu(false);
                    }}
                    className={`w-full py-4 px-6 rounded-2xl flex items-center justify-between font-bold text-xs uppercase tracking-wider text-left border ${
                      showKeepNotes
                        ? "bg-amber-500/10 border-amber-400/50 text-amber-500 dark:text-amber-400"
                        : genre === "romance" ? "bg-rose-50/50 border-rose-100/70" : "bg-white/5 border-white/10"
                    }`}
                  >
                    <span className="flex items-center gap-4">
                      <Lightbulb className="w-5 h-5 text-amber-500 shrink-0" />
                      <span>Keep Board</span>
                    </span>
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                  </button>
                )}

                {currentStoryId && (
                  <button
                    onClick={() => {
                      setShowCodex(!showCodex);
                      setShowMobileMenu(false);
                    }}
                    className={`w-full py-4 px-6 rounded-2xl flex items-center justify-between font-bold text-xs uppercase tracking-wider text-left border ${
                      showCodex
                        ? "bg-purple-500/10 border-purple-400/50 text-purple-500 dark:text-purple-400"
                        : genre === "romance" ? "bg-rose-50/50 border-rose-100/70" : "bg-white/5 border-white/10"
                    }`}
                  >
                    <span className="flex items-center gap-4">
                      <BookOpen className="w-5 h-5 text-purple-400 shrink-0" />
                      <span>Codex & Lore</span>
                    </span>
                    <span className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
                  </button>
                )}

                {currentStoryId && (
                  <button
                    onClick={() => {
                      setShowBookmarks(!showBookmarks);
                      setShowMobileMenu(false);
                    }}
                    className={`w-full py-4 px-6 rounded-2xl flex items-center justify-between font-bold text-xs uppercase tracking-wider text-left border ${
                      showBookmarks
                        ? "bg-amber-500/10 border-amber-400/50 text-amber-500 dark:text-amber-400"
                        : genre === "romance" ? "bg-rose-50/50 border-rose-100/70" : "bg-white/5 border-white/10"
                    }`}
                  >
                    <span className="flex items-center gap-4">
                      <Bookmark className="w-5 h-5 text-amber-500 shrink-0" />
                      <span>Story Bookmarks</span>
                    </span>
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                  </button>
                )}

                <button
                  onClick={() => {
                    setShowSettings(true);
                    setShowMobileMenu(false);
                  }}
                  className={`w-full py-4 px-6 rounded-2xl flex items-center gap-4 font-bold text-xs uppercase tracking-wider text-left border ${
                    genre === "romance" ? "bg-rose-50/50 border-rose-100/70" : "bg-white/5 border-white/10"
                  }`}
                >
                  <Settings className="w-5 h-5 text-gray-400 shrink-0" />
                  <span>Settings</span>
                </button>

                {currentStoryId && (
                  <button
                    onClick={() => {
                      setSettings(s => ({ ...s, readerMode: !s.readerMode }));
                      setShowMobileMenu(false);
                    }}
                    className={`w-full py-4 px-6 rounded-2xl flex items-center justify-between font-bold text-xs uppercase tracking-wider text-left border ${
                      settings.readerMode
                        ? "bg-emerald-500/10 border-emerald-400/50 text-emerald-500 dark:text-emerald-400"
                        : genre === "romance" ? "bg-rose-50/50 border-rose-100/70" : "bg-white/5 border-white/10"
                    }`}
                  >
                    <span className="flex items-center gap-4">
                      <Book className="w-5 h-5 text-emerald-400 shrink-0" />
                      <span>Reader Mode</span>
                    </span>
                    <span className={`h-2 w-2 rounded-full ${settings.readerMode ? "bg-emerald-500" : "bg-gray-400 opacity-30"} animate-pulse`} />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-4 pt-6 mt-8 border-t border-neutral-200 dark:border-white/5">
              {genre && (
                <button
                  onClick={() => {
                    resetGame();
                    setShowMobileMenu(false);
                  }}
                  className={`w-full py-4 px-6 rounded-2xl flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-[0.2em] border ${
                    genre === "romance"
                      ? "border-rose-100 text-rose-500 bg-rose-50/30 hover:bg-rose-50"
                      : "border-white/10 text-white bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <RefreshCcw className="w-4 h-4 shrink-0" />
                  Start Fresh Timeline
                </button>
              )}

              <button
                onClick={() => {
                  logout();
                  setShowMobileMenu(false);
                }}
                className="w-full py-4 px-6 rounded-2xl flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-[0.2em] text-rose-500 bg-rose-500/5 hover:bg-rose-500/10 transition-colors"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                Logout
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="pt-32 pb-20 px-6 max-w-5xl mx-auto min-h-screen relative z-10 flex flex-col">
        <AnimatePresence mode="wait">
          {sharedEchoSnapshot ? (
            <motion.div
              key="shared_echo_view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-12 max-w-2xl mx-auto w-full text-left"
            >
              <div className="space-y-4 text-center">
                <span className="bg-amber-500/10 text-amber-300 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-amber-500/20">
                  Shared Storyboard
                </span>
                <h1 className="text-4xl font-serif text-white tracking-tight">
                  {sharedEchoSnapshot.characterArchetype ? `The Destiny of the ${sharedEchoSnapshot.characterArchetype}` : "A Shared Fate"}
                </h1>
                <p className="text-xs text-gray-400">
                  Woven by <strong className="text-gray-200">{sharedEchoSnapshot.creatorName}</strong> on {new Date(sharedEchoSnapshot.createdAt).toLocaleDateString()}
                </p>
                <div className="h-px bg-white/10 w-24 mx-auto" />
              </div>

              <div className="space-y-10">
                {sharedEchoSnapshot.stepsSnapshot?.map((step: any, idx: number) => (
                  <div key={idx} className="space-y-4 p-8 rounded-[2rem] border border-white/5 bg-slate-900/40 backdrop-blur-md">
                    <div className="flex justify-between items-center pb-2 border-b border-white/5">
                      <span className="text-[10px] uppercase font-black tracking-widest text-[#B5BAC9]">
                        Scene {idx + 1}: {step.sceneTitle}
                      </span>
                    </div>

                    {step.imageUrl && (
                      <div className="relative aspect-[16/9] w-full rounded-2xl overflow-hidden border border-white/10">
                        <img
                          src={step.imageUrl}
                          alt="Atmospheric Scene Visual"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    <p className="text-[#DEE2E6] text-sm leading-relaxed whitespace-pre-line font-serif">
                      {step.sceneDescription}
                    </p>

                    {step.choiceTaken && (
                      <div className="p-4 rounded-xl border border-amber-500/10 bg-amber-500/5 mt-4">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block mb-1">Choice Taken:</span>
                        <p className="text-amber-200 text-xs font-semibold">{step.choiceTaken}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="p-8 rounded-[2rem] border border-white/5 bg-[#0b1019] text-center space-y-4">
                <h3 className="text-lg font-serif text-white font-medium">Weave Your Own Choices</h3>
                <p className="text-xs text-[#9FA4B6] max-w-sm mx-auto">Sign in to start your own dynamic AI story and explore alternative realities in multiple genres!</p>
                <button
                  onClick={() => {
                    setSharedEchoSnapshot(null);
                    window.history.pushState({}, "", window.location.pathname);
                  }}
                  className="px-6 py-2.5 bg-amber-500 text-slate-950 rounded-full font-black text-xs uppercase tracking-wider hover:bg-amber-600 transition-all cursor-pointer inline-block"
                >
                  Create My Story
                </button>
              </div>
            </motion.div>
          ) : authLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex items-center justify-center"
            >
              <Loader2 className="w-12 h-12 animate-spin opacity-10" />
            </motion.div>
          ) : !user ? (
            <motion.div
              key="login"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="flex-1 flex flex-col justify-center items-center text-center gap-10"
            >
              <div className="w-20 h-20 bg-gradient-to-tr from-white/10 to-white/5 rounded-3xl flex items-center justify-center shadow-2xl relative overflow-hidden group border border-white/10 backdrop-blur-md">
                <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <Sparkles className="w-8 h-8 text-white/70" />
              </div>
              <div className="space-y-6">
                <h2 className="text-5xl font-serif font-medium tracking-tight text-white leading-none">
                  Welcome to <br />
                  <span className="italic text-amber-400 font-serif">TBR Storyboard</span>
                </h2>
                <p className="text-white/40 max-w-sm mx-auto font-light tracking-wide text-sm leading-relaxed">
                  Step in to weave your fate through choice-driven narrative timelines.
                  A creative companion suite of To Be Read (TBR) Clackamas Book Exchange.
                </p>
              </div>
              <div className="flex flex-col items-center gap-6">
                <button
                  onClick={login}
                  className="flex items-center gap-3 bg-white text-black px-10 py-4 rounded-full font-medium uppercase tracking-[0.2em] shadow-xl shadow-white/5 hover:scale-[1.02] active:scale-[0.98] transition-all text-xs cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  Login with Google
                </button>
                <div className="pt-6 border-t border-white/5 w-full flex flex-col items-center gap-1">
                  <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">A Scholarly Companion Project</span>
                  <a
                    href="https://to-be-read-clackamas.netlify.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-amber-500/70 hover:text-amber-400 font-bold transition-all hover:underline cursor-pointer"
                  >
                    <span>Visit Clackamas Bookstore</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm max-w-sm mt-4">
                  {error}
                </div>
              )}
            </motion.div>
          ) : loading && !genre ? (
            <motion.div
              key="loading-story"
              initial={{ opacity: 0, filter: "blur(10px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, filter: "blur(10px)" }}
              className="flex-1 flex flex-col items-center justify-center gap-8 py-32"
            >
              <Loader2 className="w-12 h-12 animate-spin text-white/50" />
              <p className="text-[10px] font-black uppercase tracking-widest opacity-40">
                Retrieving Narrative Timeline...
              </p>
            </motion.div>
          ) : !genre ? (
            <motion.div
              key="genres"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 flex flex-col justify-center items-center text-center gap-16 min-h-[70vh] relative overflow-visible"
            >
              {/* Introduction Title Section with Calibrated Animators and Active Particles Backdrop */}
              <div className="relative w-full max-w-4xl mx-auto py-12 px-6 rounded-[3rem] overflow-visible border border-white/5 bg-white/[0.01] backdrop-blur-[2px]">
                {/* Immersive Particle Canopy */}
                <Suspense fallback={null}>
                  <IntroductionParticles activeGenre={hoveredGenre} reducedMotion={settings.reducedMotion} />
                </Suspense>

                {/* Content Elements on Top */}
                <div className="relative z-10 space-y-6">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="inline-block px-5 py-2 rounded-full border border-white/10 text-[10px] font-medium uppercase tracking-[0.4em] text-white/50 backdrop-blur-sm"
                  >
                    Interactive AI Narrative
                  </motion.div>

                  {/* Gently revealing title */}
                  <motion.h1 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1.25, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
                    className="text-6xl md:text-8xl font-serif font-medium tracking-tight text-white leading-none"
                  >
                    Orchestrate <br />
                    <span className="italic text-white/70 animate-pulse duration-[6s]">
                      Your Narrative
                    </span>
                  </motion.h1>

                  {/* Soft staggered description fade-in */}
                  <motion.p 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1.0, ease: "easeOut", delay: 0.55 }}
                    className="text-white/40 max-w-xl mx-auto text-base sm:text-lg leading-relaxed font-light tracking-wide"
                  >
                    An elegant exploration of branching fates, woven in real-time
                    by artificial intelligence.
                  </motion.p>
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm w-full max-w-xl mx-auto flex items-center justify-between z-10">
                  <span>{error}</span>
                  <button onClick={() => setError(null)} className="text-white bg-red-500/20 hover:bg-red-500/40 px-3 py-1 rounded-full text-xs transition-colors">
                     Dismiss
                  </button>
                </div>
              )}

              {/* Genre Choice Grid cards containing hovering sensor updates */}
              <div className="flex flex-col md:flex-row gap-6 w-full max-w-5xl z-10">
                {/* romance genre card */}
                <button
                  onClick={() => startStory("romance")}
                  onMouseEnter={() => setHoveredGenre("romance")}
                  onMouseLeave={() => setHoveredGenre(null)}
                  className="group relative flex-1 aspect-[10/13] bg-[#FCF8F8] border border-rose-100/50 rounded-3xl overflow-hidden shadow-2xl hover:shadow-rose-100 transition-all duration-700 transform hover:-translate-y-2 flex flex-col justify-end p-10 text-left"
                >
                  <img
                    src="/src/assets/images/genre_romance_card_1779164930713.png"
                    className="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:opacity-60 group-hover:scale-105 transition-all duration-[1.5s] ease-out pointer-events-none mix-blend-multiply"
                    alt="Romance"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#FCF8F8] via-[#FCF8F8]/60 to-transparent opacity-100" />
                  <div className="relative z-10 transition-transform duration-700 group-hover:-translate-y-2">
                    <h2 className="text-3xl font-serif italic text-rose-950 leading-tight mb-2">
                      Rose & Rapture
                    </h2>
                    <p className="text-rose-900/60 text-xs font-light tracking-wide leading-relaxed">
                      A delicate interplay of yearning and emotional truth.
                    </p>
                  </div>
                </button>

                {/* crime genre card */}
                <button
                  onClick={() => startStory("crime")}
                  onMouseEnter={() => setHoveredGenre("crime")}
                  onMouseLeave={() => setHoveredGenre(null)}
                  className="group relative flex-1 aspect-[10/13] bg-[#0A0C10] border border-white/5 rounded-3xl overflow-hidden shadow-2xl hover:shadow-white/5 transition-all duration-700 transform hover:-translate-y-2 flex flex-col justify-end p-10 text-left"
                >
                  <img
                    src="/src/assets/images/genre_crime_card_1779164947927.png"
                    className="absolute inset-0 w-full h-full object-cover opacity-20 group-hover:opacity-40 group-hover:scale-105 transition-all duration-[1.5s] ease-out pointer-events-none grayscale"
                    alt="Crime"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0A0C10] via-[#0A0C10]/80 to-transparent opacity-100" />
                  <div className="relative z-10 text-white transition-transform duration-700 group-hover:-translate-y-2">
                    <h2 className="text-2xl font-mono uppercase tracking-[0.1em] text-white leading-tight mb-3">
                      Shadows & Sin
                    </h2>
                    <p className="text-white/40 text-[11px] font-mono tracking-widest uppercase leading-relaxed">
                      Grit, mystery, and the pursuit of truth.
                    </p>
                  </div>
                </button>

                {/* paranormal genre card */}
                <button
                  onClick={() => startStory("paranormal")}
                  onMouseEnter={() => setHoveredGenre("paranormal")}
                  onMouseLeave={() => setHoveredGenre(null)}
                  className="group relative flex-1 aspect-[10/13] bg-[#0D0A14] border border-purple-500/10 rounded-3xl overflow-hidden shadow-2xl hover:shadow-purple-900/30 transition-all duration-700 transform hover:-translate-y-2 flex flex-col justify-end p-10 text-left"
                >
                  <img
                    src="/src/assets/images/genre_paranormal_card_1779164962472.png"
                    className="absolute inset-0 w-full h-full object-cover opacity-20 group-hover:opacity-50 group-hover:scale-105 transition-all duration-[1.5s] ease-out pointer-events-none"
                    alt="Paranormal"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0D0A14] via-[#0D0A14]/80 to-transparent opacity-100" />
                  <div className="relative z-10 text-purple-100 transition-transform duration-700 group-hover:-translate-y-2">
                    <h2 className="text-3xl font-serif italic tracking-wide text-white leading-tight mb-3">
                      Veiled Realms
                    </h2>
                    <p className="text-purple-300/50 text-xs font-light tracking-wide leading-relaxed">
                      Ethereal mysteries where the supernatural collides with the
                      mundane.
                    </p>
                  </div>
                </button>
              </div>
            </motion.div>
          ) : showParameterSetup && loading ? (
            <motion.div
              key="generating-story"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              className="flex-1 flex flex-col justify-center items-center max-w-lg mx-auto w-full gap-8 py-16 text-center"
            >
              <div className={`w-full p-10 rounded-[3rem] border space-y-8 shadow-2xl backdrop-blur-md relative overflow-hidden ${cardBase}`}>
                
                {/* Visual Accent Gradient Core */}
                <div className={`absolute -top-16 -left-16 w-36 h-36 rounded-full blur-[80px] opacity-20 bg-${accent}-400`} />
                <div className={`absolute -bottom-16 -right-16 w-36 h-36 rounded-full blur-[80px] opacity-20 bg-${accent}-400`} />
                
                <div className="flex flex-col items-center gap-6">
                  {/* Outer breathing ring */}
                  <div className="relative flex items-center justify-center">
                    <motion.div
                      animate={{
                        scale: [1, 1.15, 1],
                        opacity: [0.15, 0.35, 0.15],
                      }}
                      transition={{
                        repeat: Infinity,
                        duration: 2.5,
                        ease: "easeInOut",
                      }}
                      className={`absolute inset-0 rounded-full blur-xl bg-${accent}-500/30`}
                    />
                    <div className="relative w-20 h-20 rounded-[2rem] flex items-center justify-center border bg-white/5 border-white/5">
                      {genre === "romance" ? (
                        <Heart className="w-8 h-8 text-rose-400 animate-pulse" />
                      ) : genre === "paranormal" ? (
                        <Sparkles className="w-8 h-8 text-purple-400 animate-pulse" />
                      ) : (
                        <Skull className="w-8 h-8 text-sky-400 animate-pulse" />
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className={`text-3xl font-serif tracking-tight ${genre === "romance" ? "text-rose-950 italic" : "text-white"}`}>
                      {genre === "romance"
                        ? "Weaving Your Romance"
                        : genre === "paranormal"
                          ? "Manifesting Occult Realms"
                          : "Assembling Clues"}
                    </h3>
                    <p className="text-xs opacity-50 font-sans max-w-xs mx-auto">
                      Preparing a customized interactive timeline and rich world simulation...
                    </p>
                  </div>
                </div>

                {/* Status Bar */}
                <div className="space-y-4 pt-4">
                  <div className="flex items-center justify-between text-[10px] font-mono tracking-wider opacity-40">
                    <span className="uppercase">Quantum Threading</span>
                    <span className="animate-pulse">Active</span>
                  </div>
                  {/* Custom progress rail */}
                  <div className="h-1 bg-black/10 dark:bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: "5%" }}
                      animate={{ width: "95%" }}
                      transition={{ duration: 15, ease: "easeOut" }}
                      className={`h-full bg-gradient-to-r ${
                        genre === "romance"
                          ? "from-rose-400 to-rose-600"
                          : genre === "paranormal"
                            ? "from-purple-500 to-indigo-600"
                            : "from-sky-500 to-blue-600"
                      }`}
                    />
                  </div>
                </div>

                {/* Configuration Specs Box */}
                <div className="p-5 rounded-2xl border border-black/5 dark:border-white/5 bg-black/5 dark:bg-white/5 text-left space-y-3 font-mono text-[10px]">
                  <div className="flex justify-between items-center">
                    <span className="opacity-40 uppercase tracking-widest">Selected Fate</span>
                    <span className={`font-bold uppercase tracking-wider ${genre === "romance" ? "text-rose-500" : genre === "paranormal" ? "text-purple-400" : "text-sky-400"}`}>{genre}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="opacity-40 uppercase tracking-widest">Character Archetype</span>
                    <span className="text-amber-500 font-bold max-w-[180px] truncate" title={storyParameters.archetype}>{storyParameters.archetype}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="opacity-40 uppercase tracking-widest">Narrative Depth</span>
                    <span className="opacity-80 capitalize">{storyParameters.complexity}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="opacity-40 uppercase tracking-widest">Melodic Tone</span>
                    <span className="opacity-80 capitalize">{storyParameters.tone}</span>
                  </div>
                  {storyParameters.isAdultContent && (
                    <div className="flex justify-between items-center">
                      <span className="text-rose-400/60 uppercase tracking-widest">Creative Limit</span>
                      <span className="text-rose-500 font-bold uppercase tracking-widest">18+ Mature Themes</span>
                    </div>
                  )}
                </div>

                {/* Immersive breathing system updates */}
                <div className="text-[10px] font-mono text-center tracking-wider h-4 overflow-hidden">
                  <motion.p
                    initial={{ y: 15, opacity: 0 }}
                    animate={{ y: [15, 0, 0, -15], opacity: [0, 1, 1, 0] }}
                    transition={{
                      repeat: Infinity,
                      repeatDelay: 1,
                      duration: 4,
                      ease: "easeInOut",
                    }}
                    className={`italic ${genre === "romance" ? "text-rose-900/60" : "text-white/40"}`}
                  >
                    {genre === "romance"
                      ? "Igniting character chemistry parameters..."
                      : genre === "paranormal"
                        ? "Aligning spirit frequencies and occult boundaries..."
                        : "Compiling crime logs and atmospheric noir aesthetics..."}
                  </motion.p>
                </div>

              </div>
              <p className="text-[9px] font-mono opacity-30 uppercase tracking-[0.3em]">
                Do not close this chamber. Your narrative is forming.
              </p>
            </motion.div>
          ) : showParameterSetup ? (
            <motion.div
              key="params"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className={`flex-1 flex flex-col justify-center items-center max-w-2xl mx-auto w-full gap-8`}
            >
              <div
                className={`w-full p-10 rounded-[3rem] border space-y-10 transition-all duration-700 ${cardBase}`}
              >
                <div className="text-center space-y-4">
                  <h2
                    className={`text-4xl font-black uppercase tracking-tight ${genre === "romance" ? "text-rose-950 font-serif italic" : genre === "paranormal" ? "text-purple-100 font-serif" : "text-white"}`}
                  >
                    Define Your Fate
                  </h2>
                  <p
                    className={`text-[10px] uppercase font-black tracking-[0.4em] opacity-30 ${genre === "romance" ? "text-rose-900" : "text-white"}`}
                  >
                    The tapestry of your journey
                  </p>
                </div>

                <div className="flex justify-center border-b border-opacity-10 font-mono text-[10px] sm:text-xs uppercase tracking-widest gap-4 sm:gap-8">
                  <button
                    onClick={() => setPremiseMode("custom")}
                    className={`pb-2 transition-all ${premiseMode === "custom" ? "border-b-2 font-bold opacity-100 " + (genre === "romance" ? "border-rose-500 text-rose-900" : "border-white text-white") : "opacity-40 hover:opacity-70"}`}
                  >
                    Write Your Own
                  </button>
                  <button
                    onClick={() => setPremiseMode("premade")}
                    className={`pb-2 transition-all ${premiseMode === "premade" ? "border-b-2 font-bold opacity-100 " + (genre === "romance" ? "border-rose-500 text-rose-900" : "border-white text-white") : "opacity-40 hover:opacity-70"}`}
                  >
                    Premade
                  </button>
                  <button
                    onClick={() => {
                      setPremiseMode("ai");
                      if (aiPremises.length === 0 && genre) {
                        generateAIPremises();
                      }
                    }}
                    className={`pb-2 transition-all flex items-center gap-2 ${premiseMode === "ai" ? "border-b-2 font-bold opacity-100 " + (genre === "romance" ? "border-rose-500 text-rose-900" : "border-white text-white") : "opacity-40 hover:opacity-70"}`}
                  >
                    <Sparkles className="w-3 h-3" /> AI Generated
                  </button>
                </div>

                {premiseMode === "premade" &&
                  genre &&
                  PREMADE_PREMISES[genre as string] && (
                    <div className="space-y-4">
                      {PREMADE_PREMISES[genre as string].map((prem) => (
                        <button
                          key={prem.title}
                          onClick={() => applyPremise(prem)}
                          className={`w-full text-left p-6 rounded-2xl border transition-all ${
                            storyParameters.archetype === prem.archetype &&
                            storyParameters.backstory === prem.backstory
                              ? genre === "romance"
                                ? "border-rose-500 bg-rose-50"
                                : "border-sky-500 bg-sky-900/20"
                              : genre === "romance"
                                ? "border-rose-100 bg-transparent hover:bg-rose-50/50 text-rose-900"
                                : "border-white/10 bg-transparent hover:bg-white/5 text-white"
                          }`}
                        >
                          <h4 className="font-bold text-lg mb-2">
                            {prem.title}
                          </h4>
                          <p className="text-xs opacity-70 mb-1">
                            <strong>Archetype:</strong> {prem.archetype}
                          </p>
                          <p className="text-xs opacity-70 mb-1">
                            <strong>Backstory:</strong> {prem.backstory}
                          </p>
                          <p className="text-xs opacity-70 italic">
                            "{prem.customBasis}"
                          </p>
                        </button>
                      ))}
                    </div>
                  )}

                {premiseMode === "ai" && (
                  <div className="space-y-4">
                    {generatingPremises ? (
                      <div className="py-12 flex flex-col items-center justify-center space-y-4 opacity-50">
                        <Loader2 className="w-8 h-8 animate-spin" />
                        <p className="text-xs font-mono uppercase tracking-widest">
                          Conjuring premises from the ether...
                        </p>
                      </div>
                    ) : (
                      <>
                        {aiPremises.map((prem) => (
                          <button
                            key={prem.title}
                            onClick={() => applyPremise(prem)}
                            className={`w-full text-left p-6 rounded-2xl border transition-all ${
                              storyParameters.archetype === prem.archetype &&
                              storyParameters.backstory === prem.backstory
                                ? genre === "romance"
                                  ? "border-rose-500 bg-rose-50"
                                  : "border-sky-500 bg-sky-900/20"
                                : genre === "romance"
                                  ? "border-rose-100 bg-transparent hover:bg-rose-50/50 text-rose-900"
                                  : "border-white/10 bg-transparent hover:bg-white/5 text-white"
                            }`}
                          >
                            <h4 className="font-bold text-lg mb-2">
                              {prem.title}
                            </h4>
                            <p className="text-xs opacity-70 mb-1">
                              <strong>Archetype:</strong> {prem.archetype}
                            </p>
                            <p className="text-xs opacity-70 mb-1">
                              <strong>Backstory:</strong> {prem.backstory}
                            </p>
                            <p className="text-xs opacity-70 italic">
                              "{prem.customBasis}"
                            </p>
                          </button>
                        ))}
                        <div className="flex justify-center mt-4">
                          <button
                            onClick={() => generateAIPremises(true)}
                            className={`px-4 py-2 border rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-all ${genre === "romance" ? "border-rose-200 text-rose-800 hover:bg-rose-100" : "border-white/20 text-white hover:bg-white/10"}`}
                          >
                            <RefreshCcw className="w-3 h-3" /> Retry Generation
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {premiseMode === "custom" && (
                  <>
                    <div className="space-y-4">
                      <label className="text-[10px] uppercase font-black tracking-widest opacity-40">
                        Character Archetype
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. A disgraced detective seeking redemption..."
                        value={storyParameters.archetype}
                        onChange={(e) =>
                          setStoryParameters((p) => ({
                            ...p,
                            archetype: e.target.value,
                          }))
                        }
                        className={`w-full p-4 rounded-2xl border bg-transparent transition-all outline-none focus:ring-2 ${
                          genre === "romance"
                            ? "border-rose-100 focus:border-rose-300 focus:ring-rose-100 text-rose-900 placeholder:text-rose-200"
                            : "border-white/10 focus:border-sky-400 focus:ring-sky-500/20 text-white placeholder:text-white/20"
                        }`}
                      />
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] uppercase font-black tracking-widest opacity-40">
                        Backstory & Ambition (Character Building)
                      </label>
                      <textarea
                        placeholder="What haunts them? What do they desire most? (e.g. They lost their sister to the sea and seek the truth at any cost...)"
                        value={storyParameters.backstory}
                        onChange={(e) =>
                          setStoryParameters((p) => ({
                            ...p,
                            backstory: e.target.value,
                          }))
                        }
                        rows={3}
                        className={`w-full p-4 rounded-2xl border bg-transparent transition-all outline-none focus:ring-2 resize-none ${
                          genre === "romance"
                            ? "border-rose-100 focus:border-rose-300 focus:ring-rose-100 text-rose-900 placeholder:text-rose-200"
                            : "border-white/10 focus:border-sky-400 focus:ring-sky-500/20 text-white placeholder:text-white/20"
                        }`}
                      />
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] uppercase font-black tracking-widest opacity-40">
                        Custom Narrative Foundation (Optional Basis)
                      </label>
                      <textarea
                        placeholder="Set the initial scene or premise... (e.g. On a rainy night in Neo-Tokyo, a mysterious courier delivers a package...)"
                        value={storyParameters.customBasis}
                        onChange={(e) =>
                          setStoryParameters((p) => ({
                            ...p,
                            customBasis: e.target.value,
                          }))
                        }
                        rows={4}
                        className={`w-full p-4 rounded-2xl border bg-transparent transition-all outline-none focus:ring-2 resize-none ${
                          genre === "romance"
                            ? "border-rose-100 focus:border-rose-300 focus:ring-rose-100 text-rose-900 placeholder:text-rose-200"
                            : "border-white/10 focus:border-sky-400 focus:ring-sky-500/20 text-white placeholder:text-white/20"
                        }`}
                      />
                    </div>
                  </>
                )}

                <div className="space-y-4">
                  <label className="text-[10px] uppercase font-black tracking-widest opacity-40">
                    Narrative Tone (AI Logic Style)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["subtle", "intense", "experimental"] as StoryTone[]).map(
                      (t) => (
                        <button
                          key={t}
                          onClick={() =>
                            setStoryParameters((p) => ({ ...p, tone: t }))
                          }
                          className={`p-3 text-center rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all ${
                            storyParameters.tone === t
                              ? genre === "romance"
                                ? "bg-rose-500 border-rose-500 text-white"
                                : "bg-sky-500 border-sky-500 text-white"
                              : genre === "romance"
                                ? "border-rose-100 text-rose-300 hover:bg-rose-50"
                                : "border-white/10 text-white/40 hover:bg-white/5"
                          }`}
                        >
                          {t}
                        </button>
                      ),
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label className="text-[10px] uppercase font-black tracking-widest opacity-40">
                      Story Depth (Length)
                    </label>
                    <div className="flex flex-col gap-2">
                      {(["short", "medium", "epic"] as StoryLength[]).map(
                        (l) => (
                          <button
                            key={l}
                            onClick={() =>
                              setStoryParameters((p) => ({ ...p, length: l }))
                            }
                            className={`p-3 text-left rounded-xl border text-xs font-bold uppercase tracking-widest transition-all ${
                              storyParameters.length === l
                                ? genre === "romance"
                                  ? "bg-rose-500 border-rose-500 text-white"
                                  : "bg-sky-500 border-sky-500 text-white"
                                : genre === "romance"
                                  ? "border-rose-100 text-rose-300 hover:bg-rose-50"
                                  : "border-white/10 text-white/40 hover:bg-white/5"
                            }`}
                          >
                            {l}
                          </button>
                        ),
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] uppercase font-black tracking-widest opacity-40">
                      Plot Complexity
                    </label>
                    <div className="flex flex-col gap-2">
                      {(
                        ["simple", "complex", "layered"] as PlotComplexity[]
                      ).map((c) => (
                        <button
                          key={c}
                          onClick={() =>
                            setStoryParameters((p) => ({ ...p, complexity: c }))
                          }
                          className={`p-3 text-left rounded-xl border text-xs font-bold uppercase tracking-widest transition-all ${
                            storyParameters.complexity === c
                              ? genre === "romance"
                                ? "bg-rose-500 border-rose-500 text-white"
                                : "bg-sky-500 border-sky-500 text-white"
                              : genre === "romance"
                                ? "border-rose-100 text-rose-300 hover:bg-rose-50"
                                : "border-white/10 text-white/40 hover:bg-white/5"
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {error && (
                  <p className="text-red-500 text-[10px] font-bold uppercase text-center">
                    {error}
                  </p>
                )}

                <div className="flex items-center justify-between p-6 rounded-[1.5rem] border transition-all bg-white/5 border-white/5">
                  <div className="space-y-1">
                    <p className="text-xs font-black uppercase tracking-widest">
                      Adult Themes (18+)
                    </p>
                    <p className="text-[10px] opacity-40">
                      Enable more explicit, raw, and high-intensity adult
                      content.
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setStoryParameters((p) => ({
                        ...p,
                        isAdultContent: !p.isAdultContent,
                      }))
                    }
                    className={`w-14 h-8 rounded-full relative transition-all duration-300 ${
                      storyParameters.isAdultContent
                        ? "bg-rose-500"
                        : "bg-white/10"
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-lg transition-all duration-300 ${
                        storyParameters.isAdultContent ? "left-7" : "left-1"
                      }`}
                    />
                  </button>
                </div>

                <button
                  onClick={confirmStartStory}
                  className={`w-full py-5 rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 ${buttonPrimary}`}
                >
                  <Zap className="w-5 h-5" />
                  Begin Narrative
                </button>

                <button
                  onClick={() => setGenre(null)}
                  className={`w-full py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${buttonSecondary}`}
                >
                  Change Genre
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="main-story"
              className="flex-1 flex flex-col relative"
              ref={contentRef}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              <AnimatePresence mode="wait">
                {(!currentNode && !loading && genre) ? (
                  <motion.div
                    key="resuming"
                    initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
                    animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
                    transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
                    className="flex-1 flex flex-col items-center justify-center gap-8 py-32"
                  >
                    <Loader2
                      className={`w-12 h-12 animate-spin ${genre === "romance" ? "text-rose-200" : "text-sky-900"}`}
                    />
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-40">
                      Resuming Narrative...
                    </p>
                  </motion.div>
                ) : (loading && !currentNode) ? (
                  <motion.div
                    key="loading-node"
                    initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
                    animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
                    transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
                    className="flex-1 flex flex-col items-center justify-center gap-8 py-32"
                  >
                    <div
                      className={`w-20 h-20 rounded-[2rem] flex items-center justify-center border-2 ${
                        genre === "romance"
                          ? "border-rose-100"
                          : "border-white/10"
                      }`}
                    >
                      <Sparkles
                        className={`w-8 h-8 ${genre === "romance" ? "text-rose-400" : "text-sky-400"}`}
                      />
                    </div>
                    <div className="text-center space-y-2">
                      <h3 className="font-black text-2xl tracking-tight uppercase">
                        Spinning Reality
                      </h3>
                      <p className="text-sm opacity-40 font-mono tracking-widest uppercase">
                        The universe is listening...
                      </p>
                    </div>
                  </motion.div>
                ) : (error && !currentNode) ? (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
                    animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
                    transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
                    className="bg-red-500/10 border border-red-500/20 p-6 rounded-3xl text-red-500 text-sm mb-12 flex items-center justify-between"
                  >
                    <span>{error}</span>
                    <button
                      onClick={() => setError(null)}
                      className="font-black uppercase tracking-widest text-[10px] bg-red-500 text-white px-4 py-2 rounded-full"
                    >
                      Dismiss
                    </button>
                  </motion.div>
                ) : currentNode ? (
                  <motion.div
                    key={currentNode.sceneTitle || allSteps.length}
                    initial={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
                    animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
                    transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
                    className="flex flex-col gap-12 pb-32"
                  >
                    {error && (
                      <div className="bg-red-500/10 border border-red-500/20 p-5 rounded-3xl text-red-500 text-xs flex items-center justify-between shadow-xl backdrop-blur-md">
                        <span>{error}</span>
                        <button
                          onClick={() => setError(null)}
                          className="font-black uppercase tracking-widest text-[8px] bg-red-500 text-white px-3.5 py-1.5 rounded-full hover:bg-red-600 transition"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                    {/* Scene Visual Container */}
                    {!settings.readerMode && (
                      <motion.div
                        initial={{ scale: 0.98, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={`p-1 rounded-[2.5rem] ${cardBase} transition-all ${
                          settings.reducedMotion
                            ? "duration-300 ease-linear"
                            : "duration-500 delay-200 ease-linear"
                        } ${isSceneFadingOut ? "opacity-0 scale-95" : "opacity-100 scale-100"}`}
                      >
                      <div className="relative group">
                        <div
                          className={`absolute inset-0 blur-3xl opacity-20 -z-10 group-hover:opacity-40 transition-opacity duration-1000 ${
                            genre === "romance"
                              ? "bg-rose-400"
                              : genre === "paranormal"
                                ? "bg-purple-600"
                                : "bg-sky-900"
                          }`}
                        />
                        <div
                          className={`relative w-full aspect-video md:aspect-[21/9] rounded-[2.5rem] overflow-hidden flex items-center justify-center shadow-2xl border transition-all duration-700 ${
                            genre === "romance"
                              ? "bg-rose-50 border-rose-100/50"
                              : genre === "paranormal"
                                ? "bg-[#1a1025] border-purple-500/10"
                                : "bg-black border-white/5"
                          }`}
                        >
                          {currentNode.mediaType === "video" &&
                          currentNode.videoUrl &&
                          currentNode.videoUrl !== "local-blob-session" ? (
                            <video
                              key={currentNode.videoUrl}
                              src={currentNode.videoUrl}
                              className="w-full h-full object-cover"
                              autoPlay
                              loop
                              muted
                              playsInline
                            />
                          ) : imageLoading || videoStatus.status !== "idle" ? (
                            <div className="flex flex-col items-center gap-8 w-full max-w-sm px-6">
                              <div className="relative">
                                <Loader2
                                  className={`w-20 h-20 animate-spin ${
                                    genre === "romance"
                                      ? "text-rose-200"
                                      : genre === "paranormal"
                                        ? "text-purple-400"
                                        : "text-sky-400"
                                  }`}
                                />
                                <Sparkles
                                  className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 animate-pulse ${
                                    genre === "romance"
                                      ? "text-rose-400"
                                      : "text-white"
                                  }`}
                                />
                              </div>

                              <div className="w-full space-y-4">
                                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                  <div
                                    style={{ width: `${generationProgress}%` }}
                                    className={`h-full ${
                                      genre === "romance"
                                        ? "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]"
                                        : "bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.5)]"
                                    }`}
                                  />
                                </div>

                                <div className="text-center space-y-1">
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="text-[10px] uppercase font-black tracking-[0.2em] opacity-40">
                                      {videoStatus.status !== "idle"
                                        ? `Cinematic ${videoStatus.status}`
                                        : "Neural Rendering"}
                                    </span>
                                    <span className="text-[10px] font-mono font-bold opacity-60">
                                      {Math.round(generationProgress)}%
                                    </span>
                                  </div>
                                  <span className="block text-[8px] uppercase font-mono tracking-widest opacity-20 italic">
                                    {videoStatus.status !== "idle"
                                      ? "This takes longer to weave high-fidelity motion..."
                                      : "Drawing from the deep Universe Sea..."}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ) : currentNode.imageUrl && !currentNode.imageGenFailed ? (
                            <EnhancedImageContainer
                              imageUrl={currentNode.imageUrl}
                              genre={genre}
                              mood={currentNode.mood}
                              showImages={settings.showImages}
                              alt="Scene Visual"
                            />
                          ) : (
                            <ImageFallbackContainer
                              genre={genre}
                              sceneTitle={currentNode.sceneTitle}
                              imagePrompt={currentNode.imagePrompt || currentNode.sceneDescription}
                              onRetry={() => {
                                generateImage(
                                  currentNode.imagePrompt || currentNode.sceneDescription,
                                  currentNode.mood,
                                  currentStoryId,
                                );
                              }}
                            />
                          )}

                          {currentNode && (
                            <Suspense fallback={null}>
                              <EffectsOverlay
                                genre={genre}
                                intensity={currentNode.intensity}
                                isEnding={currentNode.isEnding}
                              />
                            </Suspense>
                          )}

                          <div className="absolute top-8 left-8 flex gap-3">
                            <div
                              className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] backdrop-blur-xl border flex items-center gap-2 ${
                                genre === "romance"
                                  ? "bg-white/60 border-rose-100 text-rose-900"
                                  : genre === "paranormal"
                                    ? "bg-purple-900/60 border-purple-500/20 text-purple-200"
                                    : "bg-black/60 border-white/10 text-white"
                              }`}
                            >
                              <div
                                className={`w-1.5 h-1.5 rounded-full animate-pulse ${genre === "romance" ? "bg-rose-500" : "bg-purple-400"}`}
                              />
                              {currentNode.mediaType === "video"
                                ? "Cinematic Flow"
                                : "Neural Canvas"}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                    )}

                    {/* Content Layout */}
                    <div className={settings.readerMode ? "max-w-2xl mx-auto w-full space-y-12" : "grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-16 lg:gap-24"}>
                      {/* Left Column: Story */}
                      <div
                        className={`space-y-10 transition-all ${
                          settings.reducedMotion || settings.readerMode
                            ? "duration-300 ease-linear"
                            : "duration-500 ease-linear"
                        } ${isSceneFadingOut ? "opacity-0" : "opacity-100"}`}
                      >
                        <div className="space-y-6">
                          <div className="flex items-center gap-4">
                            <span
                              className={`h-[1px] flex-1 ${genre === "romance" ? "bg-rose-100" : genre === "paranormal" ? "bg-purple-900/30" : "bg-white/5"}`}
                            />
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[10px] uppercase tracking-[0.4em] font-black px-3 py-1 rounded-full ${
                                  genre === "romance"
                                    ? "text-rose-400 bg-rose-50"
                                    : genre === "paranormal"
                                      ? "text-purple-400 bg-purple-900/20"
                                      : "text-gray-500 bg-white/5"
                                }`}
                              >
                                Entry {history.length + 1}
                              </span>
                              {currentNode && (
                                <button
                                  onClick={handleToggleCurrentBookmark}
                                  className={`p-1.5 rounded-full border transition-all cursor-pointer ${
                                    bookmarks.some((b: any) => b.stepIndex === allSteps.length - 1)
                                      ? "bg-amber-500/20 border-amber-500/40 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.3)] scale-110"
                                      : "bg-white/5 border-white/10 text-gray-500 hover:text-gray-300"
                                  }`}
                                  title={bookmarks.some((b: any) => b.stepIndex === allSteps.length - 1) ? "Remove Bookmark" : "Bookmark this Scene"}
                                >
                                  <Bookmark className={`w-3.5 h-3.5 ${bookmarks.some((b: any) => b.stepIndex === allSteps.length - 1) ? "fill-amber-400 text-amber-400" : ""}`} />
                                </button>
                              )}
                            </div>
                          </div>
                          <h2
                            className={`text-5xl md:text-8xl leading-[0.85] transition-all duration-1000 ${headingFont} ${
                              genre === "romance"
                                ? "text-rose-950 font-black"
                                : genre === "paranormal"
                                  ? "text-white drop-shadow-[0_0_30px_rgba(168,85,247,0.2)]"
                                  : "text-white drop-shadow-[0_0_20px_rgba(56,189,248,0.2)]"
                            }`}
                          >
                            {currentNode.sceneTitle}
                          </h2>
                        </div>

                         <div
                          id="story-content"
                          className={`prose max-w-none transition-all duration-700 hyphens-auto whitespace-pre-wrap ${bodyFont} ${fontSizeClass} ${lineSpacingClass} ${textAlignClass} ${fontWeightClass} ${letterSpacingClass} ${
                            settings.textGlow
                              ? genre === "romance"
                                ? "drop-shadow-[0_1px_4px_rgba(159,18,57,0.15)]"
                                : genre === "paranormal"
                                  ? "drop-shadow-[0_0_15px_rgba(168,85,247,0.35)]"
                                  : "drop-shadow-[0_0_10px_rgba(56,189,248,0.35)]"
                              : ""
                          } ${
                            genre === "romance"
                              ? "text-rose-900/80"
                              : genre === "paranormal"
                                ? "text-purple-200/70"
                                : genre === "crime"
                                  ? "text-zinc-400"
                                  : "text-gray-400"
                          }`}
                        >
                          {typewriterText}
                          {settings.typewriter && !typewriterComplete && (
                            <span className="inline-block w-1 h-4 ml-1 bg-current animate-pulse align-middle" />
                          )}
                        </div>

                        {currentNode && (
                          <div className="pt-6 border-t border-current/5">
                            <VoiceNarratorPanel
                              currentNode={currentNode}
                              genre={genre}
                              relationships={relationships}
                              settings={settings}
                              setSettings={setSettings}
                            />
                          </div>
                        )}
                      </div>

                      {/* Right Column: Choices */}
                      <div className={settings.readerMode ? "w-full pt-6" : "relative"}>
                        <div
                          className={settings.readerMode ? "space-y-6 text-left border-t border-black/5 dark:border-white/5 pt-10 animate-fadeIn" : `sticky top-32 space-y-8 p-10 rounded-[2.5rem] border transition-all duration-700 ${
                            genre === "romance"
                              ? "bg-white border-rose-100/50 shadow-xl shadow-rose-200/20"
                              : genre === "paranormal"
                                ? "bg-black/40 border-purple-500/10 backdrop-blur-md shadow-2xl shadow-purple-900/20"
                                : "bg-zinc-900/50 border-white/5 backdrop-blur-md"
                          }`}
                        >
                          <h4
                            className={`text-[10px] uppercase tracking-[0.3em] font-black ${settings.readerMode ? "mb-4" : "mb-8"} ${
                              genre === "romance"
                                ? "text-rose-400"
                                : genre === "paranormal"
                                  ? "text-purple-400"
                                  : "text-gray-500"
                            }`}
                          >
                            Path selection
                          </h4>

                          {!loading ? (
                            <div className="flex flex-col gap-4">
                              {currentNode.isEnding ? (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className={`p-8 border rounded-[3rem] text-center space-y-8 ${cardBase}`}
                                >
                                  <div className="space-y-2">
                                    <h2 className={`text-4xl ${headingFont}`}>
                                      {currentNode.endingType || "The End"}
                                    </h2>
                                    <p className="text-[10px] uppercase font-black tracking-widest opacity-40">
                                      Your Fate is Sealed
                                    </p>
                                  </div>

                                  {storyMilestones.length > 0 && (
                                    <div className="space-y-4">
                                      <h3 className="text-xs uppercase font-black tracking-widest opacity-60">
                                        Path Taken
                                      </h3>
                                      <div className="flex flex-col gap-2">
                                        {storyMilestones.map((milestone, i) => (
                                          <div
                                            key={i}
                                            className={`p-3 rounded-xl border text-xs font-bold font-mono ${
                                              genre === "romance"
                                                ? "border-rose-100 bg-rose-50 text-rose-900"
                                                : "border-white/10 bg-white/5 text-white/80"
                                            }`}
                                          >
                                            ◦ {milestone.replace(/_/g, " ")}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {Object.keys(consequences).length > 0 && (
                                    <div className="space-y-4">
                                      <h3 className="text-xs uppercase font-black tracking-widest opacity-60">
                                        Echoes of Fate
                                      </h3>
                                      <div className="flex flex-col gap-2">
                                        {Object.entries(consequences).map(([key, desc], i) => (
                                          <div
                                            key={i}
                                            className={`p-3 rounded-xl border text-xs font-bold font-mono ${
                                              genre === "romance"
                                                ? "border-rose-100 bg-rose-50 text-rose-900"
                                                : "border-white/10 bg-white/5 text-white/80"
                                            }`}
                                          >
                                            ◦ {desc}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  <button
                                    onClick={resetGame}
                                    className={`px-8 py-4 rounded-2xl w-full text-xs uppercase font-black tracking-widest transition-all ${buttonPrimary}`}
                                  >
                                    Begin Anew
                                  </button>
                                </motion.div>
                              ) : (
                                <>
                                  <AnimatePresence>
                                    {allSteps.length > 1 && (
                                      <motion.button
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        onClick={goBack}
                                        className={`group w-full p-4 rounded-2xl border transition-all text-left flex items-center gap-4 ${buttonSecondary} mb-2 overflow-hidden`}
                                      >
                                        <div
                                          className={`p-2 rounded-lg ${genre === "romance" ? "bg-rose-50 text-rose-500" : genre === "paranormal" ? "bg-purple-900/40 text-purple-400" : "bg-white/5 text-sky-400"}`}
                                        >
                                          <ArrowLeft className="w-4 h-4" />
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-widest">
                                          Step Back in Time
                                        </span>
                                      </motion.button>
                                    )}
                                  </AnimatePresence>

                                  {/* Fate Simulation Core Dashboard */}
                                  <div className="p-5 rounded-3xl bg-white/[0.02] border border-white/5 shadow-2xl space-y-4 text-left">
                                    <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-gray-400">
                                      <span className="flex items-center gap-1.5 font-bold text-amber-500">
                                        <Sparkles className="w-3.5 h-3.5 animate-pulse" /> Simulation Engine
                                      </span>
                                      <span className="text-[9px] text-gray-500 font-bold">
                                        Balance: <span className="text-amber-400 font-extrabold">{settings.fateTokens !== undefined ? settings.fateTokens : 3840} FATE</span>
                                      </span>
                                    </div>

                                    {/* Mode Switches */}
                                    <div className="grid grid-cols-3 gap-2">
                                      {(["light", "standard", "deep"] as const).map((mode) => (
                                        <button
                                          key={mode}
                                          disabled={loading}
                                          onClick={() => {
                                            setSettings((s) => ({ ...s, simulationMode: mode }));
                                          }}
                                          className={`py-2 px-1 rounded-xl border text-[8px] uppercase tracking-widest font-black transition-all cursor-pointer text-center ${
                                            settings.simulationMode === mode
                                              ? "bg-amber-500/10 border-amber-500/30 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.05)]"
                                              : "bg-white/[0.01] border-white/5 text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]"
                                          }`}
                                        >
                                          {mode}
                                        </button>
                                      ))}
                                    </div>

                                    {/* Complexity and Cost Gauge */}
                                    <div className="pt-3 border-t border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-left">
                                      <div className="flex-1 space-y-1.5">
                                        <div className="flex justify-between items-center text-[8px] uppercase font-mono tracking-wider opacity-60">
                                          <span>⚡ Timeline Complexity</span>
                                          <span className="font-bold text-amber-400">{currentNode?.echoes?.fateComplexityScore || 35}%</span>
                                        </div>
                                        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                          <div 
                                            className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-rose-500 transition-all duration-1000" 
                                            style={{ width: `${currentNode?.echoes?.fateComplexityScore || 35}%` }}
                                          />
                                        </div>
                                      </div>

                                      <div className="flex items-center justify-between md:justify-end gap-3 shrink-0">
                                        <span className="text-[9px] uppercase font-mono text-gray-400 font-bold">
                                          Cost: <span className="text-rose-400">-{settings.simulationMode === "light" ? 10 : settings.simulationMode === "deep" ? 60 : 30}</span>
                                        </span>
                                        
                                        <button
                                          onClick={() => {
                                            setSettings((s) => ({ ...s, fateTokens: (s.fateTokens !== undefined ? s.fateTokens : 3840) + 2000 }));
                                          }}
                                          className="px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[8px] uppercase tracking-wider font-extrabold transition-all cursor-pointer border border-emerald-500/20"
                                        >
                                          +2k Balance
                                        </button>
                                      </div>
                                    </div>

                                    {/* Temporal branches control board */}
                                    <div className="pt-3 border-t border-white/5 space-y-2">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[9px] uppercase font-mono tracking-wider text-gray-400 flex items-center gap-1">
                                          <GitBranch className="w-3.5 h-3.5 text-purple-400" /> Temporal What-If Forking
                                        </span>
                                        
                                        <button
                                          onClick={toggleWhatIfMode}
                                          className={`relative w-8 h-4 rounded-full transition-colors cursor-pointer ${isWhatIfMode ? "bg-purple-500" : "bg-white/10"}`}
                                        >
                                          <div 
                                            className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${isWhatIfMode ? "left-4.5" : "left-0.5"}`}
                                          />
                                        </button>
                                      </div>

                                      {isWhatIfMode && (
                                        <motion.div
                                          initial={{ opacity: 0, y: -5 }}
                                          animate={{ opacity: 1, y: 0 }}
                                          className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 space-y-3"
                                        >
                                          <p className="text-[9px] leading-relaxed text-purple-200">
                                            ⚠️ Alt Reality Virtualization engaged! Future milestones, relationship changes, and steps are simulation prototypes and will NOT rewrite your prime save file unless you fuse the branch explicitly.
                                          </p>
                                          <div className="grid grid-cols-2 gap-2 pt-1 font-mono">
                                            <button
                                              onClick={commitWhatIfTimeline}
                                              className="py-1.5 px-3 rounded-xl bg-purple-500/30 hover:bg-purple-500/40 text-purple-200 text-[8px] uppercase tracking-wider font-black transition-all cursor-pointer border border-purple-500/30 text-center"
                                            >
                                              Fuse to Prime
                                            </button>
                                            <button
                                              onClick={snapBackTimeline}
                                              className="py-1.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-[8px] uppercase tracking-wide font-black transition-all cursor-pointer border border-white/5 text-center"
                                            >
                                              Collapse Loop
                                            </button>
                                          </div>
                                        </motion.div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Contextual Coach Mark */}
                                  {allSteps.length >= 2 && !localStorage.getItem("coach_mark_grimoire_dismissed") && (
                                    <motion.div
                                      initial={{ opacity: 0, y: -10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 to-amber-600/15 border border-amber-500/30 text-xs text-amber-200 space-y-2 relative"
                                    >
                                      <button
                                        onClick={() => {
                                          localStorage.setItem("coach_mark_grimoire_dismissed", "true");
                                          // Trigger generic re-render trigger
                                          setChoicePreviews(prev => ({ ...prev })); 
                                        }}
                                        className="absolute top-2.5 right-2.5 text-amber-400 hover:text-white transition-colors"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                      <div className="flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                                        <span className="font-extrabold uppercase text-[9px] tracking-widest text-amber-300">AUTHORSHIP IGNITED</span>
                                      </div>
                                      <p className="text-[11px] leading-relaxed opacity-90 font-serif">
                                        Your choices are shaping the **Grimoire** in real time! Access the Grimoire from the top bar to inspect discovered files, items, character alignments, and timeline branches.
                                      </p>
                                    </motion.div>
                                  )}

                                  <div className="space-y-4">
                                    {currentNode.choices?.map((choice, idx) => {
                                      const flickerClass = settings.reducedMotion || settings.readerMode
                                        ? ""
                                        : genre === "romance"
                                          ? "animate-flicker-soft"
                                          : genre === "paranormal"
                                            ? "animate-flicker-occult"
                                            : "animate-flicker-neon";

                                      return (
                                        <div key={idx} className="space-y-2">
                                          <motion.div
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter" || e.key === " ") {
                                                e.preventDefault();
                                                handleChoice(choice);
                                              }
                                            }}
                                            onMouseEnter={() => {
                                              if (!settings.reducedMotion) {
                                                setChoicePreviews((prev) => ({ ...prev, [idx]: true }));
                                              }
                                            }}
                                            onMouseLeave={() => {
                                              if (!settings.reducedMotion) {
                                                setChoicePreviews((prev) => ({ ...prev, [idx]: false }));
                                              }
                                            }}
                                            initial={settings.reducedMotion ? { opacity: 0, y: 5 } : { opacity: 0, y: -25, filter: "brightness(0.4) blur(1px)" }}
                                            whileInView={settings.reducedMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: 0, filter: "brightness(1) blur(0px)" }}
                                            viewport={{ once: true }}
                                            transition={{
                                              duration: 0.6,
                                              delay: 0.25 + idx * 0.12,
                                              ease: "easeOut"
                                            }}
                                            onClick={() => handleChoice(choice)}
                                            className={`group relative text-left transition-all duration-300 transform active:scale-[0.98] w-full cursor-pointer ${
                                              settings.readerMode
                                                ? "p-4 border border-black/5 dark:border-white/10 rounded-2xl bg-black/5 dark:bg-white/5"
                                                : `p-6 border rounded-3xl ${cardBase}`
                                            } ${flickerClass} hover:border-${accent}-500/50 flex flex-col justify-between`}
                                          >
                                            <div className="flex items-start gap-4 w-full">
                                              <div
                                                className={`mt-1.5 w-1.5 h-1.5 rounded-full transition-all duration-500 group-hover:scale-150 ${
                                                  genre === "romance"
                                                    ? "bg-rose-300 group-hover:bg-rose-500"
                                                    : genre === "paranormal"
                                                      ? "bg-purple-600 group-hover:bg-purple-400"
                                                      : "bg-sky-900 group-hover:bg-sky-400"
                                                }`}
                                              />
                                              <span
                                                className={`flex-1 font-bold leading-tight ${genre === "romance" ? "text-rose-950 text-base" : "text-white text-sm font-sans"}`}
                                              >
                                                {choice.text}
                                              </span>
                                            </div>

                                            {/* Preview Toggle Row */}
                                            <div 
                                              className="mt-3 flex items-center justify-between border-t border-white/5 pt-2 w-full text-[10px]" 
                                              onClick={(e) => { e.stopPropagation(); }}
                                            >
                                              <span className="text-[10px] text-gray-500 font-medium">Sense the Ripples</span>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setChoicePreviews(prev => ({ ...prev, [idx]: !prev[idx] }));
                                                }}
                                                className={`px-2.5 py-1 rounded transition-all font-black uppercase flex items-center gap-1 border cursor-pointer ${
                                                  choicePreviews[idx]
                                                    ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                                                    : "bg-white/5 border-white/5 text-gray-400 hover:text-white"
                                                }`}
                                              >
                                                <Eye className="w-3.5 h-3.5" /> {choicePreviews[idx] ? "Muffle Echo" : "Sense Ripples"}
                                              </button>
                                            </div>

                                            {/* Preview details */}
                                            <AnimatePresence>
                                              {choicePreviews[idx] && (
                                                <motion.div
                                                  initial={{ opacity: 0, height: 0 }}
                                                  animate={{ opacity: 1, height: "auto" }}
                                                  exit={{ opacity: 0, height: 0 }}
                                                  className="mt-3.5 border-t border-white/5 pt-3 space-y-2 text-left w-full overflow-hidden"
                                                >
                                                  <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-amber-500/10 text-[11px] leading-relaxed font-serif space-y-3.5 text-gray-300">
                                                    <div>
                                                      <span className="font-black text-[9px] text-amber-400 block tracking-widest uppercase mb-1">⚡ SHORT-TERM EFFECT</span>
                                                      <p className="opacity-95 text-gray-200 font-sans text-xs leading-relaxed">{choice.nextContext || "Immediate outcome takes shape based on this decision."}</p>
                                                    </div>
                                                    <div className="pt-2.5 border-t border-white/5">
                                                      <span className="font-black text-[9px] text-sky-400 block tracking-widest uppercase mb-1">🌊 LONG-TERM RIPPLE</span>
                                                      <p className="opacity-70 font-mono text-[9.5px] leading-relaxed">This decision locks in story pathways, shifting Entity Resonance meters and timelines in your chronological Grimoire tree irreversibly.</p>
                                                    </div>
                                                  </div>

                                                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                                    {(/trust|affinity|ally|relationship|companion|friend|love|kiss|bond/i.test(choice.nextContext || "") || /trust|affinity|ally/i.test(choice.text)) && (
                                                      <span className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[8.5px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md flex items-center gap-1">
                                                        ▲ Relational Affinity
                                                      </span>
                                                    )}
                                                    {(/suspic|hide|secret|lie|accuse|crime|spy|detective/i.test(choice.nextContext || "") || /suspic|hide|secret/i.test(choice.text)) && (
                                                      <span className="bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[8.5px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md flex items-center gap-1">
                                                        ▼ Suspicion Change
                                                      </span>
                                                    )}
                                                    {(/artifact|clue|lore|discover|learn|uncover|history|legend|book|truth/i.test(choice.nextContext || "") || /history|legend|artifact/i.test(choice.text)) && (
                                                      <span className="bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[8.5px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md flex items-center gap-1">
                                                        🔮 Adds Lore Cards
                                                      </span>
                                                    )}
                                                    {(/fight|confront|danger|escape|run|danger|peril|combat|warn/i.test(choice.nextContext || "") || /run|escape/i.test(choice.text)) && (
                                                      <span className="bg-red-500/10 border border-red-500/20 text-red-300 text-[8.5px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md flex items-center gap-1">
                                                        ⚠️ Perilous Path
                                                      </span>
                                                    )}
                                                  </div>
                                                </motion.div>
                                              )}
                                            </AnimatePresence>
                                          </motion.div>
                                        </div>
                                      );
                                    })}

                                    {/* Surprise Me / Let Fate Decide Option */}
                                    {currentNode.choices && currentNode.choices.length > 0 && (
                                      <motion.div
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault();
                                            const randomIndex = Math.floor(Math.random() * (currentNode.choices?.length || 1));
                                            handleChoice(currentNode.choices![randomIndex]);
                                          }
                                        }}
                                        initial={{ opacity: 0, scale: 0.98 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: 0.9 }}
                                        onClick={() => {
                                          const randomIndex = Math.floor(Math.random() * (currentNode.choices?.length || 1));
                                          handleChoice(currentNode.choices![randomIndex]);
                                        }}
                                        className="relative group text-left transition-all duration-300 transform active:scale-[0.98] w-full cursor-pointer p-5 rounded-3xl border border-dashed border-amber-500/25 bg-amber-500/[0.03] hover:bg-amber-500/[0.08] hover:border-amber-500/40 flex items-center justify-between"
                                      >
                                        <div className="flex items-center gap-3.5">
                                          <div className="p-2 bg-amber-500/10 text-amber-300 rounded-xl group-hover:rotate-12 transition-transform">
                                            <Sparkles className="w-4 h-4" />
                                          </div>
                                          <div>
                                            <span className="font-extrabold text-xs uppercase tracking-widest text-amber-200">Surprise Me (Let Fate Decide)</span>
                                            <p className="text-[10px] text-gray-500 font-mono mt-0.5">Accept destiny and select one of the core options at random.</p>
                                          </div>
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-amber-300 transform group-hover:translate-x-1 transition-transform" />
                                      </motion.div>
                                    )}

                                    {/* Temporal Whispers / Micro-actions */}
                                    <div className="pt-4 border-t border-white/5 mt-2 space-y-3">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wider">Temporal Introspection</span>
                                        <span className="text-[9px] text-amber-400 font-mono">Cognitive Aids</span>
                                      </div>
                                      <div className="grid grid-cols-3 gap-2">
                                        <button
                                          onClick={() => {
                                            setActiveMicroAction("context");
                                            setMicroActionText("Temporal Echoes: Your senses examine the local space. This path holds strong traces of prior journeys. Check active Codex cards and item attachments logged in the Grimoire before proceeding.");
                                          }}
                                          className={`px-3 py-2.5 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-wider transition-all border text-center cursor-pointer ${
                                            activeMicroAction === "context"
                                              ? "bg-amber-500/10 text-amber-300 border-amber-500/35 shadow-sm"
                                              : "bg-white/5 border-white/5 text-gray-400 hover:text-white"
                                          }`}
                                        >
                                          🔎 Ask Context
                                        </button>
                                        <button
                                          onClick={() => {
                                            setActiveMicroAction("memory");
                                            setMicroActionText(`Origin Compass: Deep in your memory as a ${storyParameters.archetype || "pioneer"}, your roots guide your path. Keep your backstory ("${storyParameters.backstory || "origin story undefined"}") as your ultimate goal.`);
                                          }}
                                          className={`px-3 py-2.5 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-wider transition-all border text-center cursor-pointer ${
                                            activeMicroAction === "memory"
                                              ? "bg-amber-500/10 text-amber-300 border-amber-500/35 shadow-sm"
                                              : "bg-white/5 border-white/5 text-gray-400 hover:text-white"
                                          }`}
                                        >
                                          📜 Consult Memory
                                        </button>
                                        <button
                                          onClick={() => {
                                            setActiveMicroAction("motives");
                                            setMicroActionText("Entity Discernment: You analyze behavior markers. Pay close attention to surrounding players and targets; aligning with or betraying their trust will shift affinity levels immediately.");
                                          }}
                                          className={`px-3 py-2.5 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-wider transition-all border text-center cursor-pointer ${
                                            activeMicroAction === "motives"
                                              ? "bg-amber-500/10 text-amber-300 border-amber-500/35 shadow-sm"
                                              : "bg-white/5 border-white/5 text-gray-400 hover:text-white"
                                          }`}
                                        >
                                          👥 Study Motives
                                        </button>
                                      </div>

                                      <AnimatePresence>
                                        {microActionText && (
                                          <motion.div
                                            initial={{ opacity: 0, y: -5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -5 }}
                                            className="p-3.5 rounded-2xl bg-zinc-900 border border-amber-500/20 text-[10.5px] leading-relaxed text-gray-300 relative font-serif"
                                          >
                                            <button
                                              onClick={() => {
                                                setMicroActionText(null);
                                                setActiveMicroAction(null);
                                              }}
                                              className="absolute top-2.5 right-2.5 text-gray-500 hover:text-white cursor-pointer"
                                            >
                                              <X className="w-3.5 h-3.5" />
                                            </button>
                                            <span className="font-sans font-black uppercase text-[8px] tracking-widest text-amber-400 block mb-1">
                                              {activeMicroAction === "context" && "🔎 Temporal Clue Revealed"}
                                              {activeMicroAction === "memory" && "📜 Backstory Compass"}
                                              {activeMicroAction === "motives" && "👥 Alignment Warning"}
                                            </span>
                                            {microActionText}
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </div>
                                  </div>

                                  <div className="pt-6 border-t border-white/5 mt-4 space-y-4">
                                    <label className="text-[10px] uppercase font-black tracking-widest opacity-40">
                                      Your Freeform Action
                                    </label>
                                    <div className="relative">
                                      <textarea
                                        value={customActionText}
                                        onChange={(e) =>
                                          setCustomActionText(e.target.value)
                                        }
                                        placeholder="Describe your own action..."
                                        className={`w-full p-4 pr-12 rounded-2xl border bg-transparent transition-all outline-none focus:ring-2 resize-none text-[11px] font-medium ${
                                          genre === "romance"
                                            ? "border-rose-100 focus:border-rose-300 text-rose-900 placeholder:text-rose-200"
                                            : "border-white/10 focus:border-sky-400 text-white placeholder:text-white/20"
                                        }`}
                                        rows={2}
                                      />
                                      <button
                                        onClick={() => {
                                          if (customActionText.trim()) {
                                            handleChoice({
                                              text: customActionText,
                                              nextContext:
                                                "user-defined-action",
                                            });
                                            setCustomActionText("");
                                          }
                                        }}
                                        disabled={
                                          !customActionText.trim() || loading
                                        }
                                        className={`absolute right-3 bottom-3 p-2 rounded-xl transition-all ${
                                          customActionText.trim()
                                            ? genre === "romance"
                                              ? "bg-rose-500 text-white"
                                              : "bg-sky-500 text-white"
                                            : "bg-white/5 text-white/20 opacity-50 cursor-not-allowed"
                                        }`}
                                      >
                                        <Zap className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                </>
                              )}

                              {/* Relationships Panel */}
                              {Object.keys(relationships).length > 0 && (
                                <div className="pt-6 border-t border-white/5 mt-4 space-y-4">
                                  <h3 className="text-[10px] uppercase font-black tracking-widest opacity-40 mb-3 flex items-center justify-between">
                                    Entity Resonance
                                    <Users className="w-3 h-3" />
                                  </h3>
                                  <div className="space-y-4">
                                    {Object.entries(relationships).map(
                                      ([name, scores]) => (
                                        <RelationshipMeter
                                          key={name}
                                          name={name}
                                          affinity={scores.affinity}
                                          suspicion={scores.suspicion}
                                          genre={genre}
                                        />
                                      ),
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <AtmosphericFateLoader genre={genre} />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Branching Narrative System Visual Tree Tracker */}
                    {allSteps.length > 0 && (
                      <BranchingTimeline
                        allSteps={allSteps}
                        currentStoryId={currentStoryId}
                        genre={genre}
                        onBranchToStep={branchToStep}
                        relationships={relationships}
                        consequences={consequences}
                        storyMilestones={storyMilestones}
                      />
                    )}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* History Sidebar - Optional toggle */}
      {history.length > 0 && genre && (
        <div className="fixed bottom-6 right-6 z-50">
          <button
            onClick={() => setShowHistory(true)}
            className={`p-4 rounded-full shadow-2xl backdrop-blur-xl border transition-transform hover:scale-110 ${
              genre === "romance"
                ? "bg-white/80 border-rose-100 text-rose-500"
                : "bg-black/80 border-white/10 text-gray-400"
            }`}
          >
            <History className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* History Modal Overlay */}
      {showHistory && (
        <>
          <div
            onClick={() => setShowHistory(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          />
          <div
            className={`fixed top-0 right-0 h-full w-full max-w-md z-[101] shadow-2xl border-l flex flex-col ${
              genre === "romance"
                ? "bg-[#FDF6F6] border-rose-100 text-[#4A2B2B]"
                : "bg-[#0F1115] border-white/10 text-[#D1D5DB]"
            }`}
          >
            <div className="p-8 border-b border-inherit flex justify-between items-center">
              <div className="flex items-center gap-3">
                <History className="w-5 h-5 opacity-60" />
                <h3 className="font-black text-xl tracking-tight uppercase">
                  Journey Log
                </h3>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="p-2 hover:bg-black/5 rounded-full transition-colors"
              >
                <X
                  className={`w-5 h-5 ${genre === "paranormal" ? "text-purple-400" : ""}`}
                />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
              {history.length === 0 ? (
                <div className="text-center opacity-40 mt-12 italic">
                  Your story is just beginning...
                </div>
              ) : (
                history.map((item, idx) => (
                  <div key={idx} className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                          genre === "romance"
                            ? "bg-rose-100 text-rose-500"
                            : genre === "paranormal"
                              ? "bg-purple-900/40 text-purple-400"
                              : "bg-zinc-800 text-gray-400"
                        }`}
                      >
                        {idx + 1}
                      </div>
                      <div className="h-px flex-1 bg-current opacity-10" />
                    </div>
                    <div className="opacity-60 text-sm leading-relaxed italic">
                      "...{item.sceneDescription?.slice(0, 150)}..."
                    </div>
                    <div
                      className={`p-4 rounded-xl font-bold border ${
                        genre === "romance"
                          ? "bg-white border-rose-100"
                          : genre === "paranormal"
                            ? "bg-black/40 border-purple-500/10"
                            : "bg-zinc-900 border-white/5"
                      }`}
                    >
                      You chose:{" "}
                      <span
                        className={`${genre === "romance" ? "text-rose-500" : genre === "paranormal" ? "text-purple-400" : "text-sky-400"} underline decoration-current/30 underline-offset-4`}
                      >
                        {item.choiceTaken}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* Creator Suite Controller Panel Overlay */}
      {showCreatorPanel && appMode === "creator" && (
        <>
          <div
            onClick={() => setShowCreatorPanel(false)}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[92]"
          />
          <div
            className="fixed top-0 right-0 h-full w-full max-w-lg z-[93] shadow-2xl border-l flex flex-col bg-slate-950 border-amber-500/10 text-gray-200"
          >
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#070b12]">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
                <div>
                  <h3 className="font-extrabold text-[#ECEEF2] text-sm tracking-widest uppercase">
                    Creator Suite & Storyboard
                  </h3>
                  <p className="text-[9px] text-amber-500/80 font-black tracking-widest uppercase">Creative Professional Deck</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreatorPanel(false)}
                className="p-2 hover:bg-white/5 rounded-full transition-colors text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selector Tabs */}
            <div className="flex border-b border-white/5 bg-[#0b1019] p-1 gap-1">
              {(["outline", "grimoire", "parameters", "ripples", "collab", "export"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setCreatorTab(tab)}
                  className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded transition-all cursor-pointer ${
                    creatorTab === tab
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-[#050811]">
              
              {/* TAB: OUTLINE */}
              {creatorTab === "outline" && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-2">
                    <h4 className="text-xs font-bold text-amber-400 uppercase tracking-widest">Story Map & Branch Planner</h4>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      Below is the linear sequence of traversed realities in this active branch. Click any step to rewind, branch, or plot an alternative path.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {allSteps.length === 0 ? (
                      <div className="text-center italic opacity-40 py-8 text-xs">No compiled story steps found. Start a fate to populate.</div>
                    ) : (
                      allSteps.map((step, idx) => (
                        <div
                          key={idx}
                          role="button"
                          onClick={() => {
                            if (confirm(`Are you sure you want to rewind and branch back to Scene ${idx + 1}? Subsequent steps will become an alternative unexplored reality.`)) {
                              branchToStep(idx);
                            }
                          }}
                          className={`p-4 rounded-xl border bg-slate-900/60 hover:border-amber-500/30 hover:bg-slate-950/80 transition-all text-left flex items-start gap-4 group cursor-pointer ${step.isAlternativeBranch ? "border-purple-500/25 shadow-[inset_0_0_10px_rgba(168,85,247,0.05)]" : "border-white/5"}`}
                        >
                          <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-mono font-bold shrink-0 ${step.isAlternativeBranch ? "bg-purple-500/10 text-purple-400" : "bg-amber-500/10 text-amber-400"}`}>
                            {idx + 1}
                          </div>
                          <div className="flex-1 space-y-1 overflow-hidden">
                            <h5 className="text-xs font-bold text-gray-200 uppercase group-hover:text-amber-400 transition-colors flex items-center gap-2">
                              {step.sceneTitle}
                              {step.isAlternativeBranch && (
                                <span className="text-[7.5px] uppercase font-mono px-1.5 py-0.5 bg-purple-500/10 text-purple-300 border border-purple-500/20 rounded-md">WHAT IF BRANCH</span>
                              )}
                            </h5>
                            <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">
                              {step.sceneDescription}
                            </p>
                            {step.choiceTaken && (
                              <div className="text-[10px] text-amber-500/80 font-mono font-bold uppercase mt-1">
                                Decision Taken: {step.choiceTaken}
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB: RIPPLES & ECHO TIMELINE */}
              {creatorTab === "ripples" && (
                <div className="space-y-6">
                  <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-2 text-left">
                    <h4 className="text-xs font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" /> Echo Ripple Timeline
                    </h4>
                    <p className="text-[11px] text-gray-400 leading-relaxed">
                      Every choice vibrates outwards into three separate dimensions: immediate, short-term, and permanent. Review critical checkpoints below:
                    </p>
                  </div>

                  {echoTimeline.length === 0 ? (
                    <div className="p-8 text-center text-xs text-gray-500 bg-white/[0.01] border border-white/5 rounded-2xl">
                      No narrative vibrations registered yet. Select story choices to generate active ripples.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {echoTimeline.map((echo, index) => (
                        <motion.div
                          key={echo.id}
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4, delay: index * 0.05 }}
                          className="p-5 rounded-3xl border border-white/5 bg-white/[0.02] text-left relative overflow-hidden group space-y-3 shadow-md hover:border-amber-500/10 transition-all"
                        >
                          {/* Left Glow Coordinate Accent */}
                          <div className="absolute top-0 bottom-0 left-0 w-[3px] bg-gradient-to-b from-amber-500 to-rose-500 opacity-60" />

                          <div className="flex items-center justify-between text-[9px] font-mono tracking-wider text-gray-500">
                            <span className="font-extrabold uppercase text-amber-400 bg-amber-500/5 px-2 py-0.5 rounded-lg border border-amber-500/10">
                              ENTRY {index + 1}
                            </span>
                            <span>{echo.timestamp}</span>
                          </div>

                          <div className="space-y-1">
                            <h5 className="font-bold text-xs text-white tracking-tight leading-none">
                              {echo.sceneTitle}
                            </h5>
                            <p className="text-[10px] text-gray-400 font-medium">
                              Chosen: <span className="italic text-gray-300 font-semibold font-serif">"{echo.choiceTaken}"</span>
                            </p>
                          </div>

                          {/* 3 Ripples */}
                          <div className="grid grid-cols-1 gap-2 pt-2 border-t border-white/5">
                            {/* Immediate Ripple */}
                            <div className="p-2.5 rounded-xl bg-orange-500/5 border border-orange-500/10 space-y-1">
                              <span className="text-[8px] uppercase tracking-wider font-extrabold text-orange-400 flex items-center gap-1">
                                🔸 Immediate (Short-Term) Echo
                              </span>
                              <p className="text-[10px] text-gray-300 leading-relaxed font-sans">
                                {echo.shortTerm}
                              </p>
                            </div>

                            {/* Medium Ripple */}
                            <div className="p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/10 space-y-1">
                              <span className="text-[8px] uppercase tracking-wider font-extrabold text-amber-400 flex items-center gap-1">
                                🟡 Latent (Medium-Term) Ripple
                              </span>
                              <p className="text-[10px] text-gray-300 leading-relaxed font-sans">
                                {echo.mediumTerm}
                              </p>
                            </div>

                            {/* Long Ripple */}
                            <div className="p-2.5 rounded-xl bg-rose-500/5 border border-rose-500/10 space-y-1">
                              <span className="text-[8px] uppercase tracking-wider font-extrabold text-rose-400 flex items-center gap-1">
                                🔴 Permanent (Long-Term) Anchor
                              </span>
                              <p className="text-[10px] text-gray-300 leading-relaxed font-sans">
                                {echo.longTerm}
                              </p>
                            </div>
                          </div>

                          {/* Dynamic Complexity Rating badge footer */}
                          <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                            <span className="text-[8px] uppercase font-mono text-gray-500 font-bold">
                              Fate Complexity Factor
                            </span>
                            <span className="text-[10px] uppercase font-mono text-amber-300 font-black">
                              {echo.complexityScore} / 100
                            </span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB: GRIMOIRE */}
              {creatorTab === "grimoire" && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-3">
                    <h4 className="text-xs font-bold text-amber-400 uppercase tracking-widest">World Grimoire Settings</h4>
                    <p className="text-xs text-gray-400 leading-relaxed">Modify backstories or custom basis prompts to alter subsequent AI plot generations.</p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Character Archetype</label>
                      <input
                        type="text"
                        value={storyParameters.archetype || ""}
                        onChange={(e) => setStoryParameters(prev => ({ ...prev, archetype: e.target.value }))}
                        className="w-full px-4 py-2 text-xs bg-slate-900 border border-white/10 rounded-lg text-white font-bold"
                      />
                    </div>

                    <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Backstory & Motivations</label>
                      <textarea
                        rows={3}
                        value={storyParameters.backstory || ""}
                        onChange={(e) => setStoryParameters(prev => ({ ...prev, backstory: e.target.value }))}
                        className="w-full px-4 py-2 text-xs bg-slate-900 border border-white/10 rounded-lg text-white leading-relaxed"
                      />
                    </div>

                    <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Basis Premises / User Universe Guidelines</label>
                      <textarea
                        rows={3}
                        value={storyParameters.customBasis || ""}
                        onChange={(e) => setStoryParameters(prev => ({ ...prev, customBasis: e.target.value }))}
                        className="w-full px-4 py-2 text-xs bg-slate-900 border border-white/10 rounded-lg text-white leading-relaxed"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: PARAMETERS */}
              {creatorTab === "parameters" && (
                <div className="space-y-5">
                  <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-2">
                    <h4 className="text-xs font-bold text-amber-400 uppercase tracking-widest">Engine & Gen parameters</h4>
                    <p className="text-xs text-gray-400 leading-relaxed">Override dynamic temperature, tone guidelines, and plot complexities.</p>
                  </div>

                  {/* Twist directive */}
                  <div className="space-y-2 border border-amber-500/20 bg-amber-500/5 p-4 rounded-xl text-left">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" /> Creative Plot Twist Directive
                      </span>
                      {customTwist && (
                        <button
                          onClick={() => setCustomTwist("")}
                          className="text-[9px] font-bold uppercase text-[#9A9EAB] hover:text-white"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <textarea
                      rows={3}
                      placeholder="e.g., Introduce a mysterious figure in a crimson hood claiming they have a letter from the victim..."
                      value={customTwist}
                      onChange={(e) => setCustomTwist(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-950 border border-amber-500/20 rounded-lg text-white focus:border-amber-500/50 outline-none leading-relaxed"
                    />
                    <p className="text-[9px] text-gray-400">This twist will be injected and consumed by the AI model during the next choice generation, then cleared automatically.</p>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1 text-left">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-[#A0A2B1]">Story Tone guideline</label>
                      <select
                        value={storyParameters.tone || "intense"}
                        onChange={(e) => setStoryParameters(prev => ({ ...prev, tone: e.target.value as any }))}
                        className="w-full px-3 py-2 text-xs bg-slate-900 border border-white/10 rounded-lg text-white"
                      >
                        <option value="intense">Intense & Noir</option>
                        <option value="gothic">Gothic / Macabre</option>
                        <option value="poetic">Poetic & Melancholic</option>
                        <option value="noir">Crime Noir / Hardboiled</option>
                        <option value="whimsical">Cozy / Whimsical</option>
                        <option value="dramatic">High Drama & Romance</option>
                      </select>
                    </div>

                    <div className="space-y-1 text-left">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-[#A0A2B1]">Plot Complexity</label>
                      <select
                        value={storyParameters.complexity || "complex"}
                        onChange={(e) => setStoryParameters(prev => ({ ...prev, complexity: e.target.value as any }))}
                        className="w-full px-3 py-2 text-xs bg-slate-900 border border-white/10 rounded-lg text-white"
                      >
                        <option value="simple">Simple & Direct</option>
                        <option value="complex">Layered & Sophisticated</option>
                        <option value="labyrinthine">Labyrinthine & Mind-twisting</option>
                      </select>
                    </div>

                    <div className="space-y-1 text-left">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-[#A0A2B1]">Story Length Target</label>
                      <select
                        value={storyParameters.length || "medium"}
                        onChange={(e) => setStoryParameters(prev => ({ ...prev, length: e.target.value as any }))}
                        className="w-full px-3 py-2 text-xs bg-slate-900 border border-white/10 rounded-lg text-white"
                      >
                        <option value="short">Short (3 turns/Epilogue)</option>
                        <option value="medium">Medium (6 turns/Epilogue)</option>
                        <option value="long">Long (9 turns/Epilogue)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: COLLAB */}
              {creatorTab === "collab" && (
                <div className="space-y-5">
                  <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-2">
                    <h4 className="text-xs font-bold text-amber-400 uppercase tracking-widest">Collaborative Storytelling Lobby</h4>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      Host or join a live storytelling room to shape fates together in real-time. Joiners can vote on choice buttons and communicate in the room log.
                    </p>
                  </div>

                  {!activeRoom ? (
                    <div className="space-y-4">
                      {/* Host action */}
                      <button
                        onClick={handleCreateRoom}
                        disabled={isCreatingRoom || !currentStoryId}
                        className="w-full py-3 px-4 bg-amber-500/20 border border-amber-500/30 hover:bg-amber-500/30 hover:border-amber-500/50 text-amber-300 font-bold text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Plus className="w-4 h-4" /> Host New Lobby for current story
                      </button>
                      {!currentStoryId && (
                        <p className="text-[10px] text-red-400/80 text-center italic">Start a story first to host a lobby.</p>
                      )}

                      <div className="flex items-center gap-2">
                        <div className="h-px flex-1 bg-white/10" />
                        <span className="text-[9px] font-bold uppercase text-gray-500">OR JOIN WITH CODE</span>
                        <div className="h-px flex-1 bg-white/10" />
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="e.g. ROOM-4831"
                          value={joiningRoomCode}
                          onChange={(e) => setJoiningRoomCode(e.target.value)}
                          className="flex-1 px-4 py-2 bg-slate-900 border border-white/10 rounded-xl text-white font-mono text-center text-sm font-bold uppercase"
                        />
                        <button
                          onClick={handleJoinRoom}
                          disabled={isJoiningRoom || !joiningRoomCode}
                          className="px-6 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                        >
                          Join
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Active Lobby Stats */}
                      <div className="p-4 rounded-xl bg-slate-900 border border-amber-500/20 space-y-3 text-left">
                        <div className="flex justify-between items-center border-b border-white/5 pb-2">
                          <span className="text-xs font-black text-amber-400 uppercase tracking-widest font-mono">
                            COL-LAB STATE: {activeRoom.roomId}
                          </span>
                          <button
                            onClick={handleLeaveRoom}
                            className="text-[9px] font-bold uppercase text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                          >
                            <LogOut className="w-3 h-3" /> Leave Lobby
                          </button>
                        </div>
                        <div className="text-[11px] text-gray-400 space-y-1">
                          <p><strong>Host ID</strong>: {activeRoom.hostName}</p>
                          <p><strong>Active Allies</strong>: {(activeRoom.participants || []).length} present</p>
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {activeRoom.participants?.map((p: any, idx: number) => (
                              <div key={idx} className="bg-white/5 border border-white/5 px-2 py-0.5 rounded text-[10px] font-semibold text-gray-300 font-mono">
                                • {p.name}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Lobby Chat Room */}
                      <div className="border border-white/5 rounded-xl flex flex-col h-60 bg-slate-950 overflow-hidden">
                        <div className="p-2 border-b border-white/5 bg-slate-900 text-left">
                          <span className="text-[10px] uppercase font-black tracking-widest text-[#B5BAC9] flex items-center gap-1">
                            <MessageSquare className="w-3.5 h-3.5" /> Allie Story Chat
                          </span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2 text-left custom-scrollbar text-xs animate-fadeIn">
                          {activeRoom.chat?.map((msg: any, idx: number) => (
                            <div key={idx} className="space-y-0.5">
                              <span className={`font-bold ${msg.sender === "System" ? "text-amber-500" : msg.sender === (user?.displayName || user?.email?.split("@")[0]) ? "text-sky-400" : "text-[#D155DC]"}`}>{msg.sender}: </span>
                              <span className="text-[#ECEEF3] font-sans">{msg.message}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex border-t border-white/5 p-2 gap-1.5">
                          <input
                            type="text"
                            placeholder="Type message..."
                            value={chatMessage}
                            onChange={(e) => setChatMessage(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSendChatMessage()}
                            className="flex-1 bg-slate-900 border border-white/10 rounded-lg text-xs leading-relaxed text-white px-3"
                          />
                          <button
                            onClick={handleSendChatMessage}
                            className="px-3 py-1.5 text-[10px] font-black uppercase bg-amber-500 text-slate-950 hover:bg-amber-600 rounded-lg cursor-pointer"
                          >
                            Send
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB: EXPORT */}
              {creatorTab === "export" && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-2">
                    <h4 className="text-xs font-bold text-amber-400 uppercase tracking-widest">Compilates Export Suite</h4>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      Extract local storyboards, codex grids, character traits, and linear narrative paths. Export as a beautifully styled Markdown document or share interactive pathways publicly.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <button
                      onClick={handleExportStory}
                      className="w-full py-3.5 bg-slate-900 hover:bg-slate-850 border border-white/10 hover:border-white/25 rounded-xl font-bold text-xs uppercase tracking-widest text-[#ECEEF2] flex items-center justify-center gap-2 cursor-pointer transition-all"
                    >
                      <Download className="w-4 h-4 text-emerald-400" /> Export Grimoire File (.md)
                    </button>

                    <div className="pt-2 border-t border-white/5 space-y-3 text-left">
                      <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Shareable Interactive Path</span>
                      <button
                        onClick={handleShareStory}
                        disabled={isSharing}
                        className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-40"
                      >
                        {isSharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                        Generate Public Shared Link
                      </button>

                      {sharedLink && (
                        <div className="p-3.5 bg-[#090d16] border border-amber-500/20 rounded-xl space-y-2 mt-2">
                          <p className="text-[10px] text-gray-400">Successfully published! Copy link below:</p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              readOnly
                              value={sharedLink}
                              className="flex-1 bg-slate-950 px-3 py-1.5 border border-white/10 rounded text-[11px] text-amber-400 font-mono font-bold font-sans"
                            />
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(sharedLink);
                                alert("Link Copied!");
                              }}
                              className="px-3 bg-amber-500/20 text-amber-300 rounded border border-amber-500/20 text-[10px] font-black uppercase cursor-pointer"
                            >
                              Copy
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </>
      )}

      {/* Bookmarks Controller Panel Overlay */}
      {showBookmarks && (
        <>
          <div
            onClick={() => setShowBookmarks(false)}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[92]"
          />
          <div
            className="fixed top-0 right-0 h-full w-full max-w-lg z-[93] shadow-2xl border-l flex flex-col bg-slate-950 border-amber-500/10 text-gray-200"
          >
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#070b12]">
              <div className="flex items-center gap-3">
                <Bookmark className="w-5 h-5 text-amber-400 animate-pulse" />
                <div>
                  <h3 className="font-extrabold text-[#ECEEF2] text-sm tracking-widest uppercase">
                    Story Bookmarks
                  </h3>
                  <p className="text-[9px] text-amber-500/80 font-black tracking-widest uppercase">Your Anchored Destinies</p>
                </div>
              </div>
              <button
                onClick={() => setShowBookmarks(false)}
                className="p-2 hover:bg-white/5 rounded-full transition-colors text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-[#050811]">
              <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-2 text-left">
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-widest flex items-center justify-between">
                  <span>Saved Scene Anchors</span>
                  {bookmarks.length > 0 && (
                    <button
                      onClick={handleClearAllBookmarks}
                      className="text-[9px] font-black uppercase text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                    >
                      Clear All
                    </button>
                  )}
                </h4>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Click on any bookmark to immediately restore the story state back to that scene node and explore a brand new fork of fate. This functions like a timeline save point.
                </p>
              </div>

              <div className="space-y-3">
                {bookmarks.length === 0 ? (
                  <div className="text-center italic opacity-40 py-12 text-xs flex flex-col items-center justify-center gap-3">
                    <Bookmark className="w-8 h-8 opacity-20" />
                    <span className="max-w-xs text-balance">No bookmarked scenes in this session yet. Click the bookmark icon beside "Entry" label on the active scene to pin your favorite scenes!</span>
                  </div>
                ) : (
                  bookmarks.map((b) => (
                    <div
                      key={b.id}
                      className="p-4 rounded-xl border border-white/5 bg-slate-900/60 hover:border-amber-500/30 hover:bg-slate-950/80 transition-all text-left flex items-start gap-4 group relative"
                    >
                      <button
                        onClick={() => {
                          branchToStep(b.stepIndex);
                          setShowBookmarks(false);
                        }}
                        className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex flex-col items-center justify-center text-[10px] font-black shrink-0 border border-amber-500/20 hover:bg-amber-500/20 cursor-pointer"
                      >
                        <span>#</span>
                        <span>{b.stepIndex + 1}</span>
                      </button>
                      <div className="flex-1 space-y-1 overflow-hidden pr-16 select-none">
                        <h5
                          onClick={() => {
                            branchToStep(b.stepIndex);
                            setShowBookmarks(false);
                          }}
                          className="text-xs font-bold text-gray-200 uppercase group-hover:text-amber-400 transition-colors cursor-pointer line-clamp-1"
                        >
                          {b.sceneTitle}
                        </h5>
                        <p className="text-[10px] text-gray-400 leading-relaxed italic line-clamp-1">
                          {b.playerNote}
                        </p>
                        <p className="text-[9px] text-gray-500 font-mono font-bold uppercase pt-1">
                          Pinned: {new Date(b.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>

                      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            branchToStep(b.stepIndex);
                            setShowBookmarks(false);
                          }}
                          className="p-2 text-sky-400 hover:bg-sky-500/10 rounded-full transition-colors cursor-pointer"
                          title="Restore and Jump to Scene"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            const updated = bookmarks.filter((bm) => bm.id !== b.id);
                            saveBookmarksToStorage(updated);
                          }}
                          className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-full transition-colors cursor-pointer"
                          title="Delete Bookmark"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* NPC Updates Toasts */}
      <div className="fixed top-24 right-6 z-50 flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {npcUpdateNotifs.map((notif: any) => (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              onAnimationComplete={() => {
                setTimeout(
                  () =>
                    setNpcUpdateNotifs((prev) =>
                      prev.filter((n) => n.id !== notif.id),
                    ),
                  4000,
                );
              }}
              className={`p-4 rounded-2xl shadow-2xl border backdrop-blur-xl flex items-start gap-4 pointer-events-auto max-w-sm ${
                genre === "romance"
                  ? "bg-rose-50/90 border-rose-200 shadow-rose-900/10"
                  : genre === "paranormal"
                    ? "bg-[#1a1025]/90 border-purple-500/30"
                    : "bg-zinc-900/90 border-white/10 text-white"
              }`}
            >
              <div
                className={`p-2 rounded-full ${
                  genre === "romance"
                    ? "bg-rose-100 text-rose-500"
                    : "bg-white/10 text-sky-400"
                }`}
              >
                <Users className="w-4 h-4" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex justify-between items-center text-xs font-bold font-mono">
                  <span
                    className={
                      genre === "romance" ? "text-rose-900" : "text-gray-200"
                    }
                  >
                    {notif.name}
                  </span>
                  <span
                    className={`${
                      notif.relationshipType === "suspicion"
                        ? notif.affinityChange > 0
                          ? "text-red-500"
                          : "text-blue-400"
                        : notif.affinityChange > 0
                          ? genre === "romance"
                            ? "text-rose-500"
                            : "text-green-500"
                          : "text-gray-500"
                    }`}
                  >
                    {notif.affinityChange > 0 ? "+" : ""}
                    {notif.affinityChange}{" "}
                    {notif.relationshipType === "suspicion"
                      ? "Suspicion"
                      : "Affinity"}
                  </span>
                </div>
                <p
                  className={`text-xs leading-relaxed ${genre === "romance" ? "text-rose-700" : "text-gray-400"}`}
                >
                  {notif.reason}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

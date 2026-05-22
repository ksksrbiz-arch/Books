import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Pin,
  Plus,
  Trash2,
  CheckCircle,
  Tag,
  Link,
  Sparkles,
  Search,
  Check,
  X,
  Type,
  ListTodo,
  Smile,
  Palette,
  Eye,
  ArrowRight,
  User as UserIcon,
  BookOpen,
  Send,
  Loader2,
  RefreshCcw,
  UserCheck
} from "lucide-react";
import {
  db,
  auth,
  OperationType,
  handleFirestoreError,
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
  serverTimestamp
} from "firebase/firestore";
import Markdown from "react-markdown";

// Keep Colors Slate
const KEEP_COLORS = [
  { name: "Neutral (Translucent)", class: "bg-white/5 border-white/10 text-white" },
  { name: "Cream Yellow", class: "bg-yellow-500/10 border-yellow-500/30 text-yellow-100" },
  { name: "Sunset Crimson", class: "bg-rose-500/10 border-rose-500/30 text-rose-100" },
  { name: "Mystic Lavender", class: "bg-purple-500/10 border-purple-500/30 text-purple-100" },
  { name: "Nebula Teal", class: "bg-teal-500/10 border-teal-500/30 text-teal-100" },
  { name: "Emerald Mint", class: "bg-emerald-500/10 border-emerald-500/30 text-emerald-100" },
  { name: "Cosmic Azure", class: "bg-sky-500/10 border-sky-500/30 text-sky-100" },
  { name: "Vibrant Orange", class: "bg-amber-500/10 border-amber-500/30 text-amber-100" },
];

const PRESET_LABELS = ["Outline", "Character", "Plot Twist", "Worldbuilding", "Reference"];

interface ListItem {
  id: string;
  text: string;
  checked: boolean;
}

interface CreativeNote {
  id: string;
  title: string;
  content: string;
  type: "text" | "checklist";
  listItems?: ListItem[];
  color: string;
  pinned: boolean;
  labels: string[];
  linkedSceneId: string | null; // linked scene/node title
  createdAt: any;
  updatedAt?: any;
}

interface GoogleKeepWorkspaceProps {
  currentStoryId: string;
  currentNode: { sceneTitle: string; sceneDescription: string } | null;
  onClose: () => void;
  genre: string | null;
  onJumpToScene?: (sceneTitle: string) => void;
}

export function GoogleKeepWorkspace({
  currentStoryId,
  currentNode,
  onClose,
  genre,
  onJumpToScene
}: GoogleKeepWorkspaceProps) {
  const [seedingLoading, setSeedingLoading] = useState(false);
  const [notes, setNotes] = useState<CreativeNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLabel, setFilterLabel] = useState<string | null>(null);
  const [filterLinked, setFilterLinked] = useState(false);

  // New Note Creator State
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newType, setNewType] = useState<"text" | "checklist">("text");
  const [newChecklist, setNewChecklist] = useState<ListItem[]>([]);
  const [newCheckInput, setNewCheckInput] = useState("");
  const [newColor, setNewColor] = useState("bg-white/5 border-white/10 text-white");
  const [newPinned, setNewPinned] = useState(false);
  const [newLabels, setNewLabels] = useState<string[]>([]);
  const [newLinked, setNewLinked] = useState<boolean>(false);

  // Editing state for active note details
  const [editingNote, setEditingNote] = useState<CreativeNote | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editType, setEditType] = useState<"text" | "checklist">("text");
  const [editChecklist, setEditChecklist] = useState<ListItem[]>([]);
  const [editCheckInput, setEditCheckInput] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editPinned, setEditPinned] = useState(false);
  const [editLabels, setEditLabels] = useState<string[]>([]);
  const [editLinked, setEditLinked] = useState<boolean>(false);

  // Gemini Assist State
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("Character Profile");

  const currentUser = auth.currentUser;

  // Generate Starter Board with AI
  const handleGenerateStarterBoard = async () => {
    if (!currentUser || !currentStoryId) return;
    setSeedingLoading(true);
    try {
      const res = await fetch("/api/story/keep-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate-starter",
          sceneTitle: currentNode?.sceneTitle || "",
          sceneDescription: currentNode?.sceneDescription || "",
          genre: genre || "mystery"
        }),
      });

      if (!res.ok) throw new Error("Failed to preseed board with starter notes");
      const cards = await res.json();

      if (Array.isArray(cards)) {
        const notesCol = collection(db, "users", currentUser.uid, "stories", currentStoryId, "notes");
        for (const card of cards) {
          const listItems = card.type === "checklist" && Array.isArray(card.listItems)
            ? card.listItems.map((itemText: string, i: number) => ({
                id: `check_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 4)}`,
                text: itemText,
                checked: false
              }))
            : [];

          await addDoc(notesCol, {
            title: card.title || "Starter Note",
            type: card.type || "text",
            content: card.type === "text" ? (card.content || "") : "",
            listItems: listItems,
            color: card.color || "bg-white/5 border-white/10 text-white",
            pinned: false,
            labels: card.labels || ["Outline"],
            linkedSceneId: currentNode ? currentNode.sceneTitle : null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
      }
    } catch (e) {
      console.error("Starter seeding error:", e);
      alert("Seeding creative starter notes failed: " + String(e));
    } finally {
      setSeedingLoading(false);
    }
  };

  // Real-time listener for story notes
  useEffect(() => {
    if (!currentUser || !currentStoryId) return;

    const notesRef = collection(
      db,
      "users",
      currentUser.uid,
      "stories",
      currentStoryId,
      "notes"
    );

    const q = notesRef; // orderBy("pinned", "desc") or standard sorting; we can sort client side
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedNotes = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
          } as CreativeNote;
        });
        setNotes(fetchedNotes);
        setLoading(false);
      },
      (error) => {
        console.error("Firestore loading error:", error);
        handleFirestoreError(error, OperationType.LIST, `users/${currentUser.uid}/stories/${currentStoryId}/notes`);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentStoryId, currentUser]);

  // Apply a template to the note creator
  const applyTemplate = (templateName: string) => {
    setSelectedTemplate(templateName);
    if (templateName === "Character Profile") {
      setNewTitle("New Character: [Name]");
      setNewContent(
        `### Character Profile\n- **Role**: protagonist / antagonist / mentor\n- **Backstory**: \n- **Key Motivation & Goals**: \n- **Core Flaw & Virtue**: \n- **Potential arc in this story**: `
      );
      setNewType("text");
      if (!newLabels.includes("Character")) {
        setNewLabels([...newLabels, "Character"]);
      }
    } else if (templateName === "Story Outline & Ideas") {
      setNewTitle("Outline Draft: [Theme]");
      setNewContent(
        `### Narrative Outline\n- **Setting**: \n- **Main Conflict**: \n- **Proposed Climax**: \n- **Key Scenes List**: `
      );
      setNewType("text");
      if (!newLabels.includes("Outline")) {
        setNewLabels([...newLabels, "Outline"]);
      }
    } else if (templateName === "Plot Twist Mapping") {
      setNewTitle("Drama Map & Twists");
      setNewType("checklist");
      setNewChecklist([
        { id: "1", text: "Establish the false sense of comfort in early acts", checked: false },
        { id: "2", text: "Introduce the subtle, untruthful secondary ally", checked: false },
        { id: "3", text: "Rebel action or sudden betrayal occurs at midpoint", checked: false },
      ]);
      setNewLabels(["Plot Twist"]);
    } else {
      setNewTitle("Creative Brainstorming");
      setNewContent("");
      setNewType("text");
      setNewLabels([]);
    }
  };

  // Add Item to Checklist Creator
  const addCheckItem = (isEdit: boolean) => {
    const input = isEdit ? editCheckInput : newCheckInput;
    if (!input.trim()) return;

    const newItem: ListItem = {
      id: Date.now().toString(),
      text: input.trim(),
      checked: false,
    };

    if (isEdit) {
      setEditChecklist([...editChecklist, newItem]);
      setEditCheckInput("");
    } else {
      setNewChecklist([...newChecklist, newItem]);
      setNewCheckInput("");
    }
  };

  // Remove Item from Checklist
  const removeCheckItem = (itemId: string, isEdit: boolean) => {
    if (isEdit) {
      setEditChecklist(editChecklist.filter((x) => x.id !== itemId));
    } else {
      setNewChecklist(newChecklist.filter((x) => x.id !== itemId));
    }
  };

  // Toggle checklist item check state locally
  const toggleCheckItemLocal = (itemId: string, isEdit: boolean) => {
    if (isEdit) {
      setEditChecklist(
        editChecklist.map((it) => (it.id === itemId ? { ...it, checked: !it.checked } : it))
      );
    } else {
      setNewChecklist(
        newChecklist.map((it) => (it.id === itemId ? { ...it, checked: !it.checked } : it))
      );
    }
  };

  // Label toggling
  const toggleLabel = (label: string, isEdit: boolean) => {
    if (isEdit) {
      if (editLabels.includes(label)) {
        setEditLabels(editLabels.filter((x) => x !== label));
      } else {
        setEditLabels([...editLabels, label]);
      }
    } else {
      if (newLabels.includes(label)) {
        setNewLabels(newLabels.filter((x) => x !== label));
      } else {
        setNewLabels([...newLabels, label]);
      }
    }
  };

  // Save/Create a Keep Note
  const saveNewNote = async () => {
    if (!currentUser || !currentStoryId) return;
    if (!newTitle.trim() && !newContent.trim() && newChecklist.length === 0) {
      setIsCreating(false);
      return;
    }

    const notePayload = {
      title: newTitle.trim() || "Untitled Note",
      type: newType,
      content: newType === "text" ? newContent : "",
      listItems: newType === "checklist" ? newChecklist : [],
      color: newColor,
      pinned: newPinned,
      labels: newLabels,
      linkedSceneId: newLinked && currentNode ? currentNode.sceneTitle : null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      const notesPath = `users/${currentUser.uid}/stories/${currentStoryId}/notes`;
      const notesCol = collection(db, "users", currentUser.uid, "stories", currentStoryId, "notes");
      await addDoc(notesCol, notePayload);

      // Reset Creator
      setNewTitle("");
      setNewContent("");
      setNewType("text");
      setNewChecklist([]);
      setNewLabels([]);
      setNewColor("bg-white/5 border-white/10 text-white");
      setNewPinned(false);
      setNewLinked(false);
      setIsCreating(false);
    } catch (err) {
      console.error("Failed to save note to Firestore:", err);
      alert("Error adding note to Firestore: " + String(err));
    }
  };

  // Delete a Note
  const deleteNote = async (noteId: string) => {
    if (!currentUser || !currentStoryId) return;
    const confirmDelete = window.confirm("Are you sure you want to delete this Google Keep note?");
    if (!confirmDelete) return;

    try {
      const noteDocRef = doc(db, "users", currentUser.uid, "stories", currentStoryId, "notes", noteId);
      await deleteDoc(noteDocRef);
      if (editingNote?.id === noteId) {
        setEditingNote(null);
      }
    } catch (err) {
      console.error("Failed to delete Note:", err);
    }
  };

  // Quick Inline Toggle Pin
  const togglePin = async (e: React.MouseEvent, note: CreativeNote) => {
    e.stopPropagation();
    if (!currentUser || !currentStoryId) return;
    try {
      const noteDocRef = doc(db, "users", currentUser.uid, "stories", currentStoryId, "notes", note.id);
      await setDoc(noteDocRef, { pinned: !note.pinned, updatedAt: serverTimestamp() }, { merge: true });
    } catch (err) {
      console.error("Failed to pin:", err);
    }
  };

  // Open note for editing/expanding
  const openEditNote = (note: CreativeNote) => {
    setEditingNote(note);
    setEditTitle(note.title);
    setEditContent(note.content || "");
    setEditType(note.type);
    setEditChecklist(note.listItems || []);
    setEditColor(note.color);
    setEditPinned(note.pinned);
    setEditLabels(note.labels || []);
    setEditLinked(!!note.linkedSceneId);
    setAiResponse(null);
  };

  // Save the Edited Note
  const saveEditedNote = async () => {
    if (!currentUser || !currentStoryId || !editingNote) return;

    const updatedPayload = {
      title: editTitle.trim() || "Untitled Note",
      type: editType,
      content: editType === "text" ? editContent : "",
      listItems: editType === "checklist" ? editChecklist : [],
      color: editColor,
      pinned: editPinned,
      labels: editLabels,
      linkedSceneId: editLinked && currentNode ? currentNode.sceneTitle : null,
      updatedAt: serverTimestamp(),
    };

    try {
      const noteDocRef = doc(db, "users", currentUser.uid, "stories", currentStoryId, "notes", editingNote.id);
      await setDoc(noteDocRef, updatedPayload, { merge: true });
      setEditingNote(null);
    } catch (err) {
      console.error("Failed to save updated note:", err);
    }
  };

  // Toggle individual checklist item during story live preview (inline save)
  const toggleListItemLive = async (note: CreativeNote, itemIndex: number) => {
    if (!currentUser || !currentStoryId) return;
    const updatedList = [...(note.listItems || [])];
    updatedList[itemIndex] = {
      ...updatedList[itemIndex],
      checked: !updatedList[itemIndex].checked,
    };

    try {
      const noteDocRef = doc(db, "users", currentUser.uid, "stories", currentStoryId, "notes", note.id);
      await setDoc(noteDocRef, { listItems: updatedList, updatedAt: serverTimestamp() }, { merge: true });
    } catch (err) {
      console.error("Error toggling list item:", err);
    }
  };

  // Ask Gemini Keep-Assist API helper
  const invokeGeminiAssist = async (action: "expand" | "plot-twist" | "character-arc" | "refine", isCreator: boolean) => {
    setAiLoading(true);
    setAiResponse(null);

    const titleToUse = isCreator ? newTitle : editTitle;
    const contentToUse = isCreator ? newContent : editContent;
    const typeToUse = isCreator ? newType : editType;

    try {
      const res = await fetch("/api/story/keep-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: titleToUse,
          noteContent: contentToUse,
          noteType: typeToUse,
          action: action,
        }),
      });

      if (!res.ok) throw new Error("Backend response error processing Keep assist");
      const data = await res.json();

      setAiResponse(data.text);

      // Offer to auto-fill or append
      if (data.text) {
        if (isCreator) {
          if (newType === "text") {
            setNewContent((prev) => prev ? `${prev}\n\n### Gemini Suggestion\n${data.text}` : data.text);
          } else {
            // Checklist: split lines and make list items
            const bulletItems = data.text
              .split("\n")
              .filter((l: string) => l.trim().startsWith("-") || l.trim().startsWith("*") || /^\d+\./.test(l.trim()))
              .map((it: string) => ({
                id: Math.random().toString(),
                text: it.replace(/^[-*\d.]+\s*/, "").trim(),
                checked: false,
              }));
            setNewChecklist([...newChecklist, ...bulletItems]);
          }
        } else {
          if (editType === "text") {
            setEditContent((prev) => prev ? `${prev}\n\n### Gemini Suggestion\n${data.text}` : data.text);
          } else {
            const bulletItems = data.text
              .split("\n")
              .filter((l: string) => l.trim().startsWith("-") || l.trim().startsWith("*") || /^\d+\./.test(l.trim()))
              .map((it: string) => ({
                id: Math.random().toString(),
                text: it.replace(/^[-*\d.]+\s*/, "").trim(),
                checked: false,
              }));
            setEditChecklist([...editChecklist, ...bulletItems]);
          }
        }
      }
    } catch (err: any) {
      console.error("Gemini assist error:", err);
      setAiResponse(`Gemini failed to think of extensions: ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  // Filter notes based on query, labels, and scene linking state
  const filteredNotes = notes.filter((note) => {
    // Search filter
    const searchString = `${note.title} ${note.content || ""} ${note.listItems?.map((x) => x.text).join(" ") || ""}`.toLowerCase();
    if (searchQuery && !searchString.includes(searchQuery.toLowerCase())) return false;

    // Label filter
    if (filterLabel && !note.labels?.includes(filterLabel)) return false;

    // Linked scene filter
    if (filterLinked && currentNode && note.linkedSceneId !== currentNode.sceneTitle) return false;

    return true;
  });

  // Split Pinned and Normal Notes
  const pinnedNotes = filteredNotes.filter((x) => x.pinned);
  const otherNotes = filteredNotes.filter((x) => !x.pinned);

  return (
    <div className="flex flex-col h-full bg-slate-950 border border-white/5 text-gray-100 rounded-[2rem] overflow-hidden shadow-2xl relative">
      {/* Top Title Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-slate-900/50 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-black tracking-widest uppercase">Collaborative Keep Board</h2>
            <p className="text-[10px] text-gray-500 font-medium">Outline, Brainstorm, and Link Story Concepts</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Side: Notes Feed/Board */}
        <div className="flex-1 flex flex-col overflow-y-auto p-6 space-y-6">
          {/* Quick Search & Filter Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-gray-500 absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Search notes or items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs py-2.5 pl-10 pr-4 bg-white/5 focus:bg-white/10 rounded-xl border border-white/5 focus:border-amber-500/30 outline-none transition-all placeholder:text-gray-600 font-medium"
              />
            </div>

            {/* Quick tag switches */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
              <button
                onClick={() => setFilterLabel(null)}
                className={`text-[10px] uppercase font-black tracking-wider px-3 py-1.5 rounded-lg transition-colors border ${
                  !filterLabel ? "bg-amber-500/20 border-amber-500/30 text-amber-400" : "border-white/5 text-gray-400 hover:bg-white/5"
                }`}
              >
                All
              </button>
              {PRESET_LABELS.map((lbl) => (
                <button
                  key={lbl}
                  onClick={() => setFilterLabel(lbl)}
                  className={`text-[10px] uppercase font-black tracking-wider px-3 py-1.5 rounded-lg transition-all border shrink-0 ${
                    filterLabel === lbl ? "bg-amber-500/20 border-amber-500/30 text-amber-400 animate-pulse" : "border-white/5 text-gray-400 hover:bg-white/5"
                  }`}
                >
                  {lbl}
                </button>
              ))}

              {currentNode && (
                <button
                  onClick={() => setFilterLinked(!filterLinked)}
                  className={`text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 rounded-lg border flex items-center gap-1 shrink-0 transition-colors ${
                    filterLinked ? "bg-sky-500/20 border-sky-500/40 text-sky-400" : "border-white/5 text-sky-500 hover:bg-white/5"
                  }`}
                  title={`Linked to current scene: "${currentNode.sceneTitle}"`}
                >
                  <Link className="w-3 h-3" />
                  Linked
                </button>
              )}
            </div>
          </div>

          {/* Create Note Launcher / Form */}
          {!isCreating ? (
            <motion.button
              onClick={() => setIsCreating(true)}
              className="w-full text-left py-3 px-5 border border-white/5 rounded-2xl bg-white/5 hover:bg-white/10 text-gray-400 flex items-center justify-between text-xs font-semibold cursor-pointer shadow-sm group hover:border-amber-500/20 transition-all"
            >
              <span className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-400 group-hover:rotate-90 transition-transform duration-300" />
                Take an outline note or map a character...
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-black px-2 py-0.5 bg-amber-500/10 text-amber-500 rounded-md">
                  Gemini-Powered
                </span>
              </div>
            </motion.button>
          ) : (
            <motion.div
              layoutId="creator-box"
              className="border border-white/10 rounded-2xl bg-slate-900 p-5 space-y-4 shadow-xl"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xs uppercase font-black tracking-widest text-amber-400">
                  New Creative Concept
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 font-semibold">Note templates:</span>
                  {["Character Profile", "Story Outline & Ideas", "Plot Twist Mapping"].map((temp) => (
                    <button
                      key={temp}
                      onClick={() => applyTemplate(temp)}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-md transition-colors ${
                        selectedTemplate === temp ? "bg-amber-500/20 text-amber-400" : "bg-white/5 text-gray-400 hover:bg-white/10"
                      }`}
                    >
                      {temp.replace(" Profile", "").replace(" & Ideas", "").replace(" Mapping", "")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input details */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="Note Title (e.g., Protagonist Profile: Liam)"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full bg-white/5 text-xs py-2 px-3 focus:bg-white/10 rounded-lg border border-white/5 outline-none font-bold"
                  />
                  <button
                    onClick={() => setNewPinned(!newPinned)}
                    className={`p-2 rounded-lg transition-colors ${
                      newPinned ? "bg-amber-550 text-amber-400 bg-amber-500/20" : "text-gray-400 hover:bg-white/5"
                    }`}
                    title="Pin Note"
                  >
                    <Pin className="w-4 h-4" />
                  </button>
                </div>

                {/* Content type selector */}
                <div className="flex items-center gap-3 py-1">
                  <button
                    onClick={() => setNewType("text")}
                    className={`flex items-center gap-1.5 text-[10px] uppercase font-bold px-3 py-1.5 rounded-lg border ${
                      newType === "text" ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-400" : "border-white/5 text-gray-400 hover:bg-white/5"
                    }`}
                  >
                    <Type className="w-3.5 h-3.5" /> Normal Text
                  </button>
                  <button
                    onClick={() => setNewType("checklist")}
                    className={`flex items-center gap-1.5 text-[10px] uppercase font-bold px-3 py-1.5 rounded-lg border ${
                      newType === "checklist" ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "border-white/5 text-gray-400 hover:bg-white/5"
                    }`}
                  >
                    <ListTodo className="w-3.5 h-3.5" /> Checklist / Tasks
                  </button>
                </div>

                {/* Standard text area or checklist editor */}
                {newType === "text" ? (
                  <textarea
                    placeholder="Document your vision, list themes, write lore backstory..."
                    rows={4}
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    className="w-full bg-white/5 text-xs p-3 focus:bg-white/10 rounded-lg border border-white/5 outline-none font-medium h-[110px] resize-y"
                  />
                ) : (
                  <div className="space-y-2">
                    {newChecklist.map((item) => (
                      <div key={item.id} className="flex items-center justify-between bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 text-xs animate-fadeIn">
                        <span className="font-semibold text-gray-300">{item.text}</span>
                        <button
                          onClick={() => removeCheckItem(item.id, false)}
                          className="text-gray-500 hover:text-rose-400 p-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Add checklist item..."
                        value={newCheckInput}
                        onChange={(e) => setNewCheckInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addCheckItem(false)}
                        className="flex-1 bg-white/5 text-xs py-2 px-3 rounded-lg border border-white/5 outline-none font-medium text-gray-200"
                      />
                      <button
                        onClick={() => addCheckItem(false)}
                        className="p-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-lg"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Labels & linking tools */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {PRESET_LABELS.map((lbl) => (
                  <button
                    key={lbl}
                    onClick={() => toggleLabel(lbl, false)}
                    className={`text-[9px] uppercase font-bold tracking-wider px-2 py-1 rounded-md transition-colors ${
                      newLabels.includes(lbl) ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-white/5 text-gray-400 border border-transparent hover:bg-white/10"
                    }`}
                  >
                    {lbl}
                  </button>
                ))}

                {currentNode && (
                  <button
                    onClick={() => setNewLinked(!newLinked)}
                    className={`text-[9.5px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1 transition-colors ${
                      newLinked ? "bg-sky-500/20 text-sky-400 border border-sky-500/30" : "bg-white/5 text-sky-500 focus:bg-sky-550/10"
                    }`}
                    title={`Link to scene: "${currentNode.sceneTitle}"`}
                  >
                    <Link className="w-3.5 h-3.5" />
                    {newLinked ? `Linked to Scene` : "Link to Current Scene"}
                  </button>
                )}
              </div>

              {/* Color picker */}
              <div className="flex items-center gap-1 bg-white/5 p-2 rounded-xl border border-white/5">
                <Palette className="w-3.5 h-3.5 text-gray-500 mr-2" />
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  {KEEP_COLORS.map((c) => (
                    <button
                      key={c.class}
                      onClick={() => setNewColor(c.class)}
                      className={`w-5 h-5 rounded-full border cursor-pointer hover:scale-110 transition-transform ${c.class.split(" ")[0]} ${
                        newColor === c.class ? "ring-2 ring-amber-400 scale-105" : "border-white/10"
                      }`}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>

              {/* Gemini Trigger row within creator */}
              {(newTitle.trim() || newContent.trim()) && (
                <div className="bg-gradient-to-r from-amber-500/10 to-transparent p-3 rounded-xl border border-amber-500/20 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-200">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Gemini Creative Spark:</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => invokeGeminiAssist("expand", true)}
                      disabled={aiLoading}
                      className="text-[10px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold px-3 py-1.5 rounded-md transition-colors flex items-center gap-1 disabled:opacity-50"
                    >
                      {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                      Expand Outline
                    </button>
                    <button
                      onClick={() => invokeGeminiAssist("plot-twist", true)}
                      disabled={aiLoading}
                      className="text-[10px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold px-3 py-1.5 rounded-md transition-colors flex items-center gap-1 disabled:opacity-50"
                    >
                      {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      Suggest Plot Twist
                    </button>
                  </div>
                </div>
              )}

              {/* Creator confirmation action */}
              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => setIsCreating(false)}
                  className="text-xs uppercase font-extrabold px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveNewNote}
                  className="text-xs uppercase font-black px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl shadow-lg transition-all flex items-center gap-1"
                >
                  <Check className="w-4 h-4" /> Save Board Note
                </button>
              </div>
            </motion.div>
          )}

          {/* Load indicator */}
          {loading ? (
            <div className="text-center py-12 text-gray-500 flex flex-col items-center justify-center space-y-2">
              <Loader2 className="w-8 h-8 animate-spin text-amber-400 opacity-60" />
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Loading creative board...</p>
            </div>
          ) : notes.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-white/5 rounded-2rem bg-slate-900/10 p-6 flex flex-col items-center justify-center space-y-4">
              <Smile className="w-12 h-12 text-amber-400/20" />
              <div>
                <h4 className="text-sm font-bold opacity-80">Workspace Keep Board Empty</h4>
                <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 leading-relaxed">
                  Start outline nodes, list characters, specify plot points, or request Gemini to pre-generate storytelling references!
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsCreating(true)}
                  className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/35 text-amber-400 text-xs font-extrabold uppercase tracking-widest rounded-xl transition-all"
                  disabled={seedingLoading}
                >
                  Create First Note
                </button>
                <button
                  onClick={handleGenerateStarterBoard}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs uppercase tracking-widest rounded-xl shadow-lg transition-all flex items-center gap-1.5 disabled:opacity-50"
                  disabled={seedingLoading}
                >
                  {seedingLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Seeding Board...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-slate-950" /> Starter Board (AI)
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* PINNED SECTION */}
              {pinnedNotes.length > 0 && (
                <div className="space-y-3 animate-fadeIn">
                  <h3 className="text-[10px] uppercase font-black tracking-widest text-amber-400 flex items-center gap-1.5 opacity-80">
                    <Pin className="w-3 h-3 text-amber-400 rotate-45" /> Pinned Brainstorms
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {pinnedNotes.map((note) => (
                      <KeepCard
                        key={note.id}
                        note={note}
                        currentNode={currentNode}
                        onEdit={openEditNote}
                        onDelete={deleteNote}
                        onTogglePin={togglePin}
                        onToggleCheck={toggleListItemLive}
                        onJumpToScene={onJumpToScene}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* OTHERS SECTION */}
              {otherNotes.length > 0 && (
                <div className="space-y-3">
                  {pinnedNotes.length > 0 && (
                    <h3 className="text-[10px] uppercase font-black tracking-widest text-gray-500 font-bold tracking-wider">
                      Other Story Notes
                    </h3>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {otherNotes.map((note) => (
                      <KeepCard
                        key={note.id}
                        note={note}
                        currentNode={currentNode}
                        onEdit={openEditNote}
                        onDelete={deleteNote}
                        onTogglePin={togglePin}
                        onToggleCheck={toggleListItemLive}
                        onJumpToScene={onJumpToScene}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Side: Gemini Expand & Active Editor Side Drawer when editing */}
        <AnimatePresence>
          {editingNote && (
            <motion.div
              initial={{ opacity: 0, x: 200 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 200 }}
              className="w-full md:w-96 border-t md:border-t-0 md:border-l border-white/5 bg-slate-900/60 p-6 flex flex-col shrink-0 overflow-y-auto space-y-5"
            >
              {/* Editor Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-black tracking-widest uppercase text-amber-400">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Interactive Editor</span>
                </div>
                <button
                  onClick={() => setEditingNote(null)}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Core edit inputs */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <span className="text-[9px] uppercase font-black tracking-widest text-gray-500">Note Title</span>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-white/5 font-bold p-2.5 text-xs text-white border border-white/5 focus:border-amber-500/20 outline-none rounded-lg"
                  />
                </div>

                {/* Edit Pinned */}
                <div className="flex items-center justify-between bg-white/5 p-2 rounded-xl border border-white/5">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Pin note status</span>
                  <button
                    onClick={() => setEditPinned(!editPinned)}
                    className={`p-1.5 rounded-lg border transition-colors ${
                      editPinned ? "bg-amber-500/20 border-amber-500/30 text-amber-400 animate-pulse" : "border-white/5 text-gray-500"
                    }`}
                  >
                    <Pin className="w-4 h-4" />
                  </button>
                </div>

                {/* Main Content Area */}
                <div className="space-y-1">
                  <span className="text-[9px] uppercase font-black tracking-widest text-gray-500">Content / Document</span>
                  {editType === "text" ? (
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={6}
                      className="w-full bg-white/5 text-xs font-medium p-3 text-white border border-white/5 focus:border-amber-500/20 outline-none rounded-lg min-h-[140px] resize-y"
                    />
                  ) : (
                    <div className="space-y-2">
                      {editChecklist.map((item) => (
                        <div key={item.id} className="flex items-center gap-2 bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5">
                          <button
                            onClick={() => toggleCheckItemLocal(item.id, true)}
                            className={`p-0.5 rounded ${item.checked ? "text-emerald-400 bg-emerald-500/10" : "text-gray-500 hover:bg-white/5"}`}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <span className={`flex-1 text-xs truncate ${item.checked ? "line-through opacity-40 text-gray-400" : "text-gray-200"}`}>
                            {item.text}
                          </span>
                          <button
                            onClick={() => removeCheckItem(item.id, true)}
                            className="text-gray-500 hover:text-rose-500 p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <div className="flex items-center gap-1.5 pt-1">
                        <input
                          type="text"
                          placeholder="Add item..."
                          value={editCheckInput}
                          onChange={(e) => setEditCheckInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && addCheckItem(true)}
                          className="flex-1 bg-white/5 text-xs py-1.5 px-3 rounded-lg border border-white/5 outline-none font-medium"
                        />
                        <button
                          onClick={() => addCheckItem(true)}
                          className="p-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Edit Color Palette selection */}
                <div className="space-y-1">
                  <span className="text-[9px] uppercase font-black tracking-widest text-gray-500">Edit Note Aesthetics</span>
                  <div className="flex flex-wrap items-center gap-1.5 bg-white/5 p-2 rounded-xl border border-white/5">
                    {KEEP_COLORS.map((c) => (
                      <button
                        key={c.class}
                        onClick={() => setEditColor(c.class)}
                        className={`w-6 h-6 rounded-full border cursor-pointer hover:scale-110 transition-transform ${c.class.split(" ")[0]} ${
                          editColor === c.class ? "ring-2 ring-amber-400 scale-105" : "border-white/10"
                        }`}
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>

                {/* Labels & linking configuration */}
                <div className="space-y-2">
                  <span className="text-[9px] uppercase font-black tracking-widest text-gray-500">Creative Tags</span>
                  <div className="flex flex-wrap gap-1.5 p-2 bg-white/5 rounded-xl border border-white/5">
                    {PRESET_LABELS.map((lbl) => (
                      <button
                        key={lbl}
                        onClick={() => toggleLabel(lbl, true)}
                        className={`text-[9px] uppercase font-black px-2.5 py-1 rounded-md transition-all ${
                          editLabels.includes(lbl) ? "bg-amber-500/20 text-amber-400 border border-amber-500/20" : "bg-white/5 text-gray-500 hover:bg-white/10"
                        }`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>

                  {currentNode && (
                    <div className="flex items-center justify-between p-2 bg-white/5 rounded-xl border border-white/5">
                      <span className="text-[9.5px] font-bold text-sky-400 flex items-center gap-1">
                        <Link className="w-3.5 h-3.5" />
                        Link to Current Node:
                      </span>
                      <button
                        onClick={() => setEditLinked(!editLinked)}
                        className={`text-[9.5px] font-black uppercase px-2.5 py-1 rounded-md transition-colors ${
                          editLinked ? "bg-sky-500/20 text-sky-400 border border-sky-500/30" : "bg-white/5 text-gray-400"
                        }`}
                      >
                        {editLinked ? "Linked" : "Link"}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Gemini Interactive Expand Assistant Drawer Segment */}
              <div className="border border-amber-500/25 bg-amber-500/5 p-4 rounded-xl space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-black uppercase text-amber-400">
                  <Sparkles className="w-4 h-4 animate-bounce" />
                  <span>Gemini Assistant AI</span>
                </div>
                <p className="text-[10px] text-gray-400 leading-relaxed font-semibold">
                  Select a workflow to enrich this note's outline with generative models. Creative output will be auto-appended inside!
                </p>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => invokeGeminiAssist("expand", false)}
                    disabled={aiLoading}
                    className="text-[10.5px] font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 py-2 rounded-lg border border-amber-500/20 flex flex-col items-center justify-center gap-1 disabled:opacity-50 transition-all shrink-0"
                  >
                    {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    <span>Expand Idea</span>
                  </button>
                  <button
                    onClick={() => invokeGeminiAssist("plot-twist", false)}
                    disabled={aiLoading}
                    className="text-[10.5px] font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 py-2 rounded-lg border border-amber-500/20 flex flex-col items-center justify-center gap-1 disabled:opacity-50 transition-all shrink-0"
                  >
                    {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                    <span>Plot Twists</span>
                  </button>
                  <button
                    onClick={() => invokeGeminiAssist("character-arc", false)}
                    disabled={aiLoading}
                    className="text-[10.5px] font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 py-2 rounded-lg border border-amber-500/20 flex flex-col items-center justify-center gap-1 disabled:opacity-50 transition-all shrink-0 col-span-2"
                  >
                    {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    <span>Develop Character Arc</span>
                  </button>
                </div>
              </div>

              {/* Edit Actions Save and Confirm */}
              <div className="flex items-center gap-3 pt-3">
                <button
                  onClick={saveEditedNote}
                  className="flex-1 text-xs uppercase font-black py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl transition-all font-bold text-center flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" /> Save Modifications
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Subcomponent: Keep Board Sticky Note Card
interface KeepCardProps {
  note: CreativeNote;
  currentNode: { sceneTitle: string } | null;
  onEdit: (note: CreativeNote) => void;
  onDelete: (noteId: string) => void;
  onTogglePin: (e: React.MouseEvent, note: CreativeNote) => void;
  onToggleCheck: (note: CreativeNote, itemIndex: number) => void;
  onJumpToScene?: (sceneTitle: string) => void;
}

function KeepCard({
  note,
  currentNode,
  onEdit,
  onDelete,
  onTogglePin,
  onToggleCheck,
  onJumpToScene
}: KeepCardProps) {
  const isCurrentlyLinked = currentNode && note.linkedSceneId === currentNode.sceneTitle;

  return (
    <motion.div
      layout
      whileHover={{ y: -2 }}
      onClick={() => onEdit(note)}
      className={`p-4 border rounded-2xl flex flex-col h-full cursor-pointer relative justify-between transition-all select-none hover:shadow-md ${note.color} ${
        isCurrentlyLinked ? "ring-2 ring-sky-500/60 shadow-lg scale-[1.01]" : ""
      }`}
    >
      {/* Pin & title bar */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-xs font-bold leading-relaxed pr-6 truncate">{note.title}</h4>
          <button
            onClick={(e) => onTogglePin(e, note)}
            className={`absolute top-3.5 right-3.5 p-1 rounded-md transition-colors ${
              note.pinned ? "text-amber-400 opacity-100" : "text-gray-500 hover:bg-white/10 opacity-40 hover:opacity-100"
            }`}
          >
            <Pin className="w-3.5 h-3.5 rotate-45" />
          </button>
        </div>

        {/* Content body based on type */}
        <div className="mt-2.5 text-[11px] leading-relaxed">
          {note.type === "text" ? (
            <div className="line-clamp-5 max-w-full overflow-hidden text-gray-300 font-medium whitespace-pre-line pr-1">
              <Markdown>{note.content || ""}</Markdown>
            </div>
          ) : (
            <div className="space-y-1 max-h-[140px] overflow-hidden pr-1">
              {note.listItems?.slice(0, 4).map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleCheck(note, idx);
                  }}
                >
                  <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                    item.checked ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-400" : "border-white/20 hover:border-white/35"
                  }`}>
                    {item.checked && <Check className="w-2.5 h-2.5" />}
                  </div>
                  <span className={`truncate font-semibold ${item.checked ? "line-through opacity-45 text-gray-500" : "text-gray-300"}`}>
                    {item.text}
                  </span>
                </div>
              ))}
              {note.listItems && note.listItems.length > 4 && (
                <p className="text-[9.5px] italic text-gray-500 pt-0.5 font-bold">
                  + {note.listItems.length - 4} more outline checkpoints
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tags and Linked Indicators */}
      <div className="mt-4 space-y-2">
        {/* Linked scene status block */}
        {note.linkedSceneId && (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-1.5 py-1 px-2.5 bg-sky-500/10 border border-sky-500/25 rounded-md text-[9.5px] font-bold text-sky-450 w-fit shrink-0">
              <Link className="w-3 h-3 text-sky-400 animate-pulse" />
              <span className="truncate max-w-[130px]" title={`Linked scene: "${note.linkedSceneId}"`}>
                Scene: {note.linkedSceneId}
              </span>
            </div>
            {onJumpToScene && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onJumpToScene(note.linkedSceneId!);
                }}
                className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-sky-400 bg-sky-500/15 hover:bg-sky-500/25 rounded border border-sky-500/20 transition-all flex items-center gap-1 shrink-0"
              >
                Go to Scene <ArrowRight className="w-3 h-3 text-sky-450" />
              </button>
            )}
          </div>
        )}

        {/* Bottom row: active labels & delete bin */}
        <div className="flex items-center justify-between border-t border-white/5 pt-1.5">
          <div className="flex flex-wrap gap-1">
            {note.labels?.slice(0, 2).map((lbl) => (
              <span
                key={lbl}
                className="text-[8.5px] font-black uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded-md border border-white/5 text-gray-400"
              >
                {lbl}
              </span>
            ))}
            {note.labels && note.labels.length > 2 && (
              <span className="text-[8.5px] font-bold text-gray-500">+ {note.labels.length - 2}</span>
            )}
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(note.id);
            }}
            className="p-1 hover:bg-white/10 hover:text-rose-400 text-gray-500 opacity-60 hover:opacity-100 rounded-md transition-colors"
            title="Delete sticky note"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

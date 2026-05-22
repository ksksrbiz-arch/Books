import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Play,
  Pause,
  Square,
  Volume2,
  Mic,
  MicOff,
  Send,
  Sparkles,
  MessageSquare,
  AudioLines,
  Settings as SettingsIcon,
  Flame,
  User,
  HelpCircle,
  VolumeX,
  Volume1,
  Languages
} from "lucide-react";

interface VoiceNarratorPanelProps {
  currentNode: any;
  genre: string | null;
  relationships: any;
  settings: any;
  setSettings: React.Dispatch<React.SetStateAction<any>>;
}

interface ChatMessage {
  id: string;
  sender: "player" | "narrator" | string;
  text: string;
  mood?: string;
  timestamp: Date;
}

export function VoiceNarratorPanel({
  currentNode,
  genre,
  relationships,
  settings,
  setSettings
}: VoiceNarratorPanelProps) {
  // Premium and Free Voice States
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>("google_assistant");
  const [voiceRate, setVoiceRate] = useState<number>(1.0);
  const [voicePitch, setVoicePitch] = useState<number>(1.0);
  const [autoNarrate, setAutoNarrate] = useState<boolean>(false);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Companion Chat State
  const [showCompanion, setShowCompanion] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Safe preset premium voice options configured on server
  const availablePremiumVoices = [
    { key: "google_assistant", name: "Google Natural Voice (Free, Built-In Server-Side)" },
    { key: "eleven_rachel", name: "Rachel (ElevenLabs Natural - Silk Feminine)" },
    { key: "eleven_adam", name: "Adam (ElevenLabs Natural - Deep Masculine)" },
    { key: "openai_nova", name: "Nova (OpenAI Natural - Saturated Feminine)" },
    { key: "openai_onyx", name: "Onyx (OpenAI Natural - Dynamic Masculine)" },
    { key: "openai_alloy", name: "Alloy (OpenAI Natural - Cozy Neutral)" },
  ];

  // Dynamic Browser OS Voice Loader
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const loadLocalVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      // Prioritize English voices for immersive narrative consistency
      const englishOnly = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
      setBrowserVoices(englishOnly.length > 0 ? englishOnly : voices);
    };

    loadLocalVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadLocalVoices;
    }
  }, []);

  // Cleanup active streams on component release
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Web Speech API: Speech Recognition Setup for Hands-Free Interaction
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "en-US";

      rec.onstart = () => {
        setIsListening(true);
      };

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputMessage(transcript);
        }
      };

      rec.onerror = (err: any) => {
        console.error("Speech Recognition Error:", err);
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }
  }, []);

  // Scroll to bottom of companion chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, showCompanion]);

  // Cancel any speech on dynamic scene node changes, then auto narrate if enabled
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
    setIsPaused(false);

    if (autoNarrate && currentNode?.sceneDescription) {
      const t = setTimeout(() => {
        handlePlaySpeech();
      }, 800);
      return () => clearTimeout(t);
    }
  }, [currentNode]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser. Please type your message.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
      recognitionRef.current.start();
    }
  };

  const handlePlaySpeech = async () => {
    if (!currentNode?.sceneDescription) return;

    if (selectedVoiceName.startsWith("browser_")) {
      if (typeof window === "undefined" || !window.speechSynthesis) return;
      if (isPaused) {
        window.speechSynthesis.resume();
        setIsPaused(false);
        setIsPlaying(true);
        return;
      }
      window.speechSynthesis.cancel();
      const realVoiceName = selectedVoiceName.substring("browser_".length);
      const voiceObj = browserVoices.find((v) => v.name === realVoiceName);
      
      const utterance = new SpeechSynthesisUtterance(currentNode.sceneDescription);
      if (voiceObj) {
        utterance.voice = voiceObj;
      }
      utterance.rate = voiceRate;
      utterance.pitch = voicePitch;
      utterance.onstart = () => {
        setIsPlaying(true);
        setIsPaused(false);
      };
      utterance.onend = () => {
        setIsPlaying(false);
        setIsPaused(false);
      };
      utterance.onerror = () => {
        setIsPlaying(false);
        setIsPaused(false);
      };
      window.speechSynthesis.speak(utterance);
      return;
    }

    if (isPaused && audioRef.current) {
      audioRef.current.play();
      setIsPaused(false);
      setIsPlaying(true);
      return;
    }

    // Stop current track
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setIsPlaying(true);
    setIsPaused(false);

    try {
      // Determine voice gender options dynamically
      const gender = genre === "romance" ? "female" : "neutral";
      const voiceParam = selectedVoiceName;
      const url = `/api/story/tts?text=${encodeURIComponent(currentNode.sceneDescription)}&gender=${gender}&voice=${voiceParam}`;
      
      const audio = new Audio(url);
      audioRef.current = audio;

      // Adjust speed on the elements
      audio.playbackRate = voiceRate;

      audio.onended = () => {
        setIsPlaying(false);
        setIsPaused(false);
      };

      audio.onerror = (err) => {
        console.warn("Server tts error, falling back to local SpeechSynthesis:", err);
        // Clean fallback to browser synthesis if audio blocks
        const fallbackUtteranceName = selectedVoiceName.startsWith("browser_") 
          ? selectedVoiceName.substring("browser_".length) 
          : "";
        if (typeof window !== "undefined" && window.speechSynthesis) {
          const utterance = new SpeechSynthesisUtterance(currentNode.sceneDescription);
          if (fallbackUtteranceName) {
            const voiceObj = browserVoices.find(v => v.name === fallbackUtteranceName);
            if (voiceObj) utterance.voice = voiceObj;
          }
          utterance.rate = voiceRate;
          utterance.pitch = voicePitch;
          utterance.onend = () => {
             setIsPlaying(false);
             setIsPaused(false);
          };
          window.speechSynthesis.speak(utterance);
        } else {
          setIsPlaying(false);
          setIsPaused(false);
        }
      };

      await audio.play();
    } catch (err) {
      console.error("[TTS Play failure]:", err);
      setIsPlaying(false);
      setIsPaused(false);
    }
  };

  const handlePauseSpeech = () => {
    if (selectedVoiceName.startsWith("browser_")) {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.pause();
        setIsPaused(true);
        setIsPlaying(false);
      }
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPaused(true);
      setIsPlaying(false);
    }
  };

  const handleStopSpeech = () => {
    if (selectedVoiceName.startsWith("browser_")) {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setIsPaused(false);
      setIsPlaying(false);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    // Also cancel standard window synthesis if it ever fired as fallback
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsPaused(false);
    setIsPlaying(false);
  };

  // Send Companion Message (Speech or Text) to Story AI
  const handleSendCompanion = async () => {
    if (!inputMessage.trim() || isSending || !currentNode) return;

    const playerMsg = inputMessage.trim();
    setInputMessage("");

    // Append player message immediately
    const playerMsgObj: ChatMessage = {
      id: Math.random().toString(),
      sender: "player",
      text: playerMsg,
      timestamp: new Date()
    };
    setChatMessages((prev) => [...prev, playerMsgObj]);
    setIsSending(true);

    try {
      const res = await fetch("/api/story/converse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneTitle: currentNode.sceneTitle,
          sceneDescription: currentNode.sceneDescription,
          userMessage: playerMsg,
          genre,
          relationships
        })
      });

      if (!res.ok) throw new Error("Conversation endpoint failed");
      const data = await res.json();

      const aiMsgObj: ChatMessage = {
        id: Math.random().toString(),
        sender: data.speaker || "Narrator",
        text: data.text || "The echoes fade away...",
        mood: data.mood || "mysterious",
        timestamp: new Date()
      };

      setChatMessages((prev) => [...prev, aiMsgObj]);

      // Automatically speak the companion reply!
      if (selectedVoiceName.startsWith("browser_")) {
        if (typeof window !== "undefined" && window.speechSynthesis) {
          window.speechSynthesis.cancel();
          const realVoiceName = selectedVoiceName.substring("browser_".length);
          const voiceObj = browserVoices.find((v) => v.name === realVoiceName);
          const utterance = new SpeechSynthesisUtterance(aiMsgObj.text);
          if (voiceObj) {
            utterance.voice = voiceObj;
          }
          utterance.rate = voiceRate;
          utterance.pitch = voicePitch;
          window.speechSynthesis.speak(utterance);
        }
      } else {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }

        const gender = aiMsgObj.sender !== "Narrator" ? "female" : "neutral";
        const companionTtsUrl = `/api/story/tts?text=${encodeURIComponent(aiMsgObj.text)}&gender=${gender}&voice=${selectedVoiceName}`;
        
        const audio = new Audio(companionTtsUrl);
        audioRef.current = audio;
        audio.playbackRate = voiceRate;

        audio.play().catch((e) => {
          console.warn("Companion voice autoplay error (usually gesture locked):", e);
          // Fallback to local browser speech output
          if (typeof window !== "undefined" && window.speechSynthesis) {
            const utterance = new SpeechSynthesisUtterance(aiMsgObj.text);
            utterance.rate = voiceRate;
            window.speechSynthesis.speak(utterance);
          }
        });
      }
    } catch (error) {
      console.error("Companion chat error:", error);
      const errObj: ChatMessage = {
        id: Math.random().toString(),
        sender: "Narrator",
        text: "The static of the veil blocks out your voice. No one answers...",
        mood: "distant",
        timestamp: new Date()
      };
      setChatMessages((prev) => [...prev, errObj]);
    } finally {
      setIsSending(false);
    }
  };

  // Genre aesthetic presets matching standard layouts
  const getColors = () => {
    switch (genre) {
      case "romance":
        return {
          btnActive: "bg-rose-500 hover:bg-rose-600 text-white shadow-rose-200",
          bubblePlayer: "bg-rose-500/10 text-rose-950 border border-rose-200/50",
          bubbleAI: "bg-white text-rose-900 border border-rose-100",
          textHighlight: "text-rose-600",
          accentColor: "rose",
          label: "Heartbeat Acoustics"
        };
      case "crime":
        return {
          btnActive: "bg-yellow-500 hover:bg-yellow-600 text-black font-semibold shadow-yellow-900/10",
          bubblePlayer: "bg-yellow-500/10 text-yellow-100 border border-yellow-500/20",
          bubbleAI: "bg-zinc-800 text-zinc-100 border border-zinc-700/50",
          textHighlight: "text-yellow-400",
          accentColor: "yellow",
          label: "Police Wiretap Feed"
        };
      case "paranormal":
      default:
        return {
          btnActive: "bg-purple-600 hover:bg-purple-700 text-white shadow-purple-900/40",
          bubblePlayer: "bg-purple-950/40 text-purple-200 border border-purple-500/20",
          bubbleAI: "bg-zinc-900 text-zinc-100 border border-zinc-800",
          textHighlight: "text-purple-400",
          accentColor: "purple",
          label: "Spirit Box EVP Terminal"
        };
    }
  };

  const col = getColors();

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Primary Voice Wave & Control Hub */}
      <div className="p-4 md:p-6 rounded-3xl border border-current/10 bg-black/15 backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Wave Animation and Active State */}
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className={`p-2.5 rounded-2xl bg-${col.accentColor}-500/10 border border-${col.accentColor}-500/20 text-current`}>
            {isPlaying ? (
              <AudioLines className={`w-5 h-5 animate-pulse ${col.textHighlight}`} />
            ) : (
              <Flame className={`w-5 h-5 opacity-60`} />
            )}
          </div>
          <div className="text-left">
            <h4 className="text-[10px] uppercase font-mono font-bold tracking-widest opacity-40">
              {col.label}
            </h4>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold font-sans">
                {isPlaying ? "Active Audio Playback" : isPaused ? "Playback Paused" : "Acoustic Synthesizer Idle"}
              </span>
              {autoNarrate && (
                <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">
                  AUTO
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Wave Spectrum if Playing */}
        {isPlaying && (
          <div className="flex items-end gap-1.5 h-6 opacity-80 py-1 hidden lg:flex">
            {[1, 2, 3, 4, 5, 4, 3, 2, 3, 4, 5, 2, 1].map((val, i) => (
              <motion.div
                key={i}
                className={`w-0.5 bg-current rounded-full`}
                style={{ height: "100%" }}
                animate={{
                  scaleY: [0.3, val * 0.2, 0.5, val * 0.15, 0.3],
                }}
                transition={{
                  duration: 0.8 + i * 0.05,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            ))}
          </div>
        )}

        {/* Audio controls */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          {/* Settings trigger */}
          <button
            onClick={() => setShowVoiceSettings(!showVoiceSettings)}
            className={`p-2.5 rounded-xl border border-current/10 hover:bg-white/10 transition-all ${
              showVoiceSettings ? "bg-white/10" : ""
            }`}
            title="Configure Synthesizer Narrator"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>

          {/* Speak Story Chat trigger */}
          <button
            onClick={() => setShowCompanion(!showCompanion)}
            className={`p-2.5 rounded-xl border border-current/10 hover:bg-white/10 transition-all flex items-center gap-1.5 ${
              showCompanion ? "bg-white/10" : ""
            }`}
            title="Converse and speak with narrative"
          >
            <MessageSquare className="w-4 h-4" />
            <span className="text-[10px] uppercase font-bold tracking-wider hidden sm:inline">
              Story Chat
            </span>
          </button>

          {/* Division Line */}
          <span className="h-5 w-[1px] bg-current/15 hidden sm:inline" />

          {/* Play/Pause */}
          <button
            onClick={isPlaying ? handlePauseSpeech : handlePlaySpeech}
            className={`flex items-center gap-1 text-xs font-bold px-4 py-2.5 rounded-xl transition-all ${
              isPlaying ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-100" : col.btnActive
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Narrate</span>
              </>
            )}
          </button>

          {/* Stop */}
          {(isPlaying || isPaused) && (
            <button
              onClick={handleStopSpeech}
              className="p-2.5 rounded-xl border border-current/10 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all"
              title="Stop Narration"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>
          )}
        </div>
      </div>

      {/* Voice Synthesis Settings Drawer */}
      <AnimatePresence>
        {showVoiceSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border border-current/10 rounded-2xl bg-black/10 text-left font-sans"
          >
            <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              {/* Voice Selector */}
              <div className="space-y-2.5">
                <label className="text-[10px] uppercase font-mono font-bold tracking-wider opacity-60 block flex items-center gap-1.5">
                  <Languages className="w-3.5 h-3.5" />
                  Selecting Synth Narrator Voice
                </label>
                <select
                  value={selectedVoiceName}
                  onChange={(e) => setSelectedVoiceName(e.target.value)}
                  className="w-full bg-black/45 border border-current/15 rounded-xl px-3.5 py-2.5 text-xs text-current font-medium focus:ring-1 focus:ring-current/20 focus:outline-none"
                >
                  <optgroup label="Server-Side Built-In & Premium" className="text-zinc-400 bg-zinc-950 font-bold">
                    {availablePremiumVoices.map((voice) => (
                      <option
                        key={voice.key}
                        value={voice.key}
                        className="text-zinc-200 bg-zinc-900 font-sans"
                      >
                        {voice.name}
                      </option>
                    ))}
                  </optgroup>
                  
                  {browserVoices.length > 0 && (
                    <optgroup label="Local Browser OS Voices (100% Free & Unlimited)" className="text-zinc-400 bg-zinc-950 font-bold">
                      {browserVoices.map((voice) => (
                        <option
                          key={voice.name}
                          value={`browser_${voice.name}`}
                          className="text-zinc-200 bg-zinc-900 font-sans"
                        >
                          Native: {voice.name} ({voice.lang})
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <span className="text-[10px] font-mono opacity-50 block leading-normal">
                  💡 <b>No Setup Required</b> for Google Built-In or Local Browser voices! They are completely free and unlimited. To enable ElevenLabs or OpenAI premium voices, paste your API keys in the app settings sidebar.
                </span>
              </div>

              {/* Sliders & Option Toggles */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Speech Rate Slider */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-mono uppercase tracking-wider opacity-60">
                      <span>Speaking Speed</span>
                      <span>{voiceRate.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="1.8"
                      step="0.1"
                      value={voiceRate}
                      onChange={(e) => setVoiceRate(parseFloat(e.target.value))}
                      className="w-full h-1 bg-current/15 rounded-lg appearance-none cursor-pointer accent-current"
                    />
                  </div>

                  {/* Speech Pitch Slider */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-mono uppercase tracking-wider opacity-60">
                      <span>Acoustic Pitch</span>
                      <span>{voicePitch.toFixed(1)}</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="1.5"
                      step="0.1"
                      value={voicePitch}
                      onChange={(e) => setVoicePitch(parseFloat(e.target.value))}
                      className="w-full h-1 bg-current/15 rounded-lg appearance-none cursor-pointer accent-current"
                    />
                  </div>
                </div>

                {/* Auto Play checkbox */}
                <div className="flex items-center justify-between p-2 rounded-xl border border-current/5 bg-black/10">
                  <div className="space-y-0.5">
                    <span className="font-bold block text-xs">Auto-read Scene Segments</span>
                    <span className="text-[10px] font-mono opacity-50 block leading-tight">
                      Reads dialogues and narrative automatically on choice paths.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoNarrate}
                    onChange={(e) => setAutoNarrate(e.target.checked)}
                    className="w-4.5 h-4.5 accent-current bg-transparent border-current rounded focus:ring-0 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Narrative Companion & Speak-to-Story drawer */}
      <AnimatePresence>
        {showCompanion && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            className="flex flex-col border border-current/10 rounded-2xl bg-black/15 overflow-hidden text-left"
          >
            {/* Companion Header */}
            <div className="p-4 border-b border-current/10 bg-black/20 flex items-center justify-between gap-4 font-sans text-xs">
              <div className="flex items-center gap-2">
                <Sparkles className={`w-4 h-4 animate-spin ${col.textHighlight}`} style={{ animationDuration: "10s" }} />
                <div>
                  <h4 className="font-bold uppercase tracking-wider leading-none">
                    Inter-Scene Dialogue EVP Box
                  </h4>
                  <span className="text-[9px] font-mono opacity-40">
                    EVP Spirit Speak / Live Audio Conversation
                  </span>
                </div>
              </div>
              <p className="text-[9px] font-mono border px-2 py-0.5 rounded-full border-current/20 opacity-60 uppercase">
                Active Ground
              </p>
            </div>

            {/* Conversational Screen logs */}
            <div className="p-4 md:p-6 space-y-4 max-h-[300px] overflow-y-auto font-mono scrollbar-thin">
              {chatMessages.length === 0 ? (
                <div className="py-8 text-center opacity-40 flex flex-col items-center justify-center gap-2">
                  <MessageSquare className="w-8 h-8 opacity-60" />
                  <p className="text-xs uppercase font-bold tracking-widest">
                    Quiet Broadcast
                  </p>
                  <p className="text-[10px] max-w-sm tracking-wide leading-relaxed">
                    Whisper to the room or speak details. Trigger speech recognition or type. Ex: &quot;Maya, did you see who passed?&quot; or &quot;Tell me more about the neon billboard...&quot;
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {chatMessages.map((msg) => {
                    const isPlayer = msg.sender === "player";
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col gap-1 max-w-[85%] ${
                          isPlayer ? "self-end items-end" : "self-start items-start"
                        }`}
                      >
                        {/* Timestamp or author */}
                        <span className="text-[9px] font-bold opacity-40 flex items-center gap-1.5 uppercase tracking-wide">
                          {!isPlayer && <User className="w-2.5 h-2.5" />}
                          {isPlayer ? "YOUR VOICE" : msg.sender}
                          {msg.mood && (
                            <span className="italic opacity-60 font-serif lowercase border-l pl-1 border-current/20">
                              [{msg.mood}]
                            </span>
                          )}
                        </span>
                        {/* Message body */}
                        <div
                          className={`p-3 rounded-2xl text-[11px] leading-relaxed ${
                            isPlayer ? col.bubblePlayer : col.bubbleAI
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Companion Feed Inputs */}
            <div className="p-4 border-t border-current/10 bg-black/20 flex items-center gap-2.5 font-sans">
              {/* Voice Microphone Input */}
              <button
                onClick={toggleListening}
                className={`p-3 rounded-xl border transition-all flex items-center justify-center ${
                  isListening
                    ? "bg-red-500 text-white animate-pulse border-red-400"
                    : "border-current/10 hover:bg-white/10"
                }`}
                title={isListening ? "Listening... Click to stop" : "Speak to story (Voice Mic)"}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              {/* Text Area */}
              <input
                type="text"
                placeholder={isListening ? "Hearing voice feedback..." : "Compose questions or whispers..."}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendCompanion()}
                disabled={isSending}
                className="flex-1 bg-black/40 border border-current/10 rounded-xl px-4 py-3 text-xs focus:ring-0 focus:outline-none placeholder-current/30 text-current"
              />

              {/* Send Button */}
              <button
                onClick={handleSendCompanion}
                disabled={!inputMessage.trim() || isSending}
                className={`p-3 rounded-xl flex items-center justify-center transition-all ${
                  inputMessage.trim() ? col.btnActive : "border border-current/10 opacity-45 cursor-not-allowed"
                }`}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  VolumeX
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { auth, db, googleProvider, OperationType, handleFirestoreError } from './lib/firebase';
import { audioManager, AudioMood } from './lib/audio';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  onSnapshot, 
  serverTimestamp,
  limit
} from 'firebase/firestore';

interface Choice {
  text: string;
  nextContext: string;
}

interface StoryNode {
  sceneTitle: string;
  sceneDescription: string;
  imagePrompt: string;
  mediaType: 'image' | 'video';
  choices: Choice[];
  mood: string;
  imageUrl?: string;
  videoUrl?: string;
}

type Genre = 'romance' | 'crime' | 'paranormal' | null;
type StoryLength = 'short' | 'medium' | 'epic';
type PlotComplexity = 'simple' | 'complex' | 'layered';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [genre, setGenre] = useState<Genre>(null);
  const [storyParameters, setStoryParameters] = useState<{
    length: StoryLength;
    archetype: string;
    complexity: PlotComplexity;
  }>({
    length: 'medium',
    archetype: '',
    complexity: 'complex'
  });
  const [showParameterSetup, setShowParameterSetup] = useState(false);
  const [currentNode, setCurrentNode] = useState<StoryNode | null>(null);
  const [history, setHistory] = useState<{sceneDescription: string, choiceTaken: string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [videoStatus, setVideoStatus] = useState<{status: 'idle' | 'generating' | 'downloading' | 'failed', progress?: string}>({ status: 'idle' });
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [currentStoryId, setCurrentStoryId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(true);

  // Scroll to top on node change
  const contentRef = useRef<HTMLDivElement>(null);

  // Audio effect
  useEffect(() => {
    let currentMood: AudioMood = 'none';
    if (currentNode && currentNode.mood) {
      currentMood = currentNode.mood as AudioMood;
    } else if (genre) {
      currentMood = genre as AudioMood;
    }
    audioManager.setMood(currentMood);
  }, [genre, currentNode]);

  const toggleMute = () => {
    const muted = audioManager.toggleMute();
    setIsMuted(muted);
  };

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
      if (u) {
        // Sync user profile safely
        const userRef = doc(db, 'users', u.uid);
        getDoc(userRef).then((docSnap) => {
          if (!docSnap.exists()) {
            setDoc(userRef, {
              uid: u.uid,
              email: u.email,
              displayName: u.displayName,
              photoURL: u.photoURL,
              createdAt: serverTimestamp()
            }).catch(err => handleFirestoreError(err, OperationType.CREATE, `users/${u.uid}`));
          } else {
            // Standard update without touching createdAt
            setDoc(userRef, {
              displayName: u.displayName,
              photoURL: u.photoURL,
            }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `users/${u.uid}`));
          }
        });
        
        // Try to resume active story
        resumeActiveStory(u.uid);
      } else {
        resetGame();
      }
    });
    return () => unsubscribe();
  }, []);

  const resumeActiveStory = async (uid: string) => {
    const storiesRef = collection(db, 'users', uid, 'stories');
    const q = query(storiesRef, where('status', '==', 'active'), orderBy('updatedAt', 'desc'), limit(1));
    try {
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const storyDoc = snapshot.docs[0];
        const storyData = storyDoc.data();
        setCurrentStoryId(storyDoc.id);
        setGenre(storyData.genre as Genre);
        setStoryParameters({
          length: (storyData.storyLength as StoryLength) || 'medium',
          archetype: storyData.characterArchetype || '',
          complexity: (storyData.plotComplexity as PlotComplexity) || 'complex'
        });
        
        // Fetch steps
        const stepsRef = collection(db, 'users', uid, 'stories', storyDoc.id, 'steps');
        const stepsSnapshot = await getDocs(query(stepsRef, orderBy('timestamp', 'asc')));
        const steps = stepsSnapshot.docs.map(d => ({
          sceneTitle: d.data().sceneTitle,
          sceneDescription: d.data().sceneDescription,
          imageUrl: d.data().imageUrl,
          videoUrl: d.data().videoUrl,
          choiceTaken: d.data().choiceTaken,
          choices: d.data().choices,
          imagePrompt: d.data().imagePrompt,
          mediaType: d.data().mediaType,
          mood: d.data().mood || 'mystery'
        }));
        
        setHistory(steps.filter(s => s.choiceTaken).map(s => ({
          sceneDescription: s.sceneDescription,
          choiceTaken: s.choiceTaken
        })));

        if (steps.length > 0) {
          const lastStep = steps[steps.length - 1];
          setCurrentNode({
            sceneTitle: lastStep.sceneTitle,
            sceneDescription: lastStep.sceneDescription,
            choices: lastStep.choices || [],
            imagePrompt: lastStep.imagePrompt || '',
            mediaType: lastStep.mediaType as any || 'image',
            mood: lastStep.mood,
            imageUrl: lastStep.imageUrl,
            videoUrl: lastStep.videoUrl
          });
        }
      }
    } catch (err) {
      console.error("Resuming failed", err);
    }
  };

  const login = async () => {
    try {
      // @ts-ignore
      if (window.show_aistudio_ui) {
        // @ts-ignore
        await window.show_aistudio_ui({ ui_type: "paid_model_flow" });
      }
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError("Login failed. Please try again.");
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
  };

  const confirmStartStory = async () => {
    if (!user || !genre) return;
    
    // Validation
    if (!storyParameters.archetype.trim()) {
      setError("Please define your character's archetype (e.g. Broken Detective, Fated Witch).");
      return;
    }

    setLoading(true);
    setError(null);
    setShowParameterSetup(false);
    try {
      let g = 'Romance';
      if (genre === 'crime') g = 'True Crime Noir';
      if (genre === 'paranormal') g = 'Paranormal Occult Indie';
      
      const response = await fetch('/api/story/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          genre: g,
          storyLength: storyParameters.length,
          characterArchetype: storyParameters.archetype,
          plotComplexity: storyParameters.complexity
        }),
      });
      if (!response.ok) throw new Error('Failed to start story');
      const data = await response.json();
      setCurrentNode(data);

      // Create story in Firestore
      const storyRef = await addDoc(collection(db, 'users', user.uid, 'stories'), {
        userId: user.uid,
        genre: genre,
        storyLength: storyParameters.length,
        characterArchetype: storyParameters.archetype,
        plotComplexity: storyParameters.complexity,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }).catch(err => handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/stories`));
      
      if (storyRef) {
        setCurrentStoryId(storyRef.id);
        // Add initial step
        await addDoc(collection(db, 'users', user.uid, 'stories', storyRef.id, 'steps'), {
          sceneTitle: data.sceneTitle,
          sceneDescription: data.sceneDescription,
          imageUrl: null,
          choiceTaken: null,
          imagePrompt: data.imagePrompt,
          mediaType: data.mediaType,
          choices: data.choices,
          timestamp: serverTimestamp()
        }).catch(err => handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/stories/${storyRef.id}/steps`));

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
    
    setLoading(true);
    setError(null);
    const newHistory = [...history, { 
      sceneDescription: currentNode.sceneDescription, 
      choiceTaken: choice.text 
    }];
    setHistory(newHistory);
    try {
      let g = 'Romance';
      if (genre === 'crime') g = 'True Crime Noir';
      if (genre === 'paranormal') g = 'Paranormal Occult Indie';

      const response = await fetch('/api/story/continue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          history: newHistory, 
          choice, 
          genre: g,
          storyLength: storyParameters.length,
          characterArchetype: storyParameters.archetype,
          plotComplexity: storyParameters.complexity
        }),
      });
      if (!response.ok) throw new Error('Failed to continue story');
      const data = await response.json();
      setCurrentNode(data);

      // Update Firestore
      await setDoc(doc(db, 'users', user.uid, 'stories', currentStoryId), {
        updatedAt: serverTimestamp()
      }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/stories/${currentStoryId}`));

      await addDoc(collection(db, 'users', user.uid, 'stories', currentStoryId, 'steps'), {
        sceneTitle: data.sceneTitle,
        sceneDescription: data.sceneDescription,
        imageUrl: null,
        videoUrl: null,
        choiceTaken: choice.text,
        imagePrompt: data.imagePrompt,
        mediaType: data.mediaType,
        choices: data.choices,
        timestamp: serverTimestamp()
      }).catch(err => handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/stories/${currentStoryId}/steps`));

      generateMedia(data.imagePrompt, data.mood, data.mediaType, currentStoryId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateMedia = async (prompt: string, mood: string, type: 'image' | 'video', storyId?: string | null) => {
    if (type === 'video') {
      await generateVideo(prompt, storyId);
    } else {
      await generateImage(prompt, mood, storyId);
    }
  };

  const generateVideo = async (prompt: string, storyId?: string | null) => {
    setVideoStatus({ status: 'generating' });
    setGenerationProgress(5);
    try {
      const startRes = await fetch('/api/story/video/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      if (!startRes.ok) throw new Error('Video generation failed to start');
      const { operationName } = await startRes.json();
      setGenerationProgress(15);

      // Poll for status
      let done = false;
      let pollCount = 0;
      while (!done) {
        await new Promise(r => setTimeout(r, 5000));
        pollCount++;
        // Simulate progress increasing slowly during polling
        setGenerationProgress(prev => {
          if (prev < 85) return prev + Math.max(1, (90 - prev) / 10);
          return prev;
        });

        const statusRes = await fetch('/api/story/video/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operationName }),
        });
        const statusData = await statusRes.json();
        done = statusData.done;
      }

      setGenerationProgress(90);
      setVideoStatus({ status: 'downloading' });
      const downloadRes = await fetch('/api/story/video/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operationName }),
      });
      if (!downloadRes.ok) throw new Error('Video download failed');
      
      setGenerationProgress(95);
      const blob = await downloadRes.blob();
      const videoUrl = URL.createObjectURL(blob);
      setGenerationProgress(100);
      setCurrentNode(prev => prev ? { ...prev, videoUrl, mediaType: 'video' } : null);

      if (user && storyId) {
        const stepsRef = collection(db, 'users', user.uid, 'stories', storyId, 'steps');
        const q = query(stepsRef, orderBy('timestamp', 'desc'), limit(1));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          // Note: Blobs can't be stored directly in Firestore, usually we'd upload to Storage.
          // For this preview, the blob is enough for the session resume if we don't refresh.
          // But to be consistent, we'd need a real URL.
          await setDoc(doc(db, 'users', user.uid, 'stories', storyId, 'steps', snapshot.docs[0].id), {
            videoUrl: 'local-blob-session' // Placeholder
          }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/stories/${storyId}/steps/${snapshot.docs[0].id}`));
        }
      }
    } catch (err) {
      console.error("Video gen failed", err);
      setVideoStatus({ status: 'failed' });
    } finally {
      setVideoStatus({ status: 'idle' });
      const currentProgress = generationProgress;
      if (currentProgress < 100) setGenerationProgress(0);
      else setTimeout(() => setGenerationProgress(0), 2000);
    }
  };

  const generateImage = async (prompt: string, mood: string, storyId?: string | null) => {
    setImageLoading(true);
    setGenerationProgress(10);
    // Fake progress interval for image
    const progressInterval = setInterval(() => {
      setGenerationProgress(prev => {
        if (prev < 90) return prev + 5;
        return prev;
      });
    }, 400);

    try {
      const response = await fetch('/api/story/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, mood }),
      });
      if (!response.ok) throw new Error('Failed to generate image');
      const data = await response.json();
      setGenerationProgress(100);
      setCurrentNode(prev => prev ? { ...prev, imageUrl: data.imageUrl } : null);

      // Update latest step with image URL if possible
      if (user && storyId) {
        const stepsRef = collection(db, 'users', user.uid, 'stories', storyId, 'steps');
        const q = query(stepsRef, orderBy('timestamp', 'desc'), limit(1));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          await setDoc(doc(db, 'users', user.uid, 'stories', storyId, 'steps', snapshot.docs[0].id), {
            imageUrl: data.imageUrl
          }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/stories/${storyId}/steps/${snapshot.docs[0].id}`));
        }
      }
    } catch (err) {
      console.error("Image gen failed", err);
    } finally {
      clearInterval(progressInterval);
      setImageLoading(false);
      setTimeout(() => setGenerationProgress(0), 1000);
    }
  };

  const resetGame = async () => {
    if (user && currentStoryId) {
      await setDoc(doc(db, 'users', user.uid, 'stories', currentStoryId), {
        status: 'completed',
        updatedAt: serverTimestamp()
      }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/stories/${currentStoryId}`));
    }
    setGenre(null);
    setStoryParameters({
      length: 'medium',
      archetype: '',
      complexity: 'complex'
    });
    setShowParameterSetup(false);
    setCurrentNode(null);
    setHistory([]);
    setError(null);
    setCurrentStoryId(null);
  };

  const themeClasses = genre === 'romance' 
    ? 'bg-[#FCF8F8] text-[#3D2626] font-sans selection:bg-rose-200 selection:text-rose-900 cursor-default' 
    : genre === 'crime'
    ? 'bg-[#0A0C10] text-[#E5E7EB] font-sans selection:bg-sky-900 selection:text-white cursor-crosshair'
    : genre === 'paranormal'
    ? 'bg-[#0D0A14] text-[#DBCFEF] font-sans selection:bg-purple-900 selection:text-white cursor-help'
    : 'bg-[#050505] text-white font-sans';

  const headingFont = genre === 'romance' ? 'font-serif italic' : genre === 'paranormal' ? 'font-serif italic tracking-wide' : 'font-display uppercase tracking-tight';
  const bodyFont = genre === 'romance' ? 'font-sans text-lg' : genre === 'paranormal' ? 'font-sans text-lg opacity-90' : 'font-mono text-base';

  return (
    <div className={`min-h-screen transition-all duration-1000 ease-in-out ${themeClasses} overflow-x-hidden`}>
      <div className="fixed inset-0 pointer-events-none z-0">
        {(genre === 'romance' || genre === 'paranormal') && (
          <>
            {[...Array(20)].map((_, i) => (
              <div 
                key={i}
                className={`absolute animate-float rounded-full blur-[2px] ${
                  genre === 'romance' ? 'bg-rose-200/20' : 'bg-purple-400/20'
                }`}
                style={{
                  left: `${Math.random() * 100}%`,
                  bottom: `-10vh`,
                  width: `${Math.random() * (genre === 'paranormal' ? 15 : 10) + 5}px`,
                  height: `${Math.random() * (genre === 'paranormal' ? 15 : 10) + 5}px`,
                  animationDuration: `${Math.random() * 10 + 10}s`,
                  animationDelay: `${Math.random() * 10}s`
                }}
              />
            ))}
          </>
        )}
        {genre === 'crime' && (
          <>
            <div className="absolute inset-0 noise-overlay opacity-[0.03] mix-blend-overlay" />
            <div className="absolute inset-0 scanline opacity-[0.05]" />
          </>
        )}
        {genre === 'paranormal' && (
           <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(88,28,135,0.05)_0%,transparent_70%)]" />
        )}
      </div>

      {/* Dynamic Background Gradient */}
      <div className={`fixed inset-0 pointer-events-none transition-opacity duration-1000 ${genre ? 'opacity-100' : 'opacity-0'}`}>
        <div className={`absolute inset-0 max-w-7xl mx-auto blur-[120px] opacity-20 ${
          genre === 'romance' 
            ? 'bg-[radial-gradient(circle_at_20%_30%,#fb7185_0%,transparent_50%),radial-gradient(circle_at_80%_70%,#f43f5e_0%,transparent_50%)]' 
            : genre === 'crime'
            ? 'bg-[radial-gradient(circle_at_20%_30%,#1e293b_0%,transparent_50%),radial-gradient(circle_at_80%_70%,#0f172a_0%,transparent_50%)]'
            : 'bg-[radial-gradient(circle_at_20%_30%,#581c87_0%,transparent_50%),radial-gradient(circle_at_80%_70%,#3b0764_0%,transparent_50%)]'
        }`} />
      </div>

      {/* HUD / Header */}
      <nav className={`fixed top-0 w-full z-50 p-6 border-b transition-all duration-700 ${
        genre === 'romance' 
          ? 'bg-white/40 border-rose-100/50' 
          : genre === 'crime'
          ? 'bg-black/40 border-white/5'
          : genre === 'paranormal'
          ? 'bg-black/20 border-purple-500/10'
          : 'bg-transparent border-transparent'
      } backdrop-blur-xl flex justify-between items-center`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl transition-colors duration-700 ${
            genre === 'romance' ? 'bg-rose-50' : genre === 'crime' ? 'bg-white/5 border border-white/5' : genre === 'paranormal' ? 'bg-purple-900/20 border border-purple-500/20' : 'bg-transparent'
          }`}>
            <Book className={`w-5 h-5 transition-colors duration-700 ${
              genre === 'romance' ? 'text-rose-500' : genre === 'crime' ? 'text-sky-400' : genre === 'paranormal' ? 'text-purple-400' : 'text-gray-400'
            }`} />
          </div>
          <span className={`text-xl font-black tracking-tighter transition-colors duration-700 ${genre === 'romance' ? 'text-rose-900' : 'text-white'}`}>
            Echoes
          </span>
        </div>
        <div className="flex items-center gap-4">
          {user && (
            <div className="hidden md:flex items-center gap-3 px-4 py-2 rounded-full bg-white/5 border border-white/5">
              {user.photoURL ? (
                <img src={user.photoURL} className="w-6 h-6 rounded-full border border-white/10" alt="" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center">
                  <UserIcon className="w-3 h-3 text-gray-400" />
                </div>
              )}
              <span className="text-[10px] font-bold tracking-widest uppercase opacity-60 truncate max-w-[100px]">
                {user.displayName || user.email?.split('@')[0]}
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
          <button
            onClick={toggleMute}
            className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
              genre === 'romance' 
                ? 'text-rose-400 hover:bg-rose-50' 
                : genre === 'paranormal'
                ? 'text-purple-400 hover:bg-purple-500/10'
                : 'text-gray-400 hover:bg-white/5'
            }`}
            title={isMuted ? "Unmute Ambient Sound" : "Mute Ambient Sound"}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          {genre && (
            <button 
              onClick={resetGame}
              className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] transition-all px-4 py-2 rounded-full border ${
                genre === 'romance' 
                  ? 'border-rose-100 text-rose-400 hover:bg-rose-50' 
                  : genre === 'paranormal'
                  ? 'border-purple-500/20 text-purple-400 hover:bg-purple-500/10'
                  : 'border-white/10 text-gray-500 hover:bg-white/5'
              }`}
            >
              <RefreshCcw className="w-3 h-3" />
              New Fate
            </button>
          )}
        </div>
      </nav>

      <main className="pt-32 pb-20 px-6 max-w-5xl mx-auto min-h-screen relative z-10 flex flex-col">
        {authLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-12 h-12 animate-spin opacity-10" />
          </div>
        ) : !user ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex flex-col justify-center items-center text-center gap-12"
          >
             <div className="w-24 h-24 bg-gradient-to-tr from-rose-500 to-sky-500 rounded-[2rem] flex items-center justify-center shadow-2xl relative overflow-hidden group">
               <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
               <Sparkles className="w-10 h-10 text-white" />
             </div>
             <div className="space-y-4">
               <h2 className="text-5xl font-black tracking-tighter uppercase leading-none">Vast Oceans <br/> await</h2>
               <p className="text-gray-500 max-w-sm mx-auto font-medium">To carve your path through the Universe Sea, we must anchor your soul.</p>
             </div>
             <button 
              onClick={login}
              className="flex items-center gap-3 bg-white text-black px-10 py-5 rounded-full font-black uppercase tracking-[0.2em] shadow-2xl hover:scale-105 active:scale-95 transition-all text-sm"
             >
               <LogIn className="w-5 h-5" />
               Login with Google
             </button>
          </motion.div>
        ) : !genre ? (
          <AnimatePresence>
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex-1 flex flex-col justify-center items-center text-center gap-16"
            >
              <div className="space-y-6">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className="inline-block px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 mb-4"
                >
                  Interactive AI Narrative
                </motion.div>
                <motion.h1 
                  className="text-7xl md:text-9xl font-black mb-4 tracking-tighter leading-[0.8]"
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                >
                  CHOOSE <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-sky-400">YOUR FATE</span>
                </motion.h1>
                <p className="text-gray-500 max-w-lg mx-auto text-lg leading-relaxed font-medium">
                  Step into a world where every word is generated for you. Your decisions aren't just paths—they are architectures of reality.
                </p>
              </div>

              <div className="flex flex-col md:flex-row gap-8 w-full max-w-5xl">
                <button 
                  onClick={() => startStory('romance')}
                  className="group relative flex-1 aspect-[10/13] bg-white border border-rose-100 rounded-[2.5rem] overflow-hidden shadow-2xl hover:shadow-rose-200/50 transition-all duration-700 transform hover:-translate-y-4 flex flex-col justify-end p-10 text-left"
                >
                  <img 
                    src="/src/assets/images/genre_romance_card_1779164930713.png" 
                    className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-100 group-hover:scale-105 transition-all duration-1000 pointer-events-none"
                    alt="Romance"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-white via-white/20 to-transparent opacity-90" />
                  <div className="relative">
                    <div className="w-14 h-14 bg-rose-500 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-rose-200">
                      <Heart className="w-7 h-7 text-white" />
                    </div>
                    <h2 className="text-4xl font-black text-rose-900 leading-none mb-3 font-serif italic">Rose & Rapture</h2>
                    <p className="text-rose-700/70 text-sm font-medium leading-relaxed">A story of yearning and emotional truth.</p>
                  </div>
                </button>

                <button 
                  onClick={() => startStory('crime')}
                  className="group relative flex-1 aspect-[10/13] bg-zinc-950 border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl hover:shadow-black/70 transition-all duration-700 transform hover:-translate-y-4 flex flex-col justify-end p-10 text-left"
                >
                  <img 
                    src="/src/assets/images/genre_crime_card_1779164947927.png" 
                    className="absolute inset-0 w-full h-full object-cover opacity-20 group-hover:opacity-60 group-hover:scale-105 transition-all duration-1000 pointer-events-none grayscale"
                    alt="Crime"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-95" />
                  <div className="relative text-white">
                    <div className="w-14 h-14 bg-zinc-800 rounded-2xl flex items-center justify-center mb-6 border border-white/10">
                      <Skull className="w-7 h-7 text-white" />
                    </div>
                    <h2 className="text-4xl font-black text-white leading-none mb-3 font-display uppercase tracking-tight">Shadows & Sin</h2>
                    <p className="text-gray-500 text-sm font-medium leading-relaxed font-mono">Grit, mystery, and the pursuit of truth.</p>
                  </div>
                </button>

                <button 
                  onClick={() => startStory('paranormal')}
                  className="group relative flex-1 aspect-[10/13] bg-[#1a1025] border border-purple-500/10 rounded-[2.5rem] overflow-hidden shadow-2xl hover:shadow-purple-900/50 transition-all duration-700 transform hover:-translate-y-4 flex flex-col justify-end p-10 text-left"
                >
                  <img 
                    src="/src/assets/images/genre_paranormal_card_1779164962472.png" 
                    className="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:opacity-70 group-hover:scale-105 transition-all duration-1000 pointer-events-none"
                    alt="Paranormal"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0d0a14] via-[#0d0a14]/40 to-transparent opacity-95" />
                  <div className="relative text-purple-100">
                    <div className="w-14 h-14 bg-purple-900/30 rounded-2xl flex items-center justify-center mb-6 border border-purple-500/20 backdrop-blur-md">
                      <Moon className="w-7 h-7 text-purple-400" />
                    </div>
                    <h2 className="text-4xl font-black text-white leading-none mb-3 font-serif italic tracking-wide">Paranormal Romance</h2>
                    <p className="text-purple-400/70 text-sm font-medium leading-relaxed font-mono uppercase tracking-[0.1em]">The Universe Sea await</p>
                  </div>
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        ) : showParameterSetup ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex flex-col justify-center items-center max-w-2xl mx-auto w-full gap-8"
          >
            <div className="text-center space-y-4">
              <h2 className={`text-4xl font-black uppercase tracking-tight ${genre === 'romance' ? 'text-rose-900 font-serif italic' : 'text-white'}`}>
                Define Your Fate
              </h2>
              <p className="text-gray-500 font-medium">Configure the tapestry of your story before we weave it.</p>
            </div>

            <div className={`w-full p-8 rounded-[2rem] border space-y-8 ${
              genre === 'romance' ? 'bg-white border-rose-100 shadow-xl' : 'bg-white/5 border-white/10 backdrop-blur-xl'
            }`}>
              <div className="space-y-4">
                <label className="text-[10px] uppercase font-black tracking-widest opacity-40">Character Archetype</label>
                <input 
                  type="text"
                  placeholder="e.g. A disgraced detective seeking redemption..."
                  value={storyParameters.archetype}
                  onChange={(e) => setStoryParameters(p => ({ ...p, archetype: e.target.value }))}
                  className={`w-full p-4 rounded-2xl border bg-transparent transition-all outline-none focus:ring-2 ${
                    genre === 'romance' 
                      ? 'border-rose-100 focus:border-rose-300 focus:ring-rose-100 text-rose-900 placeholder:text-rose-200' 
                      : 'border-white/10 focus:border-sky-400 focus:ring-sky-500/20 text-white placeholder:text-white/20'
                  }`}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <label className="text-[10px] uppercase font-black tracking-widest opacity-40">Story Depth (Length)</label>
                  <div className="flex flex-col gap-2">
                    {(['short', 'medium', 'epic'] as StoryLength[]).map(l => (
                      <button
                        key={l}
                        onClick={() => setStoryParameters(p => ({ ...p, length: l }))}
                        className={`p-3 text-left rounded-xl border text-xs font-bold uppercase tracking-widest transition-all ${
                          storyParameters.length === l
                            ? genre === 'romance' 
                              ? 'bg-rose-500 border-rose-500 text-white' 
                              : 'bg-sky-500 border-sky-500 text-white'
                            : genre === 'romance'
                              ? 'border-rose-100 text-rose-300 hover:bg-rose-50'
                              : 'border-white/10 text-white/40 hover:bg-white/5'
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] uppercase font-black tracking-widest opacity-40">Plot Complexity</label>
                  <div className="flex flex-col gap-2">
                    {(['simple', 'complex', 'layered'] as PlotComplexity[]).map(c => (
                      <button
                        key={c}
                        onClick={() => setStoryParameters(p => ({ ...p, complexity: c }))}
                        className={`p-3 text-left rounded-xl border text-xs font-bold uppercase tracking-widest transition-all ${
                          storyParameters.complexity === c
                            ? genre === 'romance' 
                              ? 'bg-rose-500 border-rose-500 text-white' 
                              : 'bg-sky-500 border-sky-500 text-white'
                            : genre === 'romance'
                              ? 'border-rose-100 text-rose-300 hover:bg-rose-50'
                              : 'border-white/10 text-white/40 hover:bg-white/5'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {error && <p className="text-red-500 text-[10px] font-bold uppercase text-center">{error}</p>}

              <button
                onClick={confirmStartStory}
                className={`w-full py-5 rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-3 ${
                  genre === 'romance' ? 'bg-rose-500 text-white' : 'bg-white text-black'
                }`}
              >
                <Zap className="w-5 h-5" />
                Begin Narrative
              </button>
              
              <button 
                onClick={() => setGenre(null)}
                className="w-full text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity"
              >
                Go Back
              </button>
            </div>
          </motion.div>
        ) : (
          <div className="flex-1 flex flex-col relative" ref={contentRef}>
            {loading && !currentNode && (
              <div className="flex-1 flex flex-col items-center justify-center gap-8">
                <motion.div 
                  animate={{ 
                    rotate: 360,
                    scale: [1, 1.2, 1]
                  }}
                  transition={{ 
                    rotate: { repeat: Infinity, duration: 3, ease: "linear" },
                    scale: { repeat: Infinity, duration: 2 }
                  }}
                  className={`w-20 h-20 rounded-[2rem] flex items-center justify-center border-2 ${
                    genre === 'romance' ? 'border-rose-100' : 'border-white/10'
                  }`}
                >
                  <Sparkles className={`w-8 h-8 ${genre === 'romance' ? 'text-rose-400' : 'text-sky-400'}`} />
                </motion.div>
                <div className="text-center space-y-2">
                  <h3 className="font-black text-2xl tracking-tight uppercase">Spinning Reality</h3>
                  <p className="text-sm opacity-40 font-mono tracking-widest uppercase">The universe is listening...</p>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-3xl text-red-500 text-sm mb-12 flex items-center justify-between">
                <span>{error}</span>
                <button onClick={() => genre && startStory(genre)} className="font-black uppercase tracking-widest text-[10px] bg-red-500 text-white px-4 py-2 rounded-full">Retry Connection</button>
              </div>
            )}

            {currentNode && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                key={currentNode.sceneTitle}
                className="flex flex-col gap-12 pb-32"
              >
                {/* Scene Visual Container */}
                <div className="relative group">
                  <div className={`absolute inset-0 blur-3xl opacity-20 -z-10 group-hover:opacity-40 transition-opacity duration-1000 ${
                    genre === 'romance' ? 'bg-rose-400' : 'bg-sky-900'
                  }`} />
                  <div className={`relative w-full aspect-video md:aspect-[21/9] rounded-[2.5rem] overflow-hidden flex items-center justify-center shadow-2xl border transition-all duration-700 ${
                    genre === 'romance' ? 'bg-rose-50 border-rose-100/50' : genre === 'paranormal' ? 'bg-[#1a1025] border-purple-500/10' : 'bg-black border-white/5'
                  }`}>
                    {currentNode.mediaType === 'video' && currentNode.videoUrl ? (
                      <motion.video 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        src={currentNode.videoUrl} 
                        className="w-full h-full object-cover"
                        autoPlay 
                        loop 
                        muted 
                        playsInline
                      />
                    ) : currentNode.imageUrl ? (
                      <motion.img 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        src={currentNode.imageUrl} 
                        className="w-full h-full object-cover"
                        alt="Scene Visual"
                        referrerPolicy="no-referrer"
                      />
                    ) : imageLoading || videoStatus.status !== 'idle' ? (
                      <div className="flex flex-col items-center gap-8 w-full max-w-sm px-6">
                        <div className="relative">
                           <Loader2 className={`w-20 h-20 animate-spin ${
                             genre === 'romance' ? 'text-rose-200' : genre === 'paranormal' ? 'text-purple-400' : 'text-sky-400'
                           }`} />
                           <Sparkles className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 animate-pulse ${
                             genre === 'romance' ? 'text-rose-400' : 'text-white'
                           }`} />
                        </div>
                        
                        <div className="w-full space-y-4">
                          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${generationProgress}%` }}
                              className={`h-full ${
                                genre === 'romance' ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]' : 'bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.5)]'
                              }`}
                            />
                          </div>
                          
                          <div className="text-center space-y-1">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[10px] uppercase font-black tracking-[0.2em] opacity-40">
                                {videoStatus.status !== 'idle' ? `Cinematic ${videoStatus.status}` : 'Neural Rendering'}
                              </span>
                              <span className="text-[10px] font-mono font-bold opacity-60">
                                {Math.round(generationProgress)}%
                              </span>
                            </div>
                            <span className="block text-[8px] uppercase font-mono tracking-widest opacity-20 italic">
                              {videoStatus.status !== 'idle' ? 'This takes longer to weave high-fidelity motion...' : 'Drawing from the deep Universe Sea...'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <Camera className="w-16 h-16 opacity-5" />
                    )}
                    
                    <div className="absolute top-8 left-8 flex gap-3">
                       <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] backdrop-blur-xl border flex items-center gap-2 ${
                         genre === 'romance' ? 'bg-white/60 border-rose-100 text-rose-900' : genre === 'paranormal' ? 'bg-purple-900/60 border-purple-500/20 text-purple-200' : 'bg-black/60 border-white/10 text-white'
                       }`}>
                         <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${genre === 'romance' ? 'bg-rose-500' : 'bg-purple-400'}`} />
                         {currentNode.mediaType === 'video' ? 'Cinematic Flow' : 'Neural Canvas'}
                       </div>
                    </div>
                  </div>
                </div>

                {/* Content Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-16 lg:gap-24">
                  {/* Left Column: Story */}
                  <div className="space-y-10">
                    <div className="space-y-6">
                      <div className="flex items-center gap-4">
                         <span className={`h-[1px] flex-1 ${genre === 'romance' ? 'bg-rose-100' : genre === 'paranormal' ? 'bg-purple-900/30' : 'bg-white/5'}`} />
                         <span className={`text-[10px] uppercase tracking-[0.4em] font-black px-3 py-1 rounded-full ${
                            genre === 'romance' ? 'text-rose-400 bg-rose-50' : genre === 'paranormal' ? 'text-purple-400 bg-purple-900/20' : 'text-gray-500 bg-white/5'
                          }`}>
                            Entry {history.length + 1}
                          </span>
                      </div>
                      <h2 className={`text-5xl md:text-8xl leading-[0.85] transition-all duration-1000 ${headingFont} ${
                        genre === 'romance' ? 'text-rose-950 font-black' : genre === 'paranormal' ? 'text-white drop-shadow-[0_0_30px_rgba(168,85,247,0.2)]' : 'text-white drop-shadow-[0_0_20px_rgba(56,189,248,0.2)]'
                      }`}>
                        {currentNode.sceneTitle}
                      </h2>
                    </div>

                    <div className={`prose max-w-none leading-relaxed transition-all duration-700 hyphens-auto ${bodyFont} ${
                      genre === 'romance' ? 'text-rose-900/80' : genre === 'paranormal' ? 'text-purple-200/70' : 'text-gray-400'
                    }`}>
                      <ReactMarkdown>{currentNode.sceneDescription}</ReactMarkdown>
                    </div>
                  </div>

                  {/* Right Column: Choices */}
                  <div className="relative">
                    <div className={`sticky top-32 space-y-8 p-10 rounded-[2.5rem] border transition-all duration-700 ${
                       genre === 'romance' 
                        ? 'bg-white border-rose-100/50 shadow-xl shadow-rose-200/20' 
                        : genre === 'paranormal'
                        ? 'bg-black/40 border-purple-500/10 backdrop-blur-md shadow-2xl shadow-purple-900/20'
                        : 'bg-zinc-900/50 border-white/5 backdrop-blur-md'
                    }`}>
                       <h4 className={`text-[10px] uppercase tracking-[0.3em] font-black mb-8 ${
                         genre === 'romance' ? 'text-rose-400' : genre === 'paranormal' ? 'text-purple-400' : 'text-gray-500'
                       }`}>
                         Path selection
                       </h4>
                       
                       {!loading ? (
                        <div className="flex flex-col gap-4">
                          {currentNode.choices?.map((choice, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleChoice(choice)}
                              className={`group relative p-6 text-left border rounded-3xl transition-all duration-500 transform active:scale-95 ${
                                genre === 'romance' 
                                  ? 'bg-white border-rose-100 hover:border-rose-400 hover:shadow-lg hover:shadow-rose-100 text-rose-950' 
                                  : genre === 'paranormal'
                                  ? 'bg-black/60 border-purple-500/10 hover:border-purple-400/50 hover:bg-black/80 text-purple-100'
                                  : 'bg-black/40 border-white/5 hover:border-sky-500/50 hover:bg-black/60 text-white'
                              }`}
                            >
                              <div className="flex items-start gap-4">
                                <div className={`mt-1.5 w-1.5 h-1.5 rounded-full transition-all duration-500 group-hover:scale-150 ${
                                  genre === 'romance' ? 'bg-rose-300 group-hover:bg-rose-500' : genre === 'paranormal' ? 'bg-purple-600 group-hover:bg-purple-400' : 'bg-sky-900 group-hover:bg-sky-400'
                                }`} />
                                <span className={`flex-1 font-bold leading-tight ${genre === 'romance' ? 'text-base' : 'text-sm font-sans'}`}>
                                  {choice.text}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-6 py-12 text-center">
                          <Loader2 className={`w-8 h-8 animate-spin ${genre === 'romance' ? 'text-rose-300' : genre === 'paranormal' ? 'text-purple-500' : 'text-sky-900'}`} />
                          <div className="space-y-1">
                            <div className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Calculating Fate</div>
                            <div className="text-xs opacity-30 italic">Actions carry weight...</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </main>

      {/* History Sidebar - Optional toggle */}
      {history.length > 0 && genre && (
        <div className="fixed bottom-6 right-6 z-50">
           <button 
             onClick={() => setShowHistory(true)}
             className={`p-4 rounded-full shadow-2xl backdrop-blur-xl border transition-transform hover:scale-110 ${
             genre === 'romance' ? 'bg-white/80 border-rose-100 text-rose-500' : 'bg-black/80 border-white/10 text-gray-400'
           }`}>
             <History className="w-5 h-5" />
           </button>
        </div>
      )}

      {/* History Modal Overlay */}
      <AnimatePresence>
        {showHistory && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={`fixed top-0 right-0 h-full w-full max-w-md z-[101] shadow-2xl border-l flex flex-col ${
                genre === 'romance' ? 'bg-[#FDF6F6] border-rose-100 text-[#4A2B2B]' : 'bg-[#0F1115] border-white/10 text-[#D1D5DB]'
              }`}
            >
              <div className="p-8 border-b border-inherit flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <History className="w-5 h-5 opacity-60" />
                  <h3 className="font-black text-xl tracking-tight uppercase">Journey Log</h3>
                </div>
                <button 
                  onClick={() => setShowHistory(false)}
                  className="p-2 hover:bg-black/5 rounded-full transition-colors"
                >
                  <RefreshCcw className={`w-5 h-5 rotate-45 ${genre === 'paranormal' ? 'text-purple-400' : ''}`} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                {history.length === 0 ? (
                  <div className="text-center opacity-40 mt-12 italic">Your story is just beginning...</div>
                ) : (
                  history.map((item, idx) => (
                    <div key={idx} className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                          genre === 'romance' ? 'bg-rose-100 text-rose-500' : genre === 'paranormal' ? 'bg-purple-900/40 text-purple-400' : 'bg-zinc-800 text-gray-400'
                        }`}>
                          {idx + 1}
                        </div>
                        <div className="h-px flex-1 bg-current opacity-10" />
                      </div>
                      <div className="opacity-60 text-sm leading-relaxed italic">
                        "...{item.sceneDescription.slice(0, 150)}..."
                      </div>
                      <div className={`p-4 rounded-xl font-bold border ${
                        genre === 'romance' ? 'bg-white border-rose-100' : genre === 'paranormal' ? 'bg-black/40 border-purple-500/10' : 'bg-zinc-900 border-white/5'
                      }`}>
                        You chose: <span className={`${genre === 'romance' ? 'text-rose-500' : genre === 'paranormal' ? 'text-purple-400' : 'text-sky-400'} underline decoration-current/30 underline-offset-4`}>{item.choiceTaken}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

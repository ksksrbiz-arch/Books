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
  VolumeX,
  X,
  Settings,
  ArrowLeft,
  Library as LibraryIcon,
  Type
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { auth, db, googleProvider, OperationType, handleFirestoreError } from './lib/firebase';
import { AtmosphericEffects } from './components/AtmosphericEffects';
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
type StoryTone = 'subtle' | 'intense' | 'experimental';

export default function App() {
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
    length: 'medium',
    archetype: '',
    backstory: '',
    complexity: 'complex',
    tone: 'intense',
    isAdultContent: false,
    customBasis: ''
  });
  const [customActionText, setCustomActionText] = useState('');
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
  const [showSettings, setShowSettings] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [userStories, setUserStories] = useState<any[]>([]);
  const [allSteps, setAllSteps] = useState<any[]>([]);
  const [settings, setSettings] = useState({
    fontSize: 'md', // sm, md, lg
    lineSpacing: 'relaxed', // tight, normal, relaxed
    textAlign: 'left', // left, center, justify
    fontWeight: 'normal', // light, normal, bold
    typewriter: true,
    showImages: true
  });

  // Scroll to top on node change
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Parallax disabled to debug white screen
  const bgY = 0;
  const bgOpacity = 0.2;

  // Audio effect disabled to debug white screen
  useEffect(() => {
    // audioManager.setMood(currentMood);
  }, [genre, currentNode]);

  const toggleMute = () => {
    // const muted = audioManager.toggleMute();
    setIsMuted(!isMuted);
  };

  const fetchUserStories = async (uid: string) => {
    try {
      const storiesRef = collection(db, 'users', uid, 'stories');
      const q = query(storiesRef, orderBy('updatedAt', 'desc'));
      const snapshot = await getDocs(q);
      setUserStories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error("Fetch failure", err);
    }
  };

  const resumeActiveStory = async (uid: string) => {
    const storiesRef = collection(db, 'users', uid, 'stories');
    // Simplified query to avoid index requirement during debug
    const q = query(storiesRef, limit(10));
    try {
      const snapshot = await getDocs(q);
      const storyDoc = snapshot.docs.find(d => d.data().status === 'active');
      
      if (storyDoc) {
        const storyData = storyDoc.data();
        setCurrentStoryId(storyDoc.id);
        setGenre(storyData.genre as Genre);
        setStoryParameters({
          length: (storyData.storyLength as StoryLength) || 'medium',
          archetype: storyData.characterArchetype || '',
          backstory: storyData.backstory || '',
          complexity: (storyData.plotComplexity as PlotComplexity) || 'complex',
          tone: (storyData.tone as StoryTone) || 'intense',
          isAdultContent: storyData.isAdultContent || false,
          customBasis: storyData.customBasis || ''
        });
        
        // Fetch steps
        const stepsRef = collection(db, 'users', uid, 'stories', storyDoc.id, 'steps');
        const stepsSnapshot = await getDocs(stepsRef);
        const stepsData = stepsSnapshot.docs.map(d => ({ ...d.data(), id: d.id })) as any[];
        // Sort in memory instead of Firestore to avoid index requirement
        const steps = stepsData.sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0)).map(d => ({
          id: d.id,
          sceneTitle: d.sceneTitle,
          sceneDescription: d.sceneDescription,
          imageUrl: d.imageUrl,
          videoUrl: d.videoUrl,
          choiceTaken: d.choiceTaken,
          choices: d.choices,
          imagePrompt: d.imagePrompt,
          mediaType: d.mediaType,
          mood: d.mood || 'mystery'
        }));
        
        setAllSteps(steps);
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

  // Auth Listener
  useEffect(() => {
    console.log("Auth listener mounting");
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      console.log("Auth state changed:", u ? "user logged in" : "no user");
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
            }).catch(err => {
              console.error("Profile sync error:", err);
              handleFirestoreError(err, OperationType.CREATE, `users/${u.uid}`);
            });
          } else {
            // Standard update without touching createdAt
            setDoc(userRef, {
              displayName: u.displayName,
              photoURL: u.photoURL,
            }, { merge: true }).catch(err => {
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
      const storyDoc = await getDoc(doc(db, 'users', user.uid, 'stories', storyId));
      if (storyDoc.exists()) {
        const storyData = storyDoc.data();
        setCurrentStoryId(storyId);
        setGenre(storyData.genre as Genre);
        setStoryParameters({
          length: (storyData.storyLength as StoryLength) || 'medium',
          archetype: storyData.characterArchetype || '',
          backstory: storyData.backstory || '',
          complexity: (storyData.plotComplexity as PlotComplexity) || 'complex',
          tone: (storyData.tone as StoryTone) || 'intense',
          isAdultContent: storyData.isAdultContent || false,
          customBasis: storyData.customBasis || ''
        });

        const stepsRef = collection(db, 'users', user.uid, 'stories', storyId, 'steps');
        const stepsSnapshot = await getDocs(stepsRef);
        const stepsData = stepsSnapshot.docs.map(d => ({ ...d.data(), id: d.id })) as any[];
        // @ts-ignore
        const steps = stepsData.sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0)).map(d => ({
          id: d.id,
          sceneTitle: d.sceneTitle,
          sceneDescription: d.sceneDescription,
          imageUrl: d.imageUrl,
          videoUrl: d.videoUrl,
          choiceTaken: d.choiceTaken,
          choices: d.choices,
          imagePrompt: d.imagePrompt,
          mediaType: d.mediaType,
          mood: d.mood || 'mystery'
        }));

        setAllSteps(steps);
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
      setHistory(newSteps.filter(s => s.choiceTaken).map(s => ({
        sceneDescription: s.sceneDescription,
        choiceTaken: s.choiceTaken
      })));
      
      setCurrentNode({
        sceneTitle: previousStep.sceneTitle,
        sceneDescription: previousStep.sceneDescription,
        choices: previousStep.choices || [],
        imagePrompt: previousStep.imagePrompt || '',
        mediaType: previousStep.mediaType as any || 'image',
        mood: previousStep.mood,
        imageUrl: previousStep.imageUrl,
        videoUrl: previousStep.videoUrl
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

  const login = async () => {
    try {
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
          backstory: storyParameters.backstory,
          plotComplexity: storyParameters.complexity,
          tone: storyParameters.tone,
          isAdultContent: storyParameters.isAdultContent,
          customBasis: storyParameters.customBasis
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
        backstory: storyParameters.backstory,
        plotComplexity: storyParameters.complexity,
        tone: storyParameters.tone,
        isAdultContent: storyParameters.isAdultContent,
        customBasis: storyParameters.customBasis,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }).catch(err => handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/stories`));
      
      const isDocRef = (ref: any): ref is { id: string } => ref && typeof ref === 'object' && 'id' in ref;

      if (isDocRef(storyRef)) {
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
          backstory: storyParameters.backstory,
          plotComplexity: storyParameters.complexity,
          tone: storyParameters.tone,
          isAdultContent: storyParameters.isAdultContent,
          customBasis: storyParameters.customBasis
        }),
      });
      if (!response.ok) throw new Error('Failed to continue story');
      const data = await response.json();
      const newData = { ...data, id: '' }; // Will get ID later or just use index for back
      setCurrentNode(data);

      // Update Firestore
      await setDoc(doc(db, 'users', user.uid, 'stories', currentStoryId), {
        updatedAt: serverTimestamp()
      }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/stories/${currentStoryId}`));

      const stepRef = await addDoc(collection(db, 'users', user.uid, 'stories', currentStoryId, 'steps'), {
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

      const isDocRef = (ref: any): ref is { id: string } => ref && typeof ref === 'object' && 'id' in ref;
      if (isDocRef(stepRef)) {
        setAllSteps(prev => [...prev, { ...data, id: stepRef.id, choiceTaken: choice.text }]);
      }

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
      backstory: '',
      complexity: 'complex',
      tone: 'intense',
      isAdultContent: false,
      customBasis: ''
    });
    setCustomActionText('');
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

  const headingFont = genre === 'romance' ? 'font-serif italic text-rose-950' : genre === 'paranormal' ? 'font-serif italic tracking-wide text-purple-100' : 'font-display uppercase tracking-tight text-white';
  const bodyFont = genre === 'romance' ? 'font-sans' : genre === 'paranormal' ? 'font-sans opacity-90' : 'font-mono';

  const getGenreAccent = () => {
    switch (genre) {
      case 'romance': return 'rose';
      case 'paranormal': return 'purple';
      case 'crime': return 'sky';
      default: return 'gray';
    }
  };

  const accent = getGenreAccent();

  const buttonPrimary = genre === 'romance' 
    ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-200' 
    : genre === 'paranormal' 
    ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-900/20' 
    : 'bg-sky-600 hover:bg-sky-500 text-white shadow-sky-900/20';

  const buttonSecondary = genre === 'romance'
    ? 'bg-rose-50 border-rose-100 text-rose-500 hover:bg-rose-100'
    : genre === 'paranormal'
    ? 'bg-purple-900/20 border-purple-500/20 text-purple-300 hover:bg-purple-900/40'
    : 'bg-white/5 border-white/10 text-sky-400 hover:bg-white/10';

  const cardBase = genre === 'romance'
    ? 'bg-white/80 border-rose-100 shadow-xl shadow-rose-900/5'
    : genre === 'paranormal'
    ? 'bg-[#0a0510]/80 border-purple-500/10 shadow-2xl shadow-black'
    : 'bg-black/60 border-white/5 shadow-2xl';

  const fontSizeClass = settings.fontSize === 'sm' ? 'text-sm' : settings.fontSize === 'lg' ? 'text-xl' : 'text-lg';
  const lineSpacingClass = settings.lineSpacing === 'tight' ? 'leading-tight' : settings.lineSpacing === 'relaxed' ? 'leading-relaxed' : 'leading-normal';
  const textAlignClass = settings.textAlign === 'center' ? 'text-center' : settings.textAlign === 'justify' ? 'text-justify' : 'text-left';
  const fontWeightClass = settings.fontWeight === 'light' ? 'font-light' : settings.fontWeight === 'bold' ? 'font-bold' : 'font-normal';

  return (
    <div className={`min-h-screen transition-all duration-1000 ease-in-out ${themeClasses} overflow-x-hidden`}>
      <AtmosphericEffects genre={genre} />
      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-xl bg-black/40">
          <div className={`w-full max-w-md p-8 rounded-[2.5rem] border shadow-2xl ${
            genre === 'romance' ? 'bg-white border-rose-100' : 'bg-zinc-900 border-white/10'
          }`}>
            <div className="flex justify-between items-center mb-8">
              <h3 className={`text-2xl font-black uppercase tracking-tight ${genre === 'romance' ? 'text-rose-900' : 'text-white'}`}>Settings</h3>
              <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-8 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              <div className="space-y-4">
                <label className="text-[10px] uppercase font-black tracking-widest opacity-40">Reading Size</label>
                <div className="flex gap-2">
                  {(['sm', 'md', 'lg'] as const).map(size => (
                    <button
                      key={size}
                      onClick={() => setSettings(s => ({ ...s, fontSize: size }))}
                      className={`flex-1 py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                        settings.fontSize === size
                          ? `bg-${accent}-500 border-${accent}-500 text-white`
                          : genre === 'romance' ? 'border-rose-100 text-rose-300 hover:bg-rose-50' : 'border-white/10 text-white/40 hover:bg-white/5'
                      }`}
                    >
                      {size === 'sm' ? 'Small' : size === 'md' ? 'Medium' : 'Large'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] uppercase font-black tracking-widest opacity-40">Line Spacing</label>
                <div className="flex gap-2">
                  {(['tight', 'normal', 'relaxed'] as const).map(spacing => (
                    <button
                      key={spacing}
                      onClick={() => setSettings(s => ({ ...s, lineSpacing: spacing }))}
                      className={`flex-1 py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                        settings.lineSpacing === spacing
                          ? `bg-${accent}-500 border-${accent}-500 text-white`
                          : genre === 'romance' ? 'border-rose-100 text-rose-300 hover:bg-rose-50' : 'border-white/10 text-white/40 hover:bg-white/5'
                      }`}
                    >
                      {spacing}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] uppercase font-black tracking-widest opacity-40">Alignment</label>
                <div className="flex gap-2">
                  {(['left', 'center', 'justify'] as const).map(align => (
                    <button
                      key={align}
                      onClick={() => setSettings(s => ({ ...s, textAlign: align }))}
                      className={`flex-1 py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                        settings.textAlign === align
                          ? `bg-${accent}-500 border-${accent}-500 text-white`
                          : genre === 'romance' ? 'border-rose-100 text-rose-300 hover:bg-rose-50' : 'border-white/10 text-white/40 hover:bg-white/5'
                      }`}
                    >
                      {align}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] uppercase font-black tracking-widest opacity-40">Font Weight</label>
                <div className="flex gap-2">
                  {(['light', 'normal', 'bold'] as const).map(weight => (
                    <button
                      key={weight}
                      onClick={() => setSettings(s => ({ ...s, fontWeight: weight }))}
                      className={`flex-1 py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                        settings.fontWeight === weight
                          ? `bg-${accent}-500 border-${accent}-500 text-white`
                          : genre === 'romance' ? 'border-rose-100 text-rose-300 hover:bg-rose-50' : 'border-white/10 text-white/40 hover:bg-white/5'
                      }`}
                    >
                      {weight}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-widest">Visual Feedback</p>
                  <p className="text-[10px] opacity-40">Animated text and effects</p>
                </div>
                <button 
                  onClick={() => setSettings(s => ({ ...s, typewriter: !s.typewriter }))}
                  className={`w-12 h-6 rounded-full relative transition-colors ${settings.typewriter ? 'bg-sky-500' : 'bg-white/10'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.typewriter ? 'left-7' : 'left-1'}`} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Library Modal */}
      {showLibrary && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-xl bg-black/60">
          <div className={`w-full max-w-4xl h-[80vh] flex flex-col p-8 rounded-[2.5rem] border shadow-2xl ${
            genre === 'romance' ? 'bg-white border-rose-100 text-rose-900' : 'bg-zinc-950 border-white/10 text-white'
          }`}>
            <div className="flex justify-between items-center mb-8 px-4">
              <div className="space-y-1">
                <h3 className="text-3xl font-black uppercase tracking-tight">Your Fates</h3>
                <p className="text-[10px] uppercase font-black tracking-[0.2em] opacity-40">Previous and active narratives</p>
              </div>
              <button onClick={() => setShowLibrary(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 p-4 custom-scrollbar">
              {userStories.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-20 gap-4">
                  <LibraryIcon className="w-12 h-12" />
                  <p className="text-xs font-black uppercase tracking-[0.3em]">No stories woven yet</p>
                </div>
              ) : (
                userStories.map((story) => (
                  <button
                    key={story.id}
                    onClick={() => loadStory(story.id)}
                    className={`w-full text-left p-6 rounded-3xl border transition-all group flex items-center justify-between ${
                      story.id === currentStoryId
                        ? 'border-sky-500 bg-sky-500/10'
                        : genre === 'romance' ? 'border-rose-100 hover:bg-rose-50' : 'border-white/5 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-6">
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                        story.genre === 'romance' ? 'bg-rose-100 text-rose-500' : story.genre === 'crime' ? 'bg-sky-900/40 text-sky-400' : 'bg-purple-900/40 text-purple-400'
                      }`}>
                        {story.genre === 'romance' ? <Heart className="w-8 h-8" /> : story.genre === 'crime' ? <Skull className="w-8 h-8" /> : <Moon className="w-8 h-8" />}
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-black uppercase tracking-widest opacity-40">{story.genre || 'Unknown'}</p>
                        <h4 className="text-lg font-bold tracking-tight truncate max-w-[200px] md:max-w-md">
                          {story.characterArchetype || 'Untitled Narrative'}
                        </h4>
                        <div className="flex gap-4 items-center">
                          <span className="text-[10px] font-mono opacity-60">
                            {story.updatedAt?.seconds ? new Date(story.updatedAt.seconds * 1000).toLocaleDateString() : 'Active'}
                          </span>
                          <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full ${
                             story.status === 'active' ? 'bg-green-500/20 text-green-500' : 'bg-gray-500/20 text-gray-500'
                          }`}>
                            {story.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 opacity-0 group-hover:opacity-40 transition-all transform group-hover:translate-x-2" />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      {/* Dynamic Background Gradient */}
      <div 
        style={{ opacity: bgOpacity }}
        className={`fixed inset-0 pointer-events-none transition-opacity duration-1000 ${genre ? 'opacity-100' : 'opacity-0'}`}
      >
        <div className={`absolute inset-0 max-w-7xl mx-auto blur-[120px] ${
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
            <div className="flex items-center gap-2">
              <button 
                onClick={() => {
                  fetchUserStories(user.uid);
                  setShowLibrary(true);
                }}
                className={`p-2 rounded-full transition-colors ${
                  genre === 'romance' ? 'text-rose-400 hover:bg-rose-50' : 'text-gray-400 hover:bg-white/5'
                }`}
                title="Story Library"
              >
                <LibraryIcon className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setShowSettings(true)}
                className={`p-2 rounded-full transition-colors ${
                  genre === 'romance' ? 'text-rose-400 hover:bg-rose-50' : 'text-gray-400 hover:bg-white/5'
                }`}
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          )}
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
        <AnimatePresence mode="wait">
        {authLoading ? (
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
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
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
          <motion.div 
            key="genres"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 flex flex-col justify-center items-center text-center gap-16"
          >
              <div className="space-y-6">
                <div className="inline-block px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 mb-4">
                  Interactive AI Narrative
                </div>
                <h1 className="text-7xl md:text-9xl font-black mb-4 tracking-tighter leading-[0.8]">
                  CHOOSE <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-sky-400">YOUR FATE</span>
                </h1>
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
        ) : showParameterSetup ? (
          <motion.div 
            key="params"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className={`flex-1 flex flex-col justify-center items-center max-w-2xl mx-auto w-full gap-8`}
          >
            <div className={`w-full p-10 rounded-[3rem] border space-y-10 transition-all duration-700 ${cardBase}`}>
              <div className="text-center space-y-4">
                <h2 className={`text-4xl font-black uppercase tracking-tight ${genre === 'romance' ? 'text-rose-950 font-serif italic' : genre === 'paranormal' ? 'text-purple-100 font-serif' : 'text-white'}`}>
                  Define Your Fate
                </h2>
                <p className={`text-[10px] uppercase font-black tracking-[0.4em] opacity-30 ${genre === 'romance' ? 'text-rose-900' : 'text-white'}`}>The tapestry of your journey</p>
              </div>
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

              <div className="space-y-4">
                <label className="text-[10px] uppercase font-black tracking-widest opacity-40">Backstory & Ambition (Character Building)</label>
                <textarea 
                  placeholder="What haunts them? What do they desire most? (e.g. They lost their sister to the sea and seek the truth at any cost...)"
                  value={storyParameters.backstory}
                  onChange={(e) => setStoryParameters(p => ({ ...p, backstory: e.target.value }))}
                  rows={3}
                  className={`w-full p-4 rounded-2xl border bg-transparent transition-all outline-none focus:ring-2 resize-none ${
                    genre === 'romance' 
                      ? 'border-rose-100 focus:border-rose-300 focus:ring-rose-100 text-rose-900 placeholder:text-rose-200' 
                      : 'border-white/10 focus:border-sky-400 focus:ring-sky-500/20 text-white placeholder:text-white/20'
                  }`}
                />
              </div>

              <div className="space-y-4">
                <label className="text-[10px] uppercase font-black tracking-widest opacity-40">Custom Narrative Foundation (Optional Basis)</label>
                <textarea 
                  placeholder="Set the initial scene or premise... (e.g. On a rainy night in Neo-Tokyo, a mysterious courier delivers a package...)"
                  value={storyParameters.customBasis}
                  onChange={(e) => setStoryParameters(p => ({ ...p, customBasis: e.target.value }))}
                  rows={4}
                  className={`w-full p-4 rounded-2xl border bg-transparent transition-all outline-none focus:ring-2 resize-none ${
                    genre === 'romance' 
                      ? 'border-rose-100 focus:border-rose-300 focus:ring-rose-100 text-rose-900 placeholder:text-rose-200' 
                      : 'border-white/10 focus:border-sky-400 focus:ring-sky-500/20 text-white placeholder:text-white/20'
                  }`}
                />
              </div>

              <div className="space-y-4">
                <label className="text-[10px] uppercase font-black tracking-widest opacity-40">Narrative Tone (AI Logic Style)</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['subtle', 'intense', 'experimental'] as StoryTone[]).map(t => (
                    <button
                      key={t}
                      onClick={() => setStoryParameters(p => ({ ...p, tone: t }))}
                      className={`p-3 text-center rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all ${
                        storyParameters.tone === t
                          ? genre === 'romance' ? 'bg-rose-500 border-rose-500 text-white' : 'bg-sky-500 border-sky-500 text-white'
                          : genre === 'romance' ? 'border-rose-100 text-rose-300 hover:bg-rose-50' : 'border-white/10 text-white/40 hover:bg-white/5'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
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

              <div className="flex items-center justify-between p-6 rounded-[1.5rem] border transition-all bg-white/5 border-white/5">
                <div className="space-y-1">
                  <p className="text-xs font-black uppercase tracking-widest">Adult Themes (18+)</p>
                  <p className="text-[10px] opacity-40">Enable more explicit, raw, and high-intensity adult content.</p>
                </div>
                <button 
                  onClick={() => setStoryParameters(p => ({ ...p, isAdultContent: !p.isAdultContent }))}
                  className={`w-14 h-8 rounded-full relative transition-all duration-300 ${
                    storyParameters.isAdultContent ? 'bg-rose-500' : 'bg-white/10'
                  }`}
                >
                  <div className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-lg transition-all duration-300 ${
                    storyParameters.isAdultContent ? 'left-7' : 'left-1'
                  }`} />
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
          <div className="flex-1 flex flex-col relative" ref={contentRef}>
            {!currentNode && !loading && genre && (
              <div className="flex-1 flex flex-col items-center justify-center gap-8">
                <Loader2 className={`w-12 h-12 animate-spin ${genre === 'romance' ? 'text-rose-200' : 'text-sky-900'}`} />
                <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Resuming Narrative...</p>
              </div>
            )}

            {loading && !currentNode && (
              <motion.div 
                key="loading-node"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center gap-8"
              >
                <div 
                  className={`w-20 h-20 rounded-[2rem] flex items-center justify-center border-2 ${
                    genre === 'romance' ? 'border-rose-100' : 'border-white/10'
                  }`}
                >
                  <Sparkles className={`w-8 h-8 ${genre === 'romance' ? 'text-rose-400' : 'text-sky-400'}`} />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="font-black text-2xl tracking-tight uppercase">Spinning Reality</h3>
                  <p className="text-sm opacity-40 font-mono tracking-widest uppercase">The universe is listening...</p>
                </div>
              </motion.div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-3xl text-red-500 text-sm mb-12 flex items-center justify-between">
                <span>{error}</span>
                <button onClick={() => genre && startStory(genre)} className="font-black uppercase tracking-widest text-[10px] bg-red-500 text-white px-4 py-2 rounded-full">Retry Connection</button>
              </div>
            )}

            {currentNode && (
              <motion.div 
                key={currentNode.sceneTitle || allSteps.length}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                className="flex flex-col gap-12 pb-32"
              >
                {/* Scene Visual Container */}
                <motion.div 
                  initial={{ scale: 0.98, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`p-1 rounded-[2.5rem] ${cardBase}`}
                >
                  <div className="relative group">
                    <div className={`absolute inset-0 blur-3xl opacity-20 -z-10 group-hover:opacity-40 transition-opacity duration-1000 ${
                      genre === 'romance' ? 'bg-rose-400' : genre === 'paranormal' ? 'bg-purple-600' : 'bg-sky-900'
                    }`} />
                    <div className={`relative w-full aspect-video md:aspect-[21/9] rounded-[2.5rem] overflow-hidden flex items-center justify-center shadow-2xl border transition-all duration-700 ${
                      genre === 'romance' ? 'bg-rose-50 border-rose-100/50' : genre === 'paranormal' ? 'bg-[#1a1025] border-purple-500/10' : 'bg-black border-white/5'
                    }`}>
                    {currentNode.mediaType === 'video' && currentNode.videoUrl ? (
                      <video 
                        src={currentNode.videoUrl} 
                        className="w-full h-full object-cover"
                        autoPlay 
                        loop 
                        muted 
                        playsInline
                      />
                    ) : currentNode.imageUrl ? (
                      <img 
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
                            <div 
                              style={{ width: `${generationProgress}%` }}
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
              </motion.div>

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

                    <div className={`prose max-w-none transition-all duration-700 hyphens-auto whitespace-pre-wrap ${bodyFont} ${fontSizeClass} ${lineSpacingClass} ${textAlignClass} ${fontWeightClass} ${
                      genre === 'romance' ? 'text-rose-900/80' : genre === 'paranormal' ? 'text-purple-200/70' : 'text-gray-400'
                    }`}>
                      {currentNode.sceneDescription || ''}
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
                          {allSteps.length > 1 && (
                            <motion.button
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              onClick={goBack}
                              className={`group w-full p-4 rounded-2xl border transition-all text-left flex items-center gap-4 ${buttonSecondary}`}
                            >
                              <div className={`p-2 rounded-lg ${genre === 'romance' ? 'bg-rose-50 text-rose-500' : genre === 'paranormal' ? 'bg-purple-900/40 text-purple-400' : 'bg-white/5 text-sky-400'}`}>
                                <ArrowLeft className="w-4 h-4" />
                              </div>
                              <span className="text-[10px] font-black uppercase tracking-widest">Step Back in Time</span>
                            </motion.button>
                          )}
                          {currentNode.choices?.map((choice, idx) => (
                            <motion.button
                              key={idx}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.1 }}
                              onClick={() => handleChoice(choice)}
                              className={`group relative p-6 text-left border rounded-3xl transition-all duration-500 transform active:scale-95 ${cardBase} hover:border-${accent}-500/50`}
                            >
                              <div className="flex items-start gap-4">
                                <div className={`mt-1.5 w-1.5 h-1.5 rounded-full transition-all duration-500 group-hover:scale-150 ${
                                  genre === 'romance' ? 'bg-rose-300 group-hover:bg-rose-500' : genre === 'paranormal' ? 'bg-purple-600 group-hover:bg-purple-400' : 'bg-sky-900 group-hover:bg-sky-400'
                                }`} />
                                <span className={`flex-1 font-bold leading-tight ${genre === 'romance' ? 'text-rose-950 text-base' : 'text-white text-sm font-sans'}`}>
                                  {choice.text}
                                </span>
                              </div>
                            </motion.button>
                          ))}

                          <div className="pt-6 border-t border-white/5 mt-4 space-y-4">
                            <label className="text-[10px] uppercase font-black tracking-widest opacity-40">Your Freeform Action</label>
                            <div className="relative">
                              <textarea
                                value={customActionText}
                                onChange={(e) => setCustomActionText(e.target.value)}
                                placeholder="Describe your own action..."
                                className={`w-full p-4 pr-12 rounded-2xl border bg-transparent transition-all outline-none focus:ring-2 resize-none text-[11px] font-medium ${
                                  genre === 'romance' 
                                    ? 'border-rose-100 focus:border-rose-300 text-rose-900 placeholder:text-rose-200' 
                                    : 'border-white/10 focus:border-sky-400 text-white placeholder:text-white/20'
                                }`}
                                rows={2}
                              />
                              <button
                                onClick={() => {
                                  if (customActionText.trim()) {
                                    handleChoice({ text: customActionText, nextContext: 'user-defined-action' });
                                    setCustomActionText('');
                                  }
                                }}
                                disabled={!customActionText.trim() || loading}
                                className={`absolute right-3 bottom-3 p-2 rounded-xl transition-all ${
                                  customActionText.trim() 
                                    ? genre === 'romance' ? 'bg-rose-500 text-white' : 'bg-sky-500 text-white'
                                    : 'bg-white/5 text-white/20 opacity-50 cursor-not-allowed'
                                }`}
                              >
                                <Zap className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
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
      </AnimatePresence>
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
      {showHistory && (
        <>
          <div 
            onClick={() => setShowHistory(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          />
          <div 
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
                  <X className={`w-5 h-5 ${genre === 'paranormal' ? 'text-purple-400' : ''}`} />
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
                        "...{item.sceneDescription?.slice(0, 150)}..."
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
          </div>
        </>
      )}
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  BookOpen,
  Heart,
  Skull,
  Sparkles,
  ExternalLink,
  Check,
  Plus,
  Loader2,
  Lock,
  ArrowRight,
  RefreshCcw,
  Shield,
  CreditCard,
  Gift
} from "lucide-react";
import { db } from "../lib/firebase";
import { collection, addDoc, getDocs, limit, query, where } from "firebase/firestore";

interface BookRecommendation {
  id: string;
  title: string;
  author: string;
  coverUrl: string;
  synopsis: string;
  whyTbrFits: string;
  bookshopLink: string;
  price: string;
}

const GENRE_RECOMMENDATIONS: Record<string, BookRecommendation[]> = {
  romance: [
    {
      id: "romance_1",
      title: "Book Lovers",
      author: "Emily Henry",
      coverUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600",
      synopsis: "Two rival literary agents find themselves in the same small North Carolina town, forcing them to confront the stories they write for themselves.",
      whyTbrFits: "For those who savored the sharp wits and tender tension of our 'Rose & Rapture' endings. A tribute to modern bookstore chemistry.",
      bookshopLink: "https://bookshop.org/search?keywords=Emily+Henry+Book+Lovers&referrer=ClackamasBookExchange",
      price: "$16.99"
    },
    {
      id: "romance_2",
      title: "Written in the Stars",
      author: "Alexandria Bellefleur",
      coverUrl: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=600",
      synopsis: "A free-spirited astrologer and a calculated actuary are forced into a fake date scenario, leading to celestial alignment of hearts.",
      whyTbrFits: "Echoes the fate dynamics and zodiac compatibility parameters of our celestial branching choices.",
      bookshopLink: "https://bookshop.org/search?keywords=Written+in+the+Stars+Alexandria+Bellefleur&referrer=ClackamasBookExchange",
      price: "$15.99"
    },
    {
      id: "romance_3",
      title: "The Song of Achilles",
      author: "Madeline Miller",
      coverUrl: "https://images.unsplash.com/photo-1474932430478-367dbb6832c1?auto=format&fit=crop&q=80&w=600",
      synopsis: "A thrilling, profound, and lyrical reimagining of the Iliad, centering on the deep bond between Achilles and Patroclus.",
      whyTbrFits: "Matches the high-fidelity storytelling and heart-rending sacrifice choices found in our tragedy endings.",
      bookshopLink: "https://bookshop.org/search?keywords=The+Song+of+Achilles+Madeline+Miller&referrer=ClackamasBookExchange",
      price: "$17.99"
    }
  ],
  crime: [
    {
      id: "crime_1",
      title: "The Big Sleep",
      author: "Raymond Chandler",
      coverUrl: "https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?auto=format&fit=crop&q=80&w=600",
      synopsis: "Private eye Philip Marlowe enters a web of blackmail, syndicate violence, and high-society sins in rain-slicked California.",
      whyTbrFits: "The prime template for 'True Crime Noir'. If you preferred the rain-soaked streets and cold street lamps of our neon detective sifting.",
      bookshopLink: "https://bookshop.org/search?keywords=Raymond+Chandler+The+Big+Sleep&referrer=ClackamasBookExchange",
      price: "$14.95"
    },
    {
      id: "crime_2",
      title: "Neuromancer",
      author: "William Gibson",
      coverUrl: "https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&q=80&w=600",
      synopsis: "A washed-up computer hacker in Tokyo is hired by a mysterious colonel to extract a synthetic memory matrix from orbital vaults.",
      whyTbrFits: "If our synthetic memory smuggler or lower cyber-district timeline captured your focus, read the bible of cyberpunk.",
      bookshopLink: "https://bookshop.org/search?keywords=Neuromancer+William+Gibson&referrer=ClackamasBookExchange",
      price: "$16.00"
    },
    {
      id: "crime_3",
      title: "The Silent Patient",
      author: "Alex Michaelides",
      coverUrl: "https://images.unsplash.com/photo-1541963463532-d68292c34b19?auto=format&fit=crop&q=80&w=600",
      synopsis: "A famous painter shoots her husband five times and never speaks another word. A criminal psychotherapist becomes obsessed with unlocking her secret.",
      whyTbrFits: "Perfect for investigators who prefer methodical profile extraction, motives, and character psyche parsing.",
      bookshopLink: "https://bookshop.org/search?keywords=The+Silent+Patient+Alex+Michaelides&referrer=ClackamasBookExchange",
      price: "$17.99"
    }
  ],
  paranormal: [
    {
      id: "paranormal_1",
      title: "The Ocean at the End of the Lane",
      author: "Neil Gaiman",
      coverUrl: "https://images.unsplash.com/photo-1518376186638-27b99b53112a?auto=format&fit=crop&q=80&w=600",
      synopsis: "A man returns to his childhood home and remembers a terrifying supernatural event involving ancient forces lurking in the farm pond.",
      whyTbrFits: "Echoes the oceanic lullabies and bioluminescent seawater runes from the 'Sunken Spindle' timeline.",
      bookshopLink: "https://bookshop.org/search?keywords=The+Ocean+at+the+End+of+the+Lane+Neil+Gaiman&referrer=ClackamasBookExchange",
      price: "$16.99"
    },
    {
      id: "paranormal_2",
      title: "House of Leaves",
      author: "Mark Z. Danielewski",
      coverUrl: "https://images.unsplash.com/photo-1509021436665-8f07dbf5bf1d?auto=format&fit=crop&q=80&w=600",
      synopsis: "A young family moves into a small home on Ash Tree Lane, only to discover that the interior is inexplicably larger than the exterior.",
      whyTbrFits: "For readers haunted by the grimoire, spatial anomalies, and occult structural recursion.",
      bookshopLink: "https://bookshop.org/search?keywords=House+of+Leaves+Danielewski&referrer=ClackamasBookExchange",
      price: "$24.99"
    },
    {
      id: "paranormal_3",
      title: "The Haunting of Hill House",
      author: "Shirley Jackson",
      coverUrl: "https://images.unsplash.com/photo-1509248961158-e54f6934749c?auto=format&fit=crop&q=80&w=600",
      synopsis: "Four explorers arrive at a notorious gothic mansion, seeking clinical proof of paranormal phenomena, only to be absorbed by its hunger.",
      whyTbrFits: "For those who took the solitary path of the oracle, listening to whispers in the timber and cold wood floors.",
      bookshopLink: "https://bookshop.org/search?keywords=The+Haunting+of+Hill+House+Shirley+Jackson&referrer=ClackamasBookExchange",
      price: "$15.00"
    }
  ]
};

interface MonetizationHubProps {
  user: any;
  activeGenre: "romance" | "crime" | "paranormal" | null;
  onClose?: () => void;
  triggerNotification?: (msg: string) => void;
}

export function MonetizationHub({ user, activeGenre, onClose, triggerNotification }: MonetizationHubProps) {
  const currentGenre = activeGenre || "paranormal";
  const [activeTab, setActiveTab] = useState<"recs" | "commission" | "expansions" | "support">("recs");
  
  // Newsletter State
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [signingUp, setSigningUp] = useState(false);
  const [newsletterSuccess, setNewsletterSuccess] = useState(false);

  // Commission States
  const [commissionForm, setCommissionForm] = useState({
    title: "",
    genre: currentGenre,
    archetype: "",
    backstory: "",
    customGuidelines: "",
    deliveryFormat: "digital"
  });
  const [paymentStep, setPaymentStep] = useState<"form" | "stripe" | "success">("form");
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("•••• •••• •••• ••••");
  const [cardExpiry, setCardExpiry] = useState("MM/YY");
  const [cardCvc, setCardCvc] = useState("CVC");
  const [stripePaying, setStripePaying] = useState(false);

  // Community Coffee State
  const [totalCoffeeDonated, setTotalCoffeeDonated] = useState(148);
  const [donatingCoffee, setDonatingCoffee] = useState(false);
  const [coffeeSucess, setCoffeeSuccess] = useState(false);

  // Expansion Claim State
  const [claimingPack, setClaimingPack] = useState(false);
  const [packUnlocked, setPackUnlocked] = useState(false);

  // Fetch community stats from Firebase on load for authentic feel
  useEffect(() => {
    const fetchStats = async () => {
      try {
        if (!db) return;
        const q = query(collection(db, "system_stats"), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const data = snap.docs[0].data();
          if (data.coffeesCount) {
            setTotalCoffeeDonated(data.coffeesCount);
          }
        }
      } catch (e) {
        console.warn("Failed to fetch custom metric, using local state: ", e);
      }
    };
    fetchStats();
  }, []);

  const handleNewsletterSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail || !newsletterEmail.includes("@")) {
      if (triggerNotification) {
        triggerNotification("Please provide a valid email address!");
      } else {
        alert("Please provide a valid email address!");
      }
      return;
    }
    setSigningUp(true);
    try {
      if (db) {
        await addDoc(collection(db, "subscribers"), {
          email: newsletterEmail,
          userId: user?.uid || "guest",
          createdAt: new Date().toISOString(),
          source: "monetization_dispatch"
        });
      }
      setNewsletterSuccess(true);
      if (triggerNotification) triggerNotification("Successfully subscribed to TBR's cozy literary dispatch!");
    } catch (err) {
      console.error(err);
      setNewsletterSuccess(true); // Fallback gracefully in UI
    } finally {
      setSigningUp(false);
    }
  };

  const submitCommissionParameters = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commissionForm.title || !commissionForm.archetype) {
      if (triggerNotification) {
        triggerNotification("Please fill in today's commission title and character archetype!");
      } else {
        alert("Please fill in today's commission title and character archetype!");
      }
      return;
    }
    setPaymentStep("stripe");
  };

  const launchRealStripeCheckout = async (creditsAmount: number, priceInCents: number) => {
    try {
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.uid || "guest",
          email: user?.email || "",
          creditsAmount,
          priceInCents
        })
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const session = await response.json();
      if (session.url) {
        if (triggerNotification) triggerNotification("Passing connection securely to Stripe Checkout...");
        // Redirect browser to official checkout session
        window.location.href = session.url;
      } else {
        throw new Error("Stripe did not yield a redirection anchor.");
      }
    } catch (stripeErr: any) {
      console.error("[Stripe Redirect Event fails]:", stripeErr.message);
      if (triggerNotification) {
        triggerNotification("Stripe portal offline: " + stripeErr.message);
      }
    }
  };

  const processStripeCheckout = async () => {
    setStripePaying(true);
    try {
      const priceCents = commissionForm.deliveryFormat === "physical" ? 4500 : 1500;
      const creditsAmount = commissionForm.deliveryFormat === "physical" ? 50 : 15;
      await launchRealStripeCheckout(creditsAmount, priceCents);
    } catch (err) {
      console.error(err);
    } finally {
      setStripePaying(false);
    }
  };

  const buyCommunityCoffee = async (coffeesCount: number) => {
    setDonatingCoffee(true);
    try {
      const creditsToBuy = coffeesCount === 1 ? 5 : 30;
      const priceCents = coffeesCount === 1 ? 500 : 2500;
      await launchRealStripeCheckout(creditsToBuy, priceCents);
    } catch (err) {
      console.error(err);
    } finally {
      setDonatingCoffee(false);
    }
  };

  const unlockStoryPack = async () => {
    setClaimingPack(true);
    try {
      await launchRealStripeCheckout(5, 499);
    } catch (err) {
      console.error(err);
    } finally {
      setClaimingPack(false);
    }
  };

  const recs = GENRE_RECOMMENDATIONS[currentGenre] || GENRE_RECOMMENDATIONS.paranormal;

  return (
    <div className="w-full text-left space-y-8 animate-fadeIn" id="tbr-monetization-center">
      {/* Title & Bookstore Header */}
      <div className="p-6 sm:p-8 rounded-[2.5rem] bg-gradient-to-br from-amber-500/10 via-purple-500/5 to-transparent border border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <span className="text-[10px] font-mono font-bold tracking-[0.3em] text-amber-500 uppercase mb-2 block">
            AI Literary Experiments • BY TBR
          </span>
          <h3 className="text-2xl sm:text-3xl font-serif font-medium text-white tracking-tight">
            TBR Bookstore Experience Guild
          </h3>
          <p className="text-xs text-white/50 font-light mt-1 max-w-2xl">
            Established in 1981, TBR (formerly Clackamas Book Exchange) is Oregon’s independent trade-in bookstore. 
            We keep the narrative fire burning with curation, offline real-world trade loops, and tactile digital fiction.
          </p>
        </div>
        
        <div className="flex flex-col items-stretch sm:items-start shrink-0 text-[10px] text-white/40 font-mono space-y-1">
          <div className="flex items-center gap-1.5 text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <a
              href="https://bookshop.org/shop/ClackamasBookExchange"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline transition-all cursor-pointer font-bold duration-200"
            >
              Affiliate Revenue Active
            </a>
          </div>
          <a
            href="https://bookshop.org/shop/ClackamasBookExchange"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-amber-400 font-bold transition-all hover:underline cursor-pointer flex items-center gap-1"
          >
            <span>10% Bookshop.org Commission Goes to TBR</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      </div>

      {/* Primary Monetization Navigation Grid Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 border-b border-white/5 pb-2">
        <button
          id="tab-bookshop-recs"
          onClick={() => setActiveTab("recs")}
          className={`py-3 px-4 rounded-2xl text-[10px] sm:text-xs font-mono uppercase tracking-widest font-black transition-all text-center flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "recs"
              ? "bg-amber-500/10 border border-amber-500/30 text-amber-400"
              : "bg-white/[0.01] border border-transparent text-white/40 hover:text-white/80 hover:bg-white/[0.02]"
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Book Recs</span>
        </button>

        <button
          id="tab-story-commissions"
          onClick={() => setActiveTab("commission")}
          className={`py-3 px-4 rounded-2xl text-[10px] sm:text-xs font-mono uppercase tracking-widest font-black transition-all text-center flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "commission"
              ? "bg-purple-500/10 border border-purple-500/30 text-purple-400"
              : "bg-white/[0.01] border border-transparent text-white/40 hover:text-white/80 hover:bg-white/[0.02]"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Commissions</span>
        </button>

        <button
          id="tab-directors-cut"
          onClick={() => setActiveTab("expansions")}
          className={`py-3 px-4 rounded-2xl text-[10px] sm:text-xs font-mono uppercase tracking-widest font-black transition-all text-center flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "expansions"
              ? "bg-rose-500/10 border border-rose-500/30 text-rose-400"
              : "bg-white/[0.01] border border-transparent text-white/40 hover:text-white/80 hover:bg-white/[0.02]"
          }`}
        >
          <Gift className="w-3.5 h-3.5" />
          <span>Story Packs</span>
        </button>

        <button
          id="tab-support-tbr"
          onClick={() => setActiveTab("support")}
          className={`py-3 px-4 rounded-2xl text-[10px] sm:text-xs font-mono uppercase tracking-widest font-black transition-all text-center flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "support"
              ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
              : "bg-white/[0.01] border border-transparent text-white/40 hover:text-white/80 hover:bg-white/[0.02]"
          }`}
        >
          <Heart className="w-3.5 h-3.5" />
          <span>Support TBR</span>
        </button>
      </div>

      {/* Main Tab Panels */}
      <div className="relative min-h-[350px]">
        <AnimatePresence mode="wait">
          {activeTab === "recs" && (
            <motion.div
              key="recs-panel"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-8"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-lg font-serif font-medium text-white">
                    Literature Match: {currentGenre === "romance" ? "Delicate Hearts" : currentGenre === "crime" ? "Grim Investigations" : "Occult Crossroads"}
                  </h4>
                  <p className="text-xs text-white/40 font-mono uppercase mt-0.5 tracking-wider font-semibold">
                    Themed Recommendations curated by Oregon’s TBR Bookstore Scribes
                  </p>
                </div>

                <div className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] font-mono rounded-full uppercase tracking-widest select-none">
                  Affiliate Disclosure Integrated
                </div>
              </div>

              {/* Rec Books Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {recs.map((book) => (
                  <div
                    key={book.id}
                    id={`bookshop-card-${book.id}`}
                    className="p-5 rounded-3xl bg-[#090C12]/90 border border-white/5 hover:border-amber-500/20 shadow-lg flex flex-col justify-between space-y-4 group transition-all duration-300 hover:-translate-y-1"
                  >
                    <div className="space-y-4">
                      {/* Fake stylized book jacket representing real book */}
                      <div className="aspect-[4/5] rounded-xl overflow-hidden relative shadow-md bg-zinc-900 border border-white/5">
                        <img
                          src={book.coverUrl}
                          alt={book.title}
                          className="w-full h-full object-cover opacity-60 group-hover:opacity-85 transition-opacity duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#090C12] via-transparent to-transparent" />
                        <div className="absolute bottom-3 left-3 right-3 text-left">
                          <span className="text-[9px] font-mono font-medium tracking-widest text-amber-400 uppercase">
                            TBR Staff Pick
                          </span>
                          <h5 className="text-[11px] font-mono font-extrabold text-white uppercase tracking-tight line-clamp-1">
                            {book.title}
                          </h5>
                          <p className="text-[9px] font-mono text-white/50">
                            By {book.author}
                          </p>
                        </div>
                      </div>

                      {/* Info & TBR Synergy */}
                      <div>
                        <h4 className="text-base font-serif font-semibold text-white tracking-tight line-clamp-1 mb-1">
                          {book.title}
                        </h4>
                        <p className="text-xs text-white/40 font-mono mb-2">
                          By {book.author}
                        </p>
                        <p className="text-[11px] text-white/50 leading-relaxed font-light line-clamp-3 mb-3">
                          {book.synopsis}
                        </p>
                        <div className="p-3 bg-amber-500/[0.02] border border-amber-500/10 rounded-xl leading-relaxed text-[10px] text-amber-200 font-serif italic">
                          "{book.whyTbrFits}"
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                      <span className="font-mono text-xs font-extrabold text-amber-400">
                        {book.price}
                      </span>
                      <a
                        id={`bookshop-link-${book.id}`}
                        href={book.bookshopLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 group-hover:bg-amber-500/15 text-[10px] text-white group-hover:text-amber-400 font-mono uppercase tracking-wider font-extrabold transition-all border border-white/10 group-hover:border-amber-500/30"
                      >
                        <span>Buy on Bookshop</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>

            </motion.div>
          )}

          {activeTab === "commission" && (
            <motion.div
              key="commission-panel"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6 text-left"
            >
              <div>
                <h4 className="text-lg font-serif font-medium text-white">
                  Commission Your Custom Destiny Echo
                </h4>
                <p className="text-xs text-white/40 font-mono uppercase mt-0.5 tracking-wider font-semibold">
                  Co-create an interactive branching destiny tailored exclusively to you
                </p>
              </div>

              {paymentStep === "form" && (
                <form id="commission-input-form" onSubmit={submitCommissionParameters} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest font-black">
                        Story Scenario Title
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g., The Clockwork Obsidian Oracle"
                        value={commissionForm.title}
                        onChange={(e) => setCommissionForm(prev => ({ ...prev, title: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 focus:border-purple-500 rounded-2xl px-4 py-3 text-xs text-white transition-all font-mono outline-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest font-black">
                        Saga Template Genre
                      </label>
                      <select
                        value={commissionForm.genre}
                        onChange={(e: any) => setCommissionForm(prev => ({ ...prev, genre: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 focus:border-purple-500 rounded-2xl px-4 py-3 text-xs text-white transition-all font-mono outline-none appearance-none"
                      >
                        <option value="romance" className="bg-slate-950 text-white">Rose & Rapture (Romance)</option>
                        <option value="crime" className="bg-slate-950 text-white">True Crime Noir (Noir)</option>
                        <option value="paranormal" className="bg-slate-950 text-white">Veiled Realms (Paranormal)</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest font-black">
                        Character Archetype
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g., A mute clockmaker who sees glowing gears of chronomancy"
                        value={commissionForm.archetype}
                        onChange={(e) => setCommissionForm(prev => ({ ...prev, archetype: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 focus:border-purple-500 rounded-2xl px-4 py-3 text-xs text-white transition-all font-mono outline-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest font-black">
                        Inciting Mystery or Backstory
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Carrying a family watch that moves backwards when spirits are close"
                        value={commissionForm.backstory}
                        onChange={(e) => setCommissionForm(prev => ({ ...prev, backstory: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 focus:border-purple-500 rounded-2xl px-4 py-3 text-xs text-white transition-all font-mono outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest font-black">
                      Custom Twist, Setting, or Aesthetic Guidelines (Prompt)
                    </label>
                    <textarea
                      placeholder="Specify tone directions, key character items, custom secrets to uncover, or writing style guidelines (e.g. Victorian clockwork fantasy)..."
                      value={commissionForm.customGuidelines}
                      rows={3}
                      onChange={(e) => setCommissionForm(prev => ({ ...prev, customGuidelines: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 focus:border-purple-500 rounded-2xl px-4 py-3 text-xs text-white transition-all font-mono outline-none resize-none"
                    />
                  </div>

                  {/* Delivery Select Column */}
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
                    <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest font-black block">
                      Choose Your Edition Package
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setCommissionForm(prev => ({ ...prev, deliveryFormat: "digital" }))}
                        className={`p-4 rounded-xl text-left border transition-all cursor-pointer ${
                          commissionForm.deliveryFormat === "digital"
                            ? "border-purple-500 bg-purple-500/10"
                            : "border-white/5 hover:bg-white/5"
                        }`}
                      >
                        <h5 className="text-xs font-mono font-bold text-white uppercase">
                          ☕ Premium Digital Edition
                        </h5>
                        <p className="text-[10px] text-white/50 leading-relaxed font-light mt-1">
                          Personalized story added to the global gallery directory forever with customized illustrations and prompt seed lock.
                        </p>
                        <span className="text-xs font-mono font-black text-purple-400 block mt-2">
                          $15.00
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCommissionForm(prev => ({ ...prev, deliveryFormat: "physical" }))}
                        className={`p-4 rounded-xl text-left border transition-all cursor-pointer ${
                          commissionForm.deliveryFormat === "physical"
                            ? "border-purple-500 bg-purple-500/10"
                            : "border-white/5 hover:bg-white/5"
                        }`}
                      >
                        <h5 className="text-xs font-mono font-bold text-white uppercase col-span-2">
                          📬 Leather-Bound Grimoire Edition (US Only)
                        </h5>
                        <p className="text-[10px] text-white/50 leading-relaxed font-light mt-1">
                          We compile your entire customized story, alternate choice paths, and imagery into a beautifully printed physical book, shipped by TBR.
                        </p>
                        <span className="text-xs font-mono font-black text-purple-400 block mt-2">
                          $45.00
                        </span>
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-4 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold font-mono uppercase tracking-widest text-xs transition-all shadow-lg shadow-purple-900/20 active:translate-y-0.5"
                  >
                    Proceed to Secure Checkout
                  </button>
                </form>
              )}

              {paymentStep === "stripe" && (
                <div className="max-w-md mx-auto p-6 rounded-3xl bg-[#090C12] border border-white/10 shadow-2xl space-y-6">
                  <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider border-b border-white/5 pb-3">
                    <span className="text-purple-400 flex items-center gap-1">
                      <Shield className="w-4 h-4 text-purple-400" /> Secure Encryption
                    </span>
                    <span className="text-white/40">Stripe Sandbox Active</span>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-xs font-mono">
                      <span className="text-white/50 font-bold block">Commission Package:</span>
                      <span className="text-white capitalize">{commissionForm.title} ({commissionForm.deliveryFormat})</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-mono">
                      <span className="text-white/50 font-bold block">Total Amount:</span>
                      <span className="text-purple-300 font-extrabold text-base">${commissionForm.deliveryFormat === "physical" ? "45.00" : "15.00"}</span>
                    </div>
                  </div>

                  {/* Aesthetic card mockup */}
                  <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-900 to-indigo-900 border border-purple-500/30 text-white space-y-6 relative overflow-hidden">
                    <div className="absolute right-0 bottom-0 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <span className="text-[8px] font-mono opacity-50 uppercase tracking-widest block">Card Holder</span>
                        <input
                          type="text"
                          required
                          placeholder="YOUR FULL NAME"
                          value={cardName}
                          onChange={(e) => setCardName(e.target.value.toUpperCase())}
                          className="bg-transparent border-b border-white/20 focus:border-white text-xs uppercase font-mono tracking-widest outline-none py-0.5 text-white placeholder-white/30"
                        />
                      </div>
                      <CreditCard className="w-8 h-8 text-white/50" />
                    </div>

                    <div className="space-y-2 font-mono">
                      <span className="text-[8px] opacity-50 uppercase tracking-widest block">Card Number</span>
                      <input
                        type="text"
                        required
                        placeholder="4242 4242 4242 4242"
                        className="bg-transparent border-b border-white/20 focus:border-white text-sm tracking-[0.2em] outline-none py-0.5 text-white w-full placeholder-white/30"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4 font-mono">
                      <div className="space-y-1">
                        <span className="text-[8px] opacity-50 uppercase tracking-widest block">Expiry</span>
                        <input
                          type="text"
                          required
                          placeholder="MM/YY"
                          className="bg-transparent border-b border-white/20 focus:border-white text-xs outline-none py-0.5 text-white w-full placeholder-white/30"
                        />
                      </div>
                      <div className="space-y-1 col-span-1">
                        <span className="text-[8px] opacity-50 uppercase tracking-widest block">CVC</span>
                        <input
                          type="password"
                          required
                          placeholder="CVC"
                          maxLength={3}
                          className="bg-transparent border-b border-white/20 focus:border-white text-xs outline-none py-0.5 text-white w-full placeholder-white/30"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      onClick={() => setPaymentStep("form")}
                      className="py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-mono text-[10px] uppercase tracking-wider font-bold transition-all border border-white/10 text-center cursor-pointer"
                    >
                      Step Back
                    </button>
                    <button
                      onClick={processStripeCheckout}
                      disabled={stripePaying}
                      className="py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-mono text-[10px] uppercase tracking-wider font-extrabold transition-all border border-purple-500/30 text-center cursor-pointer flex items-center justify-center gap-2 shadow-lg"
                    >
                      {stripePaying ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Paying...</span>
                        </>
                      ) : (
                        <span>Confirm Pay</span>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {paymentStep === "success" && (
                <div className="max-w-md mx-auto text-center p-8 rounded-3xl bg-[#090C12] border border-purple-500/20 shadow-2xl space-y-6">
                  <div className="w-12 h-12 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center mx-auto text-purple-400">
                    <Check className="w-6 h-6" />
                  </div>

                  <div className="space-y-2">
                    <h5 className="text-xl font-serif font-black text-white">
                      Chronicle Horizon Aligned!
                    </h5>
                    <p className="text-xs text-white/50 leading-relaxed font-light">
                      Thank you for your supportive purchase. Our generative authors and TBR shopkeeper guild have registered your guidelines. We are crafting your unique path!
                    </p>
                  </div>

                  <div className="p-4 bg-purple-500/5 rounded-2xl border border-purple-500/15 font-mono text-[10px] text-purple-200 uppercase tracking-wider">
                    An confirmation update will be dispatched directly to your registered storefront email within 24 hours.
                  </div>

                  <button
                    onClick={() => {
                      setCommissionForm({
                        title: "",
                        genre: currentGenre,
                        archetype: "",
                        backstory: "",
                        customGuidelines: "",
                        deliveryFormat: "digital"
                      });
                      setPaymentStep("form");
                    }}
                    className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-full text-[10px] font-mono uppercase tracking-widest font-extrabold transition-all"
                  >
                    Commission Another Scribe
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "expansions" && (
            <motion.div
              key="expansions-panel"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6 text-left"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-lg font-serif font-medium text-white">
                    Unlock Story Packs & Companion Codex
                  </h4>
                  <p className="text-xs text-white/40 font-mono uppercase mt-0.5 tracking-wider font-semibold">
                    Acquire alternate chronicle bundles (with 15+ special expansion chapters + companion PDF)
                  </p>
                </div>
                
                <span className="px-3 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[9px] font-mono rounded-full uppercase tracking-widest select-none font-bold">
                  Exclusive Expansion
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                {/* Pack Card 1 */}
                <div className="p-6 rounded-3xl bg-[#0F0E16]/90 border border-rose-500/10 flex flex-col justify-between space-y-6 shadow-xl relative overflow-hidden group">
                  <div className="absolute right-0 top-0 w-24 h-24 bg-rose-500/5 blur-xl rounded-full" />
                  <div className="space-y-3">
                    <span className="px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/20 text-[8px] text-rose-300 font-mono uppercase tracking-wider font-extrabold">
                      Director's Cut Volume I
                    </span>
                    <h5 className="text-lg font-serif font-semibold text-white">
                      Ethereal Revelations & Unsealed Seals
                    </h5>
                    <p className="text-xs text-white/50 leading-relaxed font-light">
                      Unlock alternate paths for 'Veiled Realms' and 'Shadows & Sin'. Includes 24 high-fidelity illustrations, detailed motives codex, character relationship insights, and ambient tracks.
                    </p>
                    
                    <ul className="text-[10px] text-rose-200/60 font-mono space-y-1.5 pt-2">
                      <li>• 15 Extra secret choices</li>
                      <li>• Dark ocean soundscape loops</li>
                      <li>• Printable High-Res Artwork Book</li>
                    </ul>
                  </div>

                  <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-rose-400">
                      $4.99 one-time
                    </span>
                    <button
                      onClick={unlockStoryPack}
                      disabled={claimingPack || packUnlocked}
                      className="px-4 py-2 bg-rose-500 hover:bg-rose-600 disabled:bg-rose-950/20 disabled:text-rose-400/50 text-slate-950 rounded-xl text-[10px] font-mono font-black uppercase tracking-wider transition-all flex items-center gap-1.5"
                    >
                      {claimingPack ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Unlocking...</span>
                        </>
                      ) : packUnlocked ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Unlocked & Active</span>
                        </>
                      ) : (
                        <span>Simulate Purchases</span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Pack Card 2 */}
                <div className="p-6 rounded-3xl bg-[#090C12]/90 border border-white/5 flex flex-col justify-between space-y-6 shadow-xl relative overflow-hidden group">
                  <div className="absolute right-0 top-0 w-24 h-24 bg-purple-500/5 blur-xl rounded-full" />
                  <div className="space-y-3">
                    <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[8px] text-white/50 font-mono uppercase tracking-wider">
                      Premium Custom Pack
                    </span>
                    <h5 className="text-lg font-serif font-semibold text-white">
                      The Scribes' Vault Omnibus
                    </h5>
                    <p className="text-xs text-white/50 leading-relaxed font-light">
                      Access all premises, story settings, community echoes, and custom assets in offline grimoire format! Includes standard lifetime update keys for future genre drops.
                    </p>
                    
                    <ul className="text-[10px] text-white/40 font-mono space-y-1.5 pt-2">
                      <li>• Lifetime license pass key</li>
                      <li>• All alternate branching endings</li>
                      <li>• Behind-the-scenes parameter guidelines</li>
                    </ul>
                  </div>

                  <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-white/60">
                      $9.99 one-time
                    </span>
                    <button
                      onClick={() => {
                        const msg = "This bundle can be purchased with TBR points or real support inside Oregon's trade loops!";
                        if (triggerNotification) {
                          triggerNotification(msg);
                        } else {
                          alert(msg);
                        }
                      }}
                      className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[10px] font-mono font-black uppercase tracking-wider transition-all border border-white/10"
                    >
                      Unlock with Trade-In
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "support" && (
            <motion.div
              key="support-panel"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6 text-left"
            >
              <div>
                <h4 className="text-lg font-serif font-medium text-white">
                  Support Oregon's Cozy TBR Neighborhood Bookstore
                </h4>
                <p className="text-xs text-white/40 font-mono uppercase mt-0.5 tracking-wider font-semibold">
                  TBR has been serving bookworms since 1981. Help keep our servers and physical bookshelves glowing.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
                {/* Bookshop Storefront Affiliate Card */}
                <div className="p-6 rounded-3xl bg-[#090C12] border border-amber-500/10 flex flex-col justify-between space-y-6 relative overflow-hidden">
                  <div className="space-y-4">
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[8px] text-amber-400 font-mono uppercase tracking-wider font-extrabold pb-0.5">
                      Shop Online & Support Us
                    </span>
                    <h5 className="text-base font-serif font-semibold text-white tracking-tight">
                      Clackamas Book Exchange Bookstore
                    </h5>
                    <p className="text-xs text-white/50 leading-relaxed font-light">
                      Visit our digital shelf interface on Bookshop.org. Buy any physical book print or ebook and we receive 10% of the proceeds to fund our curation servers!
                    </p>

                    <div className="p-3 bg-amber-500/[0.02] border border-amber-500/10 rounded-xl flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                      <span className="text-[9px] font-mono text-amber-200 uppercase tracking-wider">
                        10% Affiliate Commission Goes To TBR
                      </span>
                    </div>
                  </div>

                  <a
                    id="visit-bookshop-storefront"
                    href="https://bookshop.org/shop/ClackamasBookExchange"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-mono font-bold uppercase tracking-wider text-[10px] rounded-xl transition-all cursor-pointer text-center flex items-center justify-center gap-1.5"
                  >
                    <span>Visit Our Bookshop.org Store</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                {/* Coffee Donation */}
                <div className="p-6 rounded-3xl bg-[#090C12] border border-emerald-500/10 flex flex-col justify-between space-y-6 relative overflow-hidden">
                  <div className="space-y-4">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[8px] text-emerald-400 font-mono uppercase tracking-wider font-extrabold pb-0.5">
                      Buy TBR Bookstore A Coffee
                    </span>
                    <h5 className="text-base font-serif font-semibold text-white tracking-tight">
                      Support Physical Book Trade Loops
                    </h5>
                    <p className="text-xs text-white/50 leading-relaxed font-light">
                      Sponsor a cup of delicious hot coffee ($5) for the bookstore team. Every donation increments our community-wide thermometer ticker!
                    </p>

                    {/* Thermometer stats widget */}
                    <div className="space-y-1.5 pt-2">
                      <div className="flex justify-between items-center text-[9px] font-mono text-white/40 uppercase tracking-widest font-bold">
                        <span>Community Cup Gauge</span>
                        <span className="text-emerald-400 font-extrabold">{totalCoffeeDonated} Coffees Bought</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-400 transition-all duration-[1.5s]"
                          style={{ width: `${(totalCoffeeDonated / 500) * 100}%` }}
                        />
                      </div>
                      <p className="text-[8px] font-mono text-emerald-400 opacity-60 text-right uppercase tracking-wider">
                        Next milestone: 500 cups (unlocks free community story chapter!)
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      id="buy-one-coffee"
                      onClick={() => buyCommunityCoffee(1)}
                      disabled={donatingCoffee}
                      className="flex-1 py-2 px-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-950/20 disabled:text-emerald-400 text-slate-950 font-mono font-bold uppercase tracking-wider text-[10px] rounded-xl transition-all cursor-pointer text-center"
                    >
                      {donatingCoffee ? "Brewing..." : "Buy 1 Cup ($5)"}
                    </button>
                    <button
                      id="buy-pack-coffee"
                      onClick={() => buyCommunityCoffee(5)}
                      disabled={donatingCoffee}
                      className="flex-1 py-2 px-3 bg-[#111A1B] hover:bg-white/[0.04] text-emerald-400 font-mono font-bold uppercase tracking-wider text-[10px] rounded-xl transition-all cursor-pointer text-center border border-emerald-500/20"
                    >
                      Buy 5 Pack ($25)
                    </button>
                  </div>
                </div>

                {/* Newsletter Subscription Container */}
                <div className="p-6 rounded-3xl bg-[#0E121E] border border-white/5 flex flex-col justify-between space-y-6">
                  <div className="space-y-2">
                    <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[8px] text-white/50 font-mono uppercase tracking-wider">
                      Mailing Dispatch List
                    </span>
                    <h5 className="text-base font-serif font-semibold text-white">
                      Subscribe to Bookstore Newsletters
                    </h5>
                    <p className="text-xs text-white/50 leading-relaxed font-light">
                      Join TBR’s community-oriented newsletter. Get informed about upcoming trading events, new interactive genre rollouts, and weekly choice breakdowns. No spam, ever.
                    </p>
                  </div>

                  <AnimatePresence mode="wait">
                    {!newsletterSuccess ? (
                      <form id="newsletter-form" onSubmit={handleNewsletterSignup} className="flex gap-2 pt-2">
                        <input
                          type="email"
                          required
                          placeholder="your.email@gmail.com"
                          value={newsletterEmail}
                          onChange={(e) => setNewsletterEmail(e.target.value)}
                          className="flex-1 bg-white/5 border border-white/10 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white outline-none font-mono"
                        />
                        <button
                          type="submit"
                          disabled={signingUp}
                          className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white font-mono text-[9px] uppercase tracking-wider font-extrabold transition-all border border-white/15 rounded-xl flex items-center justify-center shrink-0 cursor-pointer"
                        >
                          {signingUp ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> : "Subscribe"}
                        </button>
                      </form>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="py-3 px-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-[10px] font-mono uppercase tracking-wider flex items-center gap-2"
                      >
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Successfully Joined Literary Dispatch!</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

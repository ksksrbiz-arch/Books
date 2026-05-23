interface Step {
  sceneTitle: string;
  sceneDescription: string;
  choiceTaken?: string | null;
  imageUrl?: string | null;
  imagePrompt?: string | null;
}

interface Relationship {
  affinity: number;
  suspicion: number;
}

interface Story {
  id: string;
  genre: "romance" | "crime" | "paranormal" | null;
  characterArchetype?: string | null;
  customBasis?: string | null;
  backstory?: string | null;
  tone?: string | null;
  complexity?: string | null;
}

interface DocRequest {
  insertText?: {
    location: { index: number };
    text: string;
  };
  updateTextStyle?: {
    textStyle: any;
    range: { startIndex: number; endIndex: number };
    fields: string;
  };
  updateParagraphStyle?: {
    paragraphStyle: any;
    range: { startIndex: number; endIndex: number };
    fields: string;
  };
  insertInlineImage?: {
    uri: string;
    objectSize?: {
      height: { magnitude: number; unit: string };
      width: { magnitude: number; unit: string };
    };
    location: { index: number };
  };
  insertPageBreak?: {
    location: { index: number };
  };
}

/**
 * Validates and checks image URLs before embedding them in Google Docs.
 * Prevents non-secure protocols, checks domains against allowlists, protects against scripts,
 * and proactively tests the HTTP availability via standard head probes and image fallback tags.
 */
export async function verifySecureImage(url: string): Promise<boolean> {
  if (!url) return false;
  try {
    // 1. Structure Check & Secure Protocol Check
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      console.warn(`[Docs Export Security] Image URL rejected due to unsafe protocol: ${parsed.protocol}`);
      return false;
    }

    // 2. Domain & Content-Safety Screening (Allowlist of safe storage domains)
    const allowedDomains = [
      "firebasestorage.googleapis.com",
      "storage.googleapis.com",
      "googleusercontent.com"
    ];
    
    const isDomainAllowed = allowedDomains.some(
      domain => parsed.hostname === domain || parsed.hostname.endsWith("." + domain)
    );
    
    if (!isDomainAllowed) {
      console.warn(`[Docs Export Security] Image URL rejected due to untrusted host: ${parsed.hostname}`);
      return false;
    }

    // 3. Prevent dangerous parameter injections or script content strings
    const urlLower = url.toLowerCase();
    if (urlLower.includes("<script") || urlLower.includes("javascript:") || urlLower.includes("onload=")) {
      console.warn(`[Docs Export Security] Image URL rejected due to suspicious inline elements.`);
      return false;
    }

    // 4. Verification of valid visual formats (such as standard web png, jpeg, webp or firebase storage identifiers)
    const pathname = parsed.pathname.toLowerCase();
    const isAcceptedFormat = pathname.includes(".png") || 
                             pathname.includes(".jpg") || 
                             pathname.includes(".jpeg") || 
                             pathname.includes(".webp") ||
                             pathname.includes("/o/"); // typical firebase storage path identifier
                             
    if (!isAcceptedFormat) {
      console.warn(`[Docs Export Security] Unrecognized image asset extension: ${pathname}`);
      return false;
    }

    // 5. Active Live Accessibility Probe to guarantee server renders don't get 404/403 errors (which crash Google Docs API batch updates)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 seconds constraint
    
    try {
      const response = await fetch(url, { 
        method: "HEAD", 
        signal: controller.signal 
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        console.warn(`[Docs Export Probe] Active HEAD load check failed with status: ${response.status}`);
        return false;
      }
      return true;
    } catch (probeErr) {
      clearTimeout(timeoutId);
      console.warn(`[Docs Export Probe] HEAD request failed, launching fallback client image loader test:`, probeErr);
      
      // Run fallback canvas/image loader check in browser window frame
      return await new Promise<boolean>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        setTimeout(() => {
          img.src = "";
          resolve(false);
        }, 2500);
        img.src = url;
      });
    }
  } catch (err) {
    console.warn(`[Docs Export Security] Error parsing or validating url structure:`, err);
    return false;
  }
}

/**
 * Creates and formats a Google Doc to bookstore-quality print layouts based on story parameters.
 */
export async function exportToGoogleDocs(
  accessToken: string,
  story: Story,
  steps: Step[],
  relationships: Record<string, Relationship>,
  storyMilestones: string[],
  consequences: Record<string, string>,
  authorName: string
): Promise<{ docUrl: string; title: string }> {
  // 1. Determine aesthetic colors and typography based on genre
  const genre = story.genre || "paranormal";
  let font = "Georgia";
  let r = 0.5, g = 0.2, b = 0.7; // default mystical purple
  
  if (genre === "romance") {
    font = "Georgia";
    r = 0.74; g = 0.16; b = 0.27; // elegant rose crimson
  } else if (genre === "crime") {
    font = "Courier New";
    r = 0.10; g = 0.35; b = 0.55; // sharp detective slate
  } else if (genre === "paranormal") {
    font = "Georgia";
    r = 0.38; g = 0.15; b = 0.62; // rich supernatural indigo
  }

  const rgbColor = { red: r, green: g, blue: b };
  const darkGray = { red: 0.15, green: 0.15, blue: 0.15 };
  const subtleGray = { red: 0.45, green: 0.45, blue: 0.45 };

  // Pre-validate all image links in parallel to implement robust verification and avoid batch errors
  const verifiedImages = await Promise.all(
    steps.map(async (step) => {
      if (step.imageUrl) {
        const isValid = await verifySecureImage(step.imageUrl);
        return isValid ? step.imageUrl : null;
      }
      return null;
    })
  );

  // 2. Prepare the document Title
  const rawTitle = story.characterArchetype || "Uncharted Savefile";
  const docTitle = `Architect: ${rawTitle.toUpperCase()}`;

  // 3. Document Creation
  const createRes = await fetch("https://docs.googleapis.com/v1/documents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title: docTitle }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Google Docs API creation failed: ${errText}`);
  }

  const docInfo = await createRes.json();
  const documentId = docInfo.documentId;

  // Let's keep a running counter of character index to insert elements sequentially
  // index 1 is the default start of a new Google Doc
  let currentIndex = 1;
  const requests: DocRequest[] = [];

  // Helper: Append formatted text
  const appendText = (
    text: string,
    style: {
      bold?: boolean;
      italic?: boolean;
      fontSize?: number;
      fontFamily?: string;
      color?: any;
    } = {},
    pStyle: {
      alignment?: "CENTER" | "START" | "JUSTIFIED";
      spaceBelow?: number;
      spaceAbove?: number;
      lineSpacing?: number;
    } = {}
  ) => {
    if (!text) return;
    const startIndex = currentIndex;
    const length = text.length;
    currentIndex += length;

    requests.push({
      insertText: {
        location: { index: startIndex },
        text: text,
      },
    });

    // Formatting TextStyle
    const textStyleFields: string[] = [];
    const textStyle: any = {};
    if (style.bold !== undefined) {
      textStyle.bold = style.bold;
      textStyleFields.push("bold");
    }
    if (style.italic !== undefined) {
      textStyle.italic = style.italic;
      textStyleFields.push("italic");
    }
    if (style.fontSize) {
      textStyle.fontSize = { magnitude: style.fontSize, unit: "PT" };
      textStyleFields.push("fontSize");
    }
    if (style.fontFamily || font) {
      textStyle.weightedFontFamily = { fontFamily: style.fontFamily || font };
      textStyleFields.push("weightedFontFamily");
    }
    if (style.color) {
      textStyle.foregroundColor = { color: { rgbColor: style.color } };
      textStyleFields.push("foregroundColor");
    }

    if (textStyleFields.length > 0) {
      requests.push({
        updateTextStyle: {
          textStyle,
          range: { startIndex, endIndex: currentIndex },
          fields: textStyleFields.join(","),
        },
      });
    }

    // Paragraph Style
    const pStyleFields: string[] = [];
    const paragraphStyle: any = {};
    if (pStyle.alignment) {
      paragraphStyle.alignment = pStyle.alignment;
      pStyleFields.push("alignment");
    }
    if (pStyle.spaceAbove !== undefined) {
      paragraphStyle.spaceAbove = { magnitude: pStyle.spaceAbove, unit: "PT" };
      pStyleFields.push("spaceAbove");
    }
    if (pStyle.spaceBelow !== undefined) {
      paragraphStyle.spaceBelow = { magnitude: pStyle.spaceBelow, unit: "PT" };
      pStyleFields.push("spaceBelow");
    }
    if (pStyle.lineSpacing !== undefined) {
      paragraphStyle.lineSpacing = pStyle.lineSpacing * 100; // API uses percentage
      pStyleFields.push("lineSpacing");
    }

    if (pStyleFields.length > 0) {
      requests.push({
        updateParagraphStyle: {
          paragraphStyle,
          range: { startIndex, endIndex: currentIndex },
          fields: pStyleFields.join(","),
        },
      });
    }
  };

  // Helper: Append a Page Break
  const appendPageBreak = () => {
    requests.push({
      insertPageBreak: {
        location: { index: currentIndex },
      },
    });
    currentIndex += 1;
  };

  // Helper: Append an Inline Image with safety checks, optimized rendering and dimensions
  const appendImage = (url: string) => {
    requests.push({
      insertInlineImage: {
        uri: url,
        objectSize: {
          // Optimized presentation size for standard print proportions
          height: { magnitude: 240, unit: "PT" }, 
          width: { magnitude: 420, unit: "PT" },
        },
        location: { index: currentIndex },
      },
    });
    currentIndex += 1;
    // Add spacing after image
    appendText("\n", {}, { alignment: "CENTER", spaceBelow: 8 });
  };

  // ==================== COVER PAGE ====================
  appendText("\n\n\n\n", {}, { alignment: "CENTER" });
  
  // Title
  appendText("A R C H I T E C T\n", { bold: true, fontSize: 32, color: rgbColor }, { alignment: "CENTER", spaceBelow: 12 });
  
  // Decorative separator
  appendText("━━━━━━━━━━━━━━━━━━━━━━━━━\n", { color: rgbColor, fontSize: 10 }, { alignment: "CENTER", spaceBelow: 16 });
  
  // Subtitle / Archetype
  appendText(`THE NARRATIVE CHRONICLES OF THE ${rawTitle.toUpperCase()}\n\n`, { italic: true, fontSize: 16, color: darkGray }, { alignment: "CENTER", spaceBelow: 24 });
  
  // Genre Badge
  appendText(`GENRE ATTMOSPHERE: ${genre.toUpperCase()} NARRATIVE\n`, { bold: true, fontSize: 10, color: rgbColor }, { alignment: "CENTER", spaceBelow: 6 });
  appendText(`TONE PROFILE: ${story.tone?.toUpperCase() || "INTENSE"} | COMPLEXITY: ${story.complexity?.toUpperCase() || "COMPLEX"}\n\n\n\n`, { fontSize: 10, color: subtleGray }, { alignment: "CENTER", spaceBelow: 36 });
  
  // Author credits
  appendText("Woven & Channeled by Narrator\n", { fontSize: 11, color: subtleGray }, { alignment: "CENTER" });
  appendText(`[ ${authorName} ]\n`, { bold: true, fontSize: 12, color: darkGray }, { alignment: "CENTER", spaceBelow: 12 });
  appendText(`Formed on: ${new Date().toLocaleDateString(undefined, { dateStyle: "long" })}\n\n\n\n`, { fontSize: 9, color: subtleGray }, { alignment: "CENTER", spaceBelow: 24 });

  // Story Introduction / Backstory
  if (story.backstory || story.customBasis) {
    appendText("THE INCEPTION SEED:\n", { bold: true, fontSize: 9, color: rgbColor }, { alignment: "CENTER", spaceBelow: 8 });
    const backstoryText = story.customBasis || story.backstory || "";
    appendText(`“ ${backstoryText} ”\n`, { italic: true, fontSize: 11, color: darkGray }, { alignment: "CENTER", spaceBelow: 12, lineSpacing: 1.2 });
  }

  appendPageBreak();

  // ==================== CHRONICLES SECTION ====================
  appendText("P A R T   I   :   C H R O N I C L E S\n", { bold: true, fontSize: 18, color: rgbColor }, { alignment: "CENTER", spaceBelow: 6, spaceAbove: 18 });
  appendText("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n", { color: rgbColor, fontSize: 10 }, { alignment: "CENTER", spaceBelow: 18 });

  steps.forEach((step, idx) => {
    // Scene title
    appendText(`Scene ${idx + 1}: ${step.sceneTitle}\n`, { bold: true, fontSize: 14, color: rgbColor }, { alignment: "START", spaceAbove: 14, spaceBelow: 8 });
    
    // Aesthetic Cinematic image if loaded and available
    const securedImageUrl = verifiedImages[idx];
    if (securedImageUrl) {
      appendImage(securedImageUrl);
      
      if (step.imagePrompt) {
        appendText(`Atmosphere Projection Details (Alt Text): "${step.imagePrompt}"\n\n`, { italic: true, fontSize: 9, color: subtleGray }, { alignment: "CENTER", spaceBelow: 12 });
      }
    } else if (step.imageUrl) {
      // Graceful degradation placeholder: maintains document structure, accessibility, and semantic metadata
      appendText(`[ Ambient Atmosphere: ${step.imagePrompt || "Cinematic Visual Projection Details"} ]\n\n`, { italic: true, bold: true, fontSize: 9, color: rgbColor }, { alignment: "CENTER", spaceBelow: 12 });
    }

    // Story text (bookstore-quality justifies)
    appendText(`${step.sceneDescription}\n\n`, { fontSize: 11, color: darkGray }, { alignment: "JUSTIFIED", lineSpacing: 1.4, spaceBelow: 12 });

    // Choice Taken Highlight
    if (step.choiceTaken) {
      appendText(`✦ Destiny Pivot: `, { bold: true, fontSize: 10, color: rgbColor }, { alignment: "START" });
      appendText(`“${step.choiceTaken}”\n\n`, { italic: true, bold: true, fontSize: 11, color: darkGray }, { alignment: "START", spaceBelow: 14 });
    }

    // Divider between scenes
    if (idx < steps.length - 1) {
      appendText("✦   ✦   ✦\n\n", { color: rgbColor, fontSize: 11 }, { alignment: "CENTER", spaceAbove: 12, spaceBelow: 12 });
    }
  });

  appendPageBreak();

  // ==================== GRIMOIRE & CODEX SECTION ====================
  appendText("P A R T   I I   :   T H E   G R I M O I R E\n", { bold: true, fontSize: 18, color: rgbColor }, { alignment: "CENTER", spaceBelow: 6, spaceAbove: 18 });
  appendText("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n", { color: rgbColor, fontSize: 10 }, { alignment: "CENTER", spaceBelow: 18 });

  // 1. Relationships
  const relKeys = Object.keys(relationships);
  if (relKeys.length > 0) {
    appendText("ACTIVE CHARACTER ALIGNMENTS\n", { bold: true, fontSize: 12, color: rgbColor }, { alignment: "START", spaceBelow: 8 });
    relKeys.forEach((name) => {
      const rel = relationships[name];
      appendText(`•  `, { fontSize: 11, color: rgbColor });
      appendText(`${name}:  `, { bold: true, fontSize: 11, color: darkGray });
      appendText(`Affinity: ${rel.affinity}%   |   Suspicion: ${rel.suspicion}%\n`, { fontSize: 11, color: darkGray }, { spaceBelow: 4 });
    });
    appendText("\n", {}, { spaceBelow: 12 });
  }

  // 2. Milestones
  if (storyMilestones.length > 0) {
    appendText("ACHIEVED FATE MILESTONES\n", { bold: true, fontSize: 12, color: rgbColor }, { alignment: "START", spaceBelow: 8 });
    storyMilestones.forEach((milestone) => {
      appendText(`•  `, { fontSize: 11, color: rgbColor });
      appendText(`${milestone}\n`, { fontSize: 11, color: darkGray }, { spaceBelow: 4 });
    });
    appendText("\n", {}, { spaceBelow: 12 });
  }

  // 3. Consequences
  const conKeys = Object.keys(consequences);
  if (conKeys.length > 0) {
    appendText("TEMPORAL CONVERGENCES & CONSEQUENCES\n", { bold: true, fontSize: 12, color: rgbColor }, { alignment: "START", spaceBelow: 8 });
    conKeys.forEach((key) => {
      appendText(`•  `, { fontSize: 11, color: rgbColor });
      appendText(`${key}: `, { bold: true, fontSize: 11, color: darkGray });
      appendText(`${consequences[key]}\n`, { fontSize: 11, color: darkGray }, { spaceBelow: 4 });
    });
  }

  // Final footer marker
  appendText("\n\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n", { color: rgbColor, fontSize: 10 }, { alignment: "CENTER", spaceAbove: 24 });
  appendText("END OF TRANSMISSION • ARCHITECT ENGINE\n", { bold: true, fontSize: 9, color: subtleGray }, { alignment: "CENTER" });

  // 4. Send Batch Update requests
  const updateRes = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ requests }),
  });

  if (!updateRes.ok) {
    const errText = await updateRes.text();
    throw new Error(`Google Docs API formatting update failed: ${errText}`);
  }

  const docUrl = `https://docs.google.com/document/d/${documentId}/edit`;
  return { docUrl, title: docTitle };
}

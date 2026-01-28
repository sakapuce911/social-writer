// src/lib/localGenerator.ts
// LOCAL Generator — LinkedIn Only (V3.3 "IA-LIKE" 2026)
// ✅ LinkedIn only
// ✅ KPI/metrics => business
// ✅ Subject FR "propre" (KPI, orthographe, formulation)
// ✅ Hooks IA-like: chiffre / question / confession => scoring => meilleur
// ✅ 1ère ligne: "Vous" obligatoire
// ✅ Style 2026: conversation early + "Soyons honnêtes" + storytelling + 3–5 actions
// ✅ CTA = question => commentaires >10 mots
// ✅ Hashtags propres (pas de #intelligement)
// ✅ Max ~1300 caractères

export type Objective = "vendre" | "attirer" | "éduquer" | "recruter" | "inspirer";
export type Network = "linkedin";
export type Lang = "fr" | "en";
export type Tone = "corporate" | "serieux" | "fun" | "cash";

export type LocalPostResult = {
  caption: string;
  cta: string;
  hashtags: string;
};

type Args = {
  subject: string;
  language: Lang;
  objective: Objective;
  network: Network;
  tone?: Tone;
};

// ------------------------
// Utils
// ------------------------

const clamp = (s: string) => (s ?? "").trim();
const normSpaces = (s: string) => (s ?? "").replace(/\s+/g, " ").trim();

function titleCase(s: string) {
  const t = normSpaces(s);
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Seeded RNG (stable) */
function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (a >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}
function joinParagraphs(parts: string[]) {
  return parts.map((p) => p.trim()).filter(Boolean).join("\n\n");
}
function bullets(lines: string[], dash: "–" | "-" = "–") {
  return lines.map((l) => `${dash} ${l}`).join("\n");
}

function trimToMaxChars(text: string, maxChars: number) {
  const t = (text ?? "").trim();
  if (!t) return t;
  if (t.length <= maxChars) return t;

  const paras = t.split(/\n\s*\n+/g).map((p) => p.trim()).filter(Boolean);
  if (paras.length <= 1) return t.slice(0, maxChars - 1).trimEnd() + "…";

  let out = "";
  for (const p of paras) {
    const next = out ? `${out}\n\n${p}` : p;
    if (next.length > maxChars) break;
    out = next;
  }
  if (out && out.length >= Math.floor(maxChars * 0.65)) return out.trim();

  return t.slice(0, maxChars - 1).trimEnd() + "…";
}

// ------------------------
// ✅ Subject sanitization + "pretty"
// ------------------------

function sanitizeSubjectFR(subject: string) {
  let t = clamp(subject);
  if (!t) return "ce sujet";

  t = t.replace(/[?!.]+$/, "");

  const trashPrefixes = [
    /^(pourquoi|comment|quand|est-ce que|qu['’]est-ce que|quel est|quelles sont)\s+/i,
    /^(on doit|il faut|nous devons|je dois|tu dois|vous devez)\s+/i,
    /^(l['’]importance de|les bienfaits de|le but de|les raisons de)\s+/i,
    /^(mon|ma|mes|ton|ta|tes|notre|nos|votre|vos)\s+/i,
  ];
  for (const rx of trashPrefixes) t = t.replace(rx, "");

  t = t.replace(/\bnotre\b/gi, "la").replace(/\bvotre\b/gi, "la");

  return titleCase(t.trim() || subject);
}

function sanitizeSubjectEN(subject: string) {
  const t = normSpaces(subject);
  return t || "this topic";
}

/** Correction FR pour affichage (KPI, orthographe, formulation légère) */
function prettySubjectFR(subject: string) {
  let s = normSpaces(subject);

  // fautes fréquentes
  s = s.replace(/\bintelligement\b/gi, "intelligemment");

  // KPI/OKR en majuscules
  s = s.replace(/\bkpi(s)?\b/gi, (m) => (m.toLowerCase().includes("s") ? "KPIs" : "KPI"));
  s = s.replace(/\bokr(s)?\b/gi, (m) => (m.toLowerCase().includes("s") ? "OKRs" : "OKR"));

  // si ça commence par "Mesurer ..." => rendre plus naturel
  if (/^mesurer\b/i.test(s)) {
    // "mesurer le KPI intelligemment" -> "mesurer un KPI intelligemment"
    s = s.replace(/^mesurer\s+le\s+kpi\b/i, "mesurer un KPI");
    s = s.replace(/^mesurer\s+les\s+kpis\b/i, "mesurer des KPIs");
    // si pas d'article
    s = s.replace(/^mesurer\s+kpi\b/i, "mesurer un KPI");
  }

  // éviter TitleCase agressif
  // on met juste la 1ère lettre en majuscule, mais on garde KPI en maj
  s = s.charAt(0).toUpperCase() + s.slice(1);

  return s || "ce sujet";
}

/** Ton forcé via "tone:xxx | ..." */
function parseToneFromSubject(subject: string): { tone: Tone | null; cleanSubject: string } {
  const raw = clamp(subject);
  const m = raw.match(/^\s*tone\s*:\s*(corporate|serieux|fun|cash)\s*\|\s*(.+)$/i);
  if (!m) return { tone: null, cleanSubject: raw };
  const tone = m[1].toLowerCase() as Tone;
  const cleanSubject = clamp(m[2]);
  return { tone, cleanSubject };
}

function defaultTone(): Tone {
  return "corporate";
}

// ------------------------
// Topic detection
// ------------------------

type TopicCategory = "stress" | "business" | "tech" | "lifestyle" | "general";

function detectCategory(subject: string): TopicCategory {
  const s = normSpaces(subject).toLowerCase();

  const stressWords = [
    "stress","anxiété","anxiete","burnout","burn-out","fatigue",
    "épuisement","epuisement","santé mentale","sante mentale","pression","charge mentale",
    "peur","confiance en soi","syndrome",
  ];
  if (stressWords.some((w) => s.includes(w))) return "stress";

  // ✅ KPI / metrics => business
  const businessWords = [
    "kpi","kpis","okr","okrs","métrique","metrique","métriques","metriques","indicateur","indicateurs",
    "performance","analytics","analyse","dashboard","tableau","tableau de bord","pilotage","reporting","roi","valeur",
    "vendre","vente","marketing","client","business","argent","prix","offre","prospect","conversion","croissance",
    "chiffre","linkedin","branding","marque","audience",
    "productivité","productivite","efficacite","efficacité","temps","organisation","focus","deep work","objectifs",
    "discipline","priorité","priorite","routine","process","agenda","planning",
  ];
  if (businessWords.some((w) => s.includes(w))) return "business";

  const techWords = [
    "code","dev","développement","developpement","react","next","nextjs","javascript","typescript","api","ia","llm",
    "prompt","outil","logiciel","web","design","ui","ux","nocode","saas",
  ];
  if (techWords.some((w) => s.includes(w))) return "tech";

  const lifestyleWords = [
    "sport","nutrition","voyage","maison","déco","deco","cuisine","famille","relation","lecture","art","peinture",
    "musique","mode","santé","sante","bien-être",
  ];
  if (lifestyleWords.some((w) => s.includes(w))) return "lifestyle";

  return "general";
}

// ------------------------
// Frameworks (FR) — KPI / business renforcé
// ------------------------

type Framework = { title: string; steps: string[]; closeLine?: string };

function fwBusinessFR(subject: string, objective: Objective, rng: () => number): Framework {
  const s = prettySubjectFR(sanitizeSubjectFR(subject));
  const lower = normSpaces(subject).toLowerCase();

  const isKpi = /\bkpi\b|\bokrs?\b|métrique|metrique|indicateur|pilotage|reporting|dashboard|tableau de bord/.test(lower);
  const isProductivity = /producti|efficac|temps|organi|focus|perform|disciplin|priorit|routine|agenda|planning/i.test(lower);

  if (isKpi) {
    const kpiFrameworks: readonly Framework[] = [
      {
        title: "Mesurer un KPI intelligemment (sans vanity metrics)",
        steps: [
          "Définissez la décision : quel choix ce KPI doit-il aider à prendre ?",
          "Fixez une fenêtre de temps + une source de vérité (sinon biais).",
          "Ajoutez un KPI “contexte” : volume / qualité / coût (pour éviter les fausses victoires).",
          "Reliez à une action : si le KPI bouge, qu’est-ce que vous changez concrètement ?",
        ],
        closeLine: "Un KPI utile ne “rassure” pas. Il guide une action.",
      },
      {
        title: "Le trio Impact • Signal • Action",
        steps: [
          "Impact : quel résultat business vous visez réellement ?",
          "Signal : quel indicateur le reflète sans être manipulable ?",
          "Action : quelle routine hebdo déclenchez-vous si ça monte/descend ?",
          "Qualité : vous suivez aussi 1 métrique anti-triche (ex: churn, NPS, coûts).",
        ],
        closeLine: "Soyons honnêtes : mieux vaut 3 KPI actionnables que 30 jolis dashboards.",
      },
    ];
    return pick(rng, kpiFrameworks);
  }

  if (isProductivity) {
    const prodFrameworks: readonly Framework[] = [
      {
        title: "Le système 3 blocs (qui marche vraiment)",
        steps: [
          `Bloc #1 (60–90 min) : votre tâche la plus importante sur ${s} (sans téléphone).`,
          "Bloc #2 (30–45 min) : tâches nécessaires (mails, admin, coordination).",
          "Bloc #3 (15 min) : bilan + plan du lendemain (vous évitez le flou).",
        ],
        closeLine: "Soyons honnêtes : la productivité, c’est surtout protéger son attention.",
      },
      {
        title: "La méthode C.D.E (Clarté • Discipline • Élimination)",
        steps: [
          `Clarté : définissez votre priorité #1 pour ${s} (une seule).`,
          "Discipline : bloquez un créneau fixe (même heure, même lieu).",
          "Élimination : supprimez 1 distraction aujourd’hui (scroll / multitâche / réunions inutiles).",
        ],
        closeLine: "Être productif, ce n’est pas faire plus. C’est faire mieux.",
      },
    ];
    return pick(rng, prodFrameworks);
  }

  const frameworks: readonly Framework[] = [
    {
      title: "Le triangle Clarté → Preuve → Action",
      steps: [
        `Clarté : “pour qui” et “résultat” en 1 phrase sur ${s}.`,
        "Preuve : 1 exemple concret (même petit) qui montre que ça marche.",
        "Action : une seule prochaine étape (simple, sans friction).",
      ],
      closeLine: "Quand c’est simple, les gens passent à l’action.",
    },
    {
      title: "Comprendre • Simplifier • Répéter",
      steps: [
        `Comprendre : où ça bloque vraiment sur ${s} ?`,
        "Simplifier : une règle simple à appliquer cette semaine.",
        "Répéter : on mesure, on ajuste, on stabilise.",
      ],
      closeLine: "La répétition bat la motivation.",
    },
  ];

  const addByObj: Record<Objective, string | null> = {
    vendre: "👉 Bonus : promesse + preuve + action (en 1 ligne).",
    attirer: "👉 Bonus : un angle clair + un exemple terrain.",
    éduquer: "👉 Bonus : 1 erreur fréquente + la correction.",
    recruter: "👉 Bonus : attentes + process + comment postuler.",
    inspirer: "👉 Bonus : un avant/après + un petit pas simple.",
  };

  const base = pick(rng, frameworks);
  return { ...base, steps: [...base.steps, ...(addByObj[objective] ? [addByObj[objective] as string] : [])].slice(0, 6) };
}

function fwStressFR(objective: Objective, rng: () => number): Framework {
  const frameworks: readonly Framework[] = [
    {
      title: "La règle des 3 R (quand la pression monte)",
      steps: [
        "Ralentir : vous n’avez pas besoin d’aller plus vite, vous avez besoin d’aller plus juste.",
        "Respirer : 2 minutes (inspire 4s / expire 6s) pour calmer le corps.",
        "Relativiser : “est-ce important dans 7 jours ? 7 mois ?”",
      ],
      closeLine: "La performance durable commence par le calme.",
    },
    {
      title: "3 leviers simples (mais puissants)",
      steps: [
        "Micro-pauses (30–60 sec) : relâchement + respiration lente.",
        "Priorisation : 3 priorités max / jour (le reste = bonus).",
        "Limites : notifications sous contrôle + vraie récupération.",
      ],
      closeLine: "Soyons honnêtes : tenir longtemps vaut mieux que tenir fort.",
    },
  ];

  const angle: Record<Objective, string | null> = {
    vendre: "👉 Si vous vendez : vendez “plus de clarté + meilleure exécution” (pas “moins de stress”).",
    attirer: "👉 Si vous attirez : partagez un vécu + une routine simple à tester.",
    éduquer: "👉 Si vous éduquez : expliquez le mécanisme en 2 lignes, puis action.",
    recruter: "👉 Si vous recrutez : montrez que vous valorisez la performance durable.",
    inspirer: "👉 Si vous inspirez : rappelez qu’on peut progresser sans s’épuiser.",
  };

  const base = pick(rng, frameworks);
  return { ...base, steps: [...base.steps, ...(angle[objective] ? [angle[objective] as string] : [])].slice(0, 6) };
}

function fwTechFR(subject: string, objective: Objective, rng: () => number): Framework {
  const s = prettySubjectFR(sanitizeSubjectFR(subject));
  const frameworks: readonly Framework[] = [
    {
      title: "Apprendre vite (sans se disperser)",
      steps: [
        `1 concept → 1 mini-projet : appliquez ${s} tout de suite.`,
        "Construisez “cassé” puis réparez : c’est là que vous progressez.",
        "Feedback : montrez votre travail, récupérez 1 critique, itérez.",
      ],
      closeLine: "En tech, la vitesse vient de l’itération, pas de la théorie.",
    },
    {
      title: "La méthode 20/80",
      steps: ["20% : bases + exemples (pas plus).", "80% : pratique (petites features) + review.", "1 blocage = 1 question précise (pas “ça marche pas”)."],
      closeLine: "Une bonne question vaut plus que 2 heures de scroll.",
    },
  ];

  const add: Record<Objective, string | null> = {
    vendre: "👉 Bonus : montrez 1 avant/après (gain temps, bug résolu, résultat visible).",
    attirer: "👉 Bonus : mini-tuto + 1 piège à éviter.",
    éduquer: "👉 Bonus : 1 exemple + 1 exercice simple.",
    recruter: "👉 Bonus : 3 critères concrets + 1 test simple.",
    inspirer: "👉 Bonus : racontez votre “jour 1” → “jour 30”.",
  };

  const base = pick(rng, frameworks);
  return { ...base, steps: [...base.steps, ...(add[objective] ? [add[objective] as string] : [])].slice(0, 6) };
}

function fwLifestyleFR(subject: string, objective: Objective, rng: () => number): Framework {
  const s = prettySubjectFR(sanitizeSubjectFR(subject));
  const frameworks: readonly Framework[] = [
    {
      title: "Le trio Plaisir • Rythme • Progression",
      steps: [`Plaisir : choisissez une version simple de ${s} que vous aimez.`, "Rythme : un rendez-vous régulier (même court).", "Progression : une micro-amélioration par semaine."],
      closeLine: "Ce qui dure, c’est ce qui est simple.",
    },
    {
      title: "Commencer petit (mais commencer)",
      steps: [`10 minutes sur ${s} valent mieux que “un jour je ferai”.`, "Cherchez la constance, pas la perfection.", "Documentez : 1 note, 1 progrès, 1 retour."],
      closeLine: "Soyons honnêtes : la constance fait la différence.",
    },
  ];

  const add: Record<Objective, string | null> = {
    vendre: "👉 Bonus : parlez expérience + bénéfice concret (avant/après).",
    attirer: "👉 Bonus : posez une question simple (préférences, habitudes).",
    éduquer: "👉 Bonus : 1 règle + 1 erreur à éviter.",
    recruter: "👉 Bonus : montrez culture / valeurs / rythme.",
    inspirer: "👉 Bonus : montrez que c’est accessible (pas élitiste).",
  };

  const base = pick(rng, frameworks);
  return { ...base, steps: [...base.steps, ...(add[objective] ? [add[objective] as string] : [])].slice(0, 6) };
}

function fwGeneralFR(subject: string, objective: Objective, rng: () => number): Framework {
  const s = prettySubjectFR(sanitizeSubjectFR(subject));
  const frameworks: readonly Framework[] = [
    {
      title: "Le plan simple (qui évite le blabla)",
      steps: [`Objectif : qu’est-ce que vous voulez obtenir avec ${s} ?`, "Action : une seule action réaliste cette semaine (pas 12).", "Bilan : ce qui marche / ce qui bloque / prochain pas."],
      closeLine: "La simplicité fait avancer plus vite.",
    },
    {
      title: "3 vérités utiles",
      steps: ["Le problème n’est pas l’info. C’est l’exécution.", "La constance bat l’intensité.", "Ce qui se mesure s’améliore (même simplement)."],
      closeLine: "Vous progressez quand vous répétez, pas quand vous réfléchissez.",
    },
  ];

  const add: Record<Objective, string | null> = {
    vendre: "👉 Bonus : “pour qui” + “résultat” + “comment démarrer”.",
    attirer: "👉 Bonus : 1 idée forte + 1 exemple concret.",
    éduquer: "👉 Bonus : étapes claires + exemple terrain.",
    recruter: "👉 Bonus : attentes + process + next step.",
    inspirer: "👉 Bonus : un petit pas faisable aujourd’hui.",
  };

  const base = pick(rng, frameworks);
  return { ...base, steps: [...base.steps, ...(add[objective] ? [add[objective] as string] : [])].slice(0, 6) };
}

// ------------------------
// Hooks IA-like (FR): 3 types + scoring
// ------------------------

type HookType = "number" | "question" | "confession";

function subjectSignalsFR(subject: string) {
  const s = normSpaces(subject).toLowerCase();
  return {
    hasWhyHow: /^(pourquoi|comment|quand|est-ce que)\b/.test(s),
    hasNumbers: /\d/.test(s),
    isKpi: /\bkpi\b|\bokrs?\b|métrique|metrique|indicateur|pilotage|reporting|dashboard|tableau de bord|analytics/.test(s),
    isProductivity: /producti|efficac|temps|organi|focus|perform|disciplin|priorit|routine|agenda|planning/i.test(s),
    isStress: /stress|anxi|burnout|fatigue|epuis|pression|charge mentale/i.test(s),
    isTech: /code|dev|react|next|api|typescript|javascript|ia|llm|saas/i.test(s),
  };
}

function ensureVousFirstLineFR(line: string) {
  const t = clamp(line);
  if (!t) return "Vous perdez des opportunités sans le voir.";
  if (/^\s*vous\b/i.test(t)) return t;
  return `Vous ${t.charAt(0).toLowerCase()}${t.slice(1)}`;
}

function buildHookFR(subject: string, cat: TopicCategory, rng: () => number): string {
  const s = prettySubjectFR(sanitizeSubjectFR(subject));
  const sig = subjectSignalsFR(subject);

  const nA = pick(rng, ["10 likes", "2 heures", "3 erreurs", "30 minutes", "90 minutes"] as const);

  const numberHooks = [
    `Vous suivez vos KPI… mais vos décisions ne changent jamais ?`,
    `Vous avez des dashboards partout, et pourtant ${nA} de réunions partent “au feeling” ?`,
    `Vous mesurez des KPI, mais pas les bons (et ça coûte cher).`,
  ] as const;

  const questionHooks = [
    `Vous mesurez vos KPI… mais vous savez vraiment quoi en faire ensuite ?`,
    `Vous voulez piloter avec des KPI, mais vous sentez que ça ne reflète pas la réalité ?`,
    `Vous avez déjà “amélioré un KPI”… puis découvert que le business n’allait pas mieux ?`,
  ] as const;

  const confessionHooks = [
    `Soyons honnêtes : j’ai déjà célébré un KPI “vert”… alors que l’impact était nul.`,
    `Vous n’êtes pas seul : j’ai longtemps confondu “mesurer” et “piloter” avec des KPI.`,
    `Le piège : optimiser un KPI au lieu d’optimiser la décision.`,
  ] as const;

  function score(type: HookType) {
    let sc = 0;
    if (cat === "business" && type === "number") sc += 4;
    if (cat === "business" && type === "question") sc += 6; // KPI => question marche très bien
    if (cat === "stress" && (type === "confession" || type === "question")) sc += 5;
    if (cat === "tech" && (type === "confession" || type === "question")) sc += 4;

    if (sig.hasWhyHow && type === "question") sc += 6;
    if (sig.hasNumbers && type === "number") sc += 4;
    if (sig.isKpi && type === "question") sc += 6;
    if (sig.isKpi && type === "confession") sc += 4;
    if (sig.isProductivity && type === "number") sc += 6;
    if (sig.isStress && type === "confession") sc += 4;

    return sc;
  }

  const options = [
    { type: "number" as const, text: ensureVousFirstLineFR(pick(rng, numberHooks)), score: score("number") },
    { type: "question" as const, text: ensureVousFirstLineFR(pick(rng, questionHooks)), score: score("question") },
    { type: "confession" as const, text: ensureVousFirstLineFR(pick(rng, confessionHooks)), score: score("confession") },
  ];

  const max = Math.max(...options.map((o) => o.score));
  const best = options.filter((o) => o.score === max);
  return pick(rng, best).text;
}

// ------------------------
// Empathy / Story (FR)
// ------------------------

function buildEmpathyFR(cat: TopicCategory, rng: () => number): string {
  const business = [
    "Vous mesurez… mais ça ne change pas vos décisions au quotidien.",
    "Vous avez des chiffres, mais pas forcément des signaux actionnables.",
    "Vous voulez être data-driven… sans tomber dans les vanity metrics.",
  ] as const;

  const stress = [
    "On a tous ce moment où la charge mentale devient trop lourde.",
    "Vous n’êtes pas “faible” : votre cerveau vous envoie un signal.",
    "C’est normal de se sentir dépassé(e) parfois.",
  ] as const;

  const tech = [
    "Le plus dur n’est pas le niveau. C’est la constance.",
    "Vous avancez… puis vous vous dispersez… puis vous stagnez.",
    "Vous pouvez aller vite, si vous découpez correctement.",
  ] as const;

  const lifestyle = [
    "Le piège, c’est de viser trop haut dès le départ.",
    "Vous voulez un résultat immédiat, au lieu d’un rythme agréable.",
    "Ça doit vous faire du bien, pas vous mettre la pression.",
  ] as const;

  const general = [
    "On complexifie souvent ce qui peut rester simple.",
    "Trop d’options, pas assez d’action : c’est ça qui bloque.",
    "Le plus dur, c’est de commencer… puis de continuer.",
  ] as const;

  if (cat === "business") return pick(rng, business);
  if (cat === "stress") return pick(rng, stress);
  if (cat === "tech") return pick(rng, tech);
  if (cat === "lifestyle") return pick(rng, lifestyle);
  return pick(rng, general);
}

function buildMiniStoryFR(subject: string, cat: TopicCategory, rng: () => number): string {
  const s = prettySubjectFR(sanitizeSubjectFR(subject));
  const storiesBusiness = [
    `Le déclic sur les KPI : arrêter de mesurer “pour rassurer”, et mesurer pour décider.`,
    `J’ai vu des équipes optimiser un KPI… puis se demander pourquoi les résultats business ne suivaient pas.`,
    `Si vos KPI ne déclenchent aucune action, vous faites du reporting… pas du pilotage.`,
  ] as const;

  const storiesGeneral = [
    `Soyons honnêtes : ce n’est pas l’information qui manque. C’est l’exécution.`,
    `Le plus grand piège : attendre d’être prêt(e). On devient prêt(e) en faisant.`,
    `Ce qui change tout : un pas simple, répété.`,
  ] as const;

  if (cat === "business") return pick(rng, storiesBusiness);
  return pick(rng, storiesGeneral);
}

// ------------------------
// CTA (FR/EN) — garde commentaires >10 mots
// ------------------------

function buildCTA(subject: string, lang: Lang, objective: Objective, rng: () => number): string {
  const fr = lang === "fr";
  const sFR = prettySubjectFR(sanitizeSubjectFR(subject));
  const sEN = sanitizeSubjectEN(subject);

  const byObjFR: Record<Objective, readonly string[]> = {
    vendre: [
      `Vous voulez mon mini-cadre “KPI actionnables” ? Écrivez « KPI » + votre contexte en +10 mots.`,
      `Je vous envoie une checklist KPI. Dites votre objectif en +10 mots (sinon je réponds à côté).`,
      `Vous voulez l’exemple complet ? Écrivez « GO » + votre situation (au moins 10 mots).`,
    ],
    attirer: [
      `Question : quel KPI vous “trompe” le plus aujourd’hui ? Répondez en +10 mots.`,
      `Vous suivez plutôt trop de KPI… ou pas assez ? Expliquez en +10 mots.`,
      `Décrivez votre cas en +10 mots : je vous réponds avec 1 suggestion précise.`,
    ],
    éduquer: [
      `Quel est votre KPI #1 aujourd’hui, et pourquoi ? Répondez en +10 mots.`,
      `Vous voulez une mini-checklist adaptée ? Décrivez votre contexte en +10 mots.`,
      `Quelle erreur KPI voyez-vous le plus souvent ? Détaillez en +10 mots.`,
    ],
    recruter: [
      `Candidat(e) : rôle + ville + dispo + 1 phrase (10+ mots) sur votre rapport aux KPI/data.`,
      `Recruteur : décrivez le besoin data/KPI en +10 mots, je partage un cadre de sélection.`,
      `Intéressé(e) ? Décrivez votre profil en +10 mots (pour une réponse utile).`,
    ],
    inspirer: [
      `Quel KPI allez-vous arrêter de suivre cette semaine, et pourquoi ? Répondez en +10 mots.`,
      `Si vous démarrez une routine KPI, écrivez « JE COMMENCE » + votre objectif (10+ mots).`,
      `Quel petit pas KPI vous pouvez faire aujourd’hui ? Dites-le en +10 mots.`,
    ],
  };

  const byObjEN: Record<Objective, readonly string[]> = {
    vendre: [
      `Want my “actionable KPI” framework? Comment “KPI” + your context (10+ words).`,
      `I’ll send a KPI checklist. Share your goal in 10+ words.`,
      `Want the full example? Comment “GO” + your situation (10+ words).`,
    ],
    attirer: [
      `Which KPI misleads you the most today? Reply with 10+ words.`,
      `Do you track too many KPIs… or too few? Explain in 10+ words.`,
      `Share your case in 10+ words — I’ll reply with a tailored suggestion.`,
    ],
    éduquer: [
      `What’s your #1 KPI today, and why? Reply with 10+ words.`,
      `Want a tailored checklist? Describe your case in 10+ words.`,
      `What KPI mistake do you see most often? Explain in 10+ words.`,
    ],
    recruter: [
      `Candidate: role + city + availability + one KPI/data line (10+ words).`,
      `Recruiter: describe the KPI/data need in 10+ words — I’ll share an evaluation frame.`,
      `Interested? Describe your profile in 10+ words.`,
    ],
    inspirer: [
      `Which KPI will you stop tracking this week, and why? 10+ words.`,
      `If you start a KPI routine, comment “I START” + your goal (10+ words).`,
      `What tiny KPI step will you take today? 10+ words.`,
    ],
  };

  return pick(rng, fr ? byObjFR[objective] : byObjEN[objective]);
}

// ------------------------
// Hashtags (LinkedIn) — nettoyés
// ------------------------

function buildHashtags(subject: string, lang: Lang, objective: Objective, category: TopicCategory): string {
  const fr = lang === "fr";

  const raw = normSpaces(subject)
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9àâäçéèêëîïôöùûüÿñæœ\s-]/gi, " ")
    .replace(/-/g, " ");

  // mots à éviter en hashtags (faibles / inutiles / adverbes)
  const ban = new Set([
    "pourquoi","comment","intelligemment","intelligement","mesurer","mesure","faut","doit",
    "quoi","qui","quand","ou","où","avec","sans","dans","sur","de","des","du","la","le","les","une","un",
  ]);

  const stopFR = new Set([
    "et","donc","car","mais","au","aux","en","à","a","d","l","ce","cette","ces","son","sa","ses","mon","ma","mes",
    "ton","ta","tes","notre","nos","votre","vos","leur","leurs","il","elle","on","nous","vous","ils","elles",
  ]);
  const stopEN = new Set(["the","a","an","and","or","but","with","without","on","in","of","to","for","from"]);

  const stop = fr ? stopFR : stopEN;

  const words = raw
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => w.length >= 4 && !stop.has(w) && !ban.has(w))
    .map((w) => (w === "kpi" || w === "kpis" ? "kpi" : w));

  const uniq = Array.from(new Set(words)).slice(0, 4);

  const fromSubject = uniq.map((w) => `#${w.replace(/[^a-z0-9àâäçéèêëîïôöùûüÿñæœ]/gi, "")}`);

  const objectiveTagsFR: Record<Objective, readonly string[]> = {
    vendre: ["#business", "#marketing", "#growth"],
    attirer: ["#linkedin", "#contenu", "#personalbranding"],
    éduquer: ["#data", "#analytics", "#productivité"],
    recruter: ["#recrutement", "#carrière", "#talent"],
    inspirer: ["#mindset", "#discipline", "#leadership"],
  };
  const objectiveTagsEN: Record<Objective, readonly string[]> = {
    vendre: ["#business", "#marketing", "#growth"],
    attirer: ["#linkedin", "#content", "#personalbranding"],
    éduquer: ["#data", "#analytics", "#productivity"],
    recruter: ["#hiring", "#career", "#talent"],
    inspirer: ["#mindset", "#discipline", "#leadership"],
  };

  const catTagsFR: Record<TopicCategory, readonly string[]> = {
    stress: ["#santementale", "#bienetreautravail", "#résilience"],
    business: ["#KPI", "#Data", "#Performance", "#Pilotage"],
    tech: ["#tech", "#dev", "#productivité"],
    lifestyle: ["#habitudes", "#routine", "#équilibre"],
    general: ["#mindset", "#progression", "#discipline"],
  };
  const catTagsEN: Record<TopicCategory, readonly string[]> = {
    stress: ["#mentalhealth", "#wellbeing", "#resilience"],
    business: ["#KPI", "#Data", "#Analytics", "#Performance"],
    tech: ["#tech", "#dev", "#productivity"],
    lifestyle: ["#habits", "#routine", "#balance"],
    general: ["#mindset", "#growth", "#discipline"],
  };

  const liTags = fr ? ["#leadership", "#communication"] : ["#leadership", "#communication"];

  const objectiveTags = fr ? objectiveTagsFR[objective] : objectiveTagsEN[objective];
  const catTags = fr ? catTagsFR[category] : catTagsEN[category];

  const final = Array.from(new Set([...fromSubject, ...objectiveTags, ...catTags, ...liTags])).slice(0, 12);

  // ✅ garder KPI/Data en majuscules si présents
  return final
    .map((t) => (t.toLowerCase() === "#kpi" ? "#KPI" : t))
    .map((t) => (t.toLowerCase() === "#data" ? "#Data" : t))
    .join(" ");
}

// ------------------------
// Tone wrapper
// ------------------------

function toneWrapFR(tone: Tone, text: string, rng: () => number): string {
  if (tone === "corporate") return text;
  if (tone === "serieux") return text.replace(/😄|✨|👇/g, "").trim();
  if (tone === "fun") {
    const heads = ["On se dit la vérité ? 😄", "Petit rappel utile 👇", "Simple. Clair. Efficace. ✅", "Le twist que personne ne dit ✨"] as const;
    return joinParagraphs([pick(rng, heads), text]);
  }
  const cashHeads = ["Pas de blabla :", "On arrête de se mentir.", "Voici le vrai problème :"] as const;
  return joinParagraphs([pick(rng, cashHeads), text]);
}

function toneWrapEN(tone: Tone, text: string, rng: () => number): string {
  if (tone === "corporate") return text;
  if (tone === "serieux") return text.replace(/😄|✨|👇/g, "").trim();
  if (tone === "fun") {
    const heads = ["Truth time 😄", "Quick reminder 👇", "Simple and effective ✅"] as const;
    return joinParagraphs([pick(rng, heads), text]);
  }
  const heads = ["No fluff:", "Here’s the real issue:", "Let’s be honest:"] as const;
  return joinParagraphs([pick(rng, heads), text]);
}

// ------------------------
// Caption builders (LinkedIn 2026)
// ------------------------

function buildCaptionFR(subject: string, objective: Objective, tone: Tone, category: TopicCategory, rng: () => number): string {
  const hook = buildHookFR(subject, category, rng);
  const empathy = buildEmpathyFR(category, rng);
  const story = buildMiniStoryFR(subject, category, rng);

  let fw: Framework;
  if (category === "stress") fw = fwStressFR(objective, rng);
  else if (category === "business") fw = fwBusinessFR(subject, objective, rng);
  else if (category === "tech") fw = fwTechFR(subject, objective, rng);
  else if (category === "lifestyle") fw = fwLifestyleFR(subject, objective, rng);
  else fw = fwGeneralFR(subject, objective, rng);

  const steps = fw.steps.slice(0, 5);
  const close = fw.closeLine ?? "La régularité change tout.";

  const body = joinParagraphs([
    hook,
    "Soyons honnêtes : l’engagement vient des conversations, pas des formules parfaites.",
    empathy,
    story,
    "Voici une version simple à appliquer :",
    `✅ ${fw.title}`,
    bullets(steps, "–"),
    close,
  ]);

  const trimmed = trimToMaxChars(body, 1300);
  return toneWrapFR(tone, trimmed, rng);
}

function buildCaptionEN(subject: string, tone: Tone, category: TopicCategory, rng: () => number): string {
  const hook = `You measure KPIs… but do they actually change your decisions?`;
  const body = joinParagraphs([
    hook,
    "Let’s be honest: engagement comes from real conversations, not perfect formulas.",
    "Most teams track numbers… not signals.",
    "Here’s a simple approach:",
    "- Define the decision the KPI should help you make.",
    "- Add one context metric (quality / cost / churn).",
    "- Turn it into a weekly action, not a dashboard.",
    "Better 3 actionable KPIs than 30 pretty charts.",
  ]);
  const trimmed = trimToMaxChars(body, 1300);
  return toneWrapEN(tone, trimmed, rng);
}

// ------------------------
// Main
// ------------------------

export function generateLocalPost(args: Args): LocalPostResult {
  const network: Network = "linkedin";

  const parsed = parseToneFromSubject(args.subject);
  const subjectClean = parsed.cleanSubject;

  const category = detectCategory(subjectClean);
  const tone: Tone = (args.tone ?? parsed.tone ?? defaultTone()) as Tone;

  const seed = hashSeed(`${subjectClean}__${args.language}__${args.objective}__${network}__${tone}__${category}`);
  const rng = mulberry32(seed);

  const caption = args.language === "fr" ? buildCaptionFR(subjectClean, args.objective, tone, category, rng) : buildCaptionEN(subjectClean, tone, category, rng);

  const cta = buildCTA(subjectClean, args.language, args.objective, rng);
  const hashtags = buildHashtags(subjectClean, args.language, args.objective, category);

  return { caption, cta, hashtags };
}

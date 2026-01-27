export type Objective = "vendre" | "attirer" | "éduquer" | "recruter" | "inspirer";
export type Network = "linkedin" | "facebook" | "instagram" | "tiktok";

/**
 * Prompt copywriting + SEO + AIDA
 * IMPORTANT: Ce prompt est encapsulé par l’API qui force une réponse JSON.
 * => Donc ici, on ne met PAS de "CAPTION:" / "CTA:" / "HASHTAGS:" dans le texte.
 */
export const captionPrompt = (args: {
  subject: string;
  language: string; // "Français" | "Anglais" (ou tout texte)
  objective: Objective;
  network: Network;
}) => {
  const { subject, language, objective, network } = args;

  const objectiveCTA: Record<Objective, string[]> = {
    vendre: [
      "Écris « PRIX » en commentaire et je t’envoie les détails.",
      "DM « OFFRE » pour recevoir l’offre complète.",
      "Clique sur le lien (bio/DM) pour réserver.",
    ],
    attirer: [
      "Tu es d’accord ? Dis-le en commentaire.",
      "Quel est ton plus grand défi sur ce sujet ?",
      "Enregistre ce post pour plus tard.",
    ],
    éduquer: [
      "Enregistre ce post pour le relire.",
      "Si tu veux la checklist, commente « CHECKLIST ».",
      "Quelle astuce tu appliques dès aujourd’hui ?",
    ],
    recruter: [
      "Intéressé(e) ? Envoie ton CV en DM.",
      "Tag quelqu’un que ça peut intéresser.",
      "Clique pour postuler (lien/DM).",
    ],
    inspirer: [
      "Si ça te parle, mets un ❤️ en commentaire.",
      "Partage à quelqu’un qui en a besoin aujourd’hui.",
      "Quelle phrase tu retiens ?",
    ],
  };

  const pickCTA = (obj: Objective) => {
    const list = objectiveCTA[obj] ?? objectiveCTA.attirer;
    return list[0];
  };

  const rulesByNetwork: Record<Network, string> = {
    linkedin: `
RÈGLES LINKEDIN:
- Longueur: 1 000 à 2 000 caractères (micro-article).
- Hook: les 3 premières lignes très percutantes (pour “Voir plus”).
- Texte aéré: sauts de ligne fréquents.
- Style: professionnel mais humain (utilise “Je”).
- Hashtags: 3 à 5 maximum, à la fin.
- Objectif: expertise + storytelling (exemple perso ou leçon).
`.trim(),

    facebook: `
RÈGLES FACEBOOK:
- Longueur idéale: très court 40–80 caractères (priorité).
- Ton: décontracté, conversationnel.
- Finir par une question (obligatoire).
- Hashtags: 0 à 2 max (souvent 0).
`.trim(),

    instagram: `
RÈGLES INSTAGRAM:
- Accroche: <125 caractères.
- Longueur: 250–400 caractères (digeste).
- Emojis: oui, pour aérer (sans excès).
- Structure: Hook + valeur + CTA.
- SEO IG: placer les mots-clés importants dans la 1ère phrase.
- Hashtags: ~10 pertinents (mix populaires + niche) en bas.
`.trim(),

    tiktok: `
RÈGLES TIKTOK:
- Longueur: ~150 caractères (concis).
- Écrire comme un moteur de recherche: décrire littéralement ce que contient la vidéo.
- SEO: inclure une requête exacte + variantes.
- Hashtags: 3 à 6 (mix large + niche).
- CTA: commenter / suivre / DM / lien bio.
`.trim(),
  };

  const lengthAndTags: Record<Network, string> = {
    linkedin: `CAPTION: 1 000–2 000 caractères. Hashtags: 3–5.`,
    facebook: `CAPTION: 40–80 caractères (priorité). Hashtags: 0–2 (souvent 0). Finir par une question.`,
    instagram: `CAPTION: 250–400 caractères. Accroche <125 caractères. Hashtags: ~10.`,
    tiktok: `CAPTION: ~150 caractères. Hashtags: 3–6. Inclure une phrase descriptive sur le contenu.`,
  };

  /**
   * ✅ RÈGLES SEO (ce que tu demandes)
   * - Mots-clés autour du sujet (synonymes + sémantique)
   * - Chaque paragraphe doit “porter” le sujet (LinkedIn/IG)
   * - Pas de bourrage: naturel, lisible
   */
  const seoRules = `
RÈGLES SEO OBLIGATOIRES (IMPORTANT):
- Identifie: 1 mot-clé principal (lié au sujet) + 5 à 10 mots-clés secondaires (synonymes / variantes / termes sémantiques / contexte métier).
- Placement:
  - LinkedIn / Instagram: chaque paragraphe (séparé par une ligne vide) doit contenir au moins:
    • 1 mot-clé (principal OU secondaire)
    • + 1 terme de contexte (métier/secteur/problématique/outil) lié au sujet
  - Facebook / TikTok (texte court): inclure au minimum 1 mot-clé principal + 1 variante sémantique dans la seule phrase.
- Longue traîne: ajoute 1 expression “long-tail” (5–8 mots) qui décrit l’intention de l’audience (ex: “pour les managers débordés”, “pour les freelances”, etc.) si la longueur le permet.
- Naturel: aucune répétition forcée, pas de “keyword stuffing”. Priorité à la fluidité.
- Ciblage audience: fais comprendre implicitement à qui ça s’adresse (rôle, niveau, secteur) sans lister des personas.
`.trim();

  const universal = `
STRUCTURE OBLIGATOIRE (A.I.D.A):
- Attention: Hook (phrase choc ou question)
- Intérêt: pourquoi lire / promesse
- Désir: valeur (conseil, histoire, preuve, mini-étapes)
- Action: CTA clair

CONTRAINTES IMPORTANTES:
- Langue: ${language}
- Sujet: """${subject}"""
- Objectif: ${objective}
- Réseau: ${network}
- Respecte STRICTEMENT les longueurs/hashtags du réseau.
- Le CTA doit être 1 ligne, adapté au réseau + objectif.
`.trim();

  const ctaSuggestion = pickCTA(objective);

  return `
Tu es un copywriter expert + SEO.

Ta mission:
1) Écris une caption optimisée pour ${network}.
2) Propose un CTA (1 seule ligne) adapté au réseau et à l’objectif.
3) Propose des hashtags (respecte le nombre) pertinents au sujet, avec une part de mots-clés de niche.

${universal}

${seoRules}

RÈGLES SPÉCIFIQUES:
${rulesByNetwork[network]}
${lengthAndTags[network]}

SUGGESTION CTA (à adapter si besoin):
${ctaSuggestion}
`.trim();
};

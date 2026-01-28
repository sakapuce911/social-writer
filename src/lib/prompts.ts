// src/lib/prompts.ts

export type Objective = "vendre" | "attirer" | "éduquer" | "recruter" | "inspirer";
export type Network = "linkedin";

/**
 * Prompt copywriting + SEO + AIDA
 * IMPORTANT: Ce prompt est encapsulé par l’API qui force une réponse JSON.
 * => Donc ici, on ne met PAS de "CAPTION:" / "CTA:" / "HASHTAGS:" dans le texte.
 */
export const captionPrompt = (args: {
  subject: string;
  language: string; // "Français" | "Anglais" (ou tout texte)
  objective: Objective;
  network: Network; // LinkedIn only
}) => {
  const { subject, language, objective } = args;

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

  const rulesLinkedIn = `
RÈGLES LINKEDIN:
- Longueur: 1 000 à 2 000 caractères (micro-article).
- Hook: les 3 premières lignes très percutantes (pour “Voir plus”).
- Texte aéré: sauts de ligne fréquents.
- Style: professionnel mais humain (utilise “Je”).
- Hashtags: 3 à 5 maximum, à la fin.
- Objectif: expertise + storytelling (exemple perso ou leçon).
`.trim();

  const lengthAndTags = `CAPTION: 1 000–2 000 caractères. Hashtags: 3–5.`;

  /**
   * ✅ RÈGLES SEO (ce que tu demandes)
   * - Mots-clés autour du sujet (synonymes + sémantique)
   * - Chaque paragraphe doit “porter” le sujet (LinkedIn)
   * - Pas de bourrage: naturel, lisible
   */
  const seoRules = `
RÈGLES SEO OBLIGATOIRES (IMPORTANT):
- Identifie: 1 mot-clé principal (lié au sujet) + 5 à 10 mots-clés secondaires (synonymes / variantes / termes sémantiques / contexte métier).
- Placement (LinkedIn):
  - Chaque paragraphe (séparé par une ligne vide) doit contenir au moins:
    • 1 mot-clé (principal OU secondaire)
    • + 1 terme de contexte (métier/secteur/problématique/outil) lié au sujet
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
- Réseau: linkedin
- Respecte STRICTEMENT les longueurs/hashtags LinkedIn.
- Le CTA doit être 1 ligne, adapté à l’objectif.
`.trim();

  const ctaSuggestion = pickCTA(objective);

  return `
Tu es un copywriter expert + SEO.

Ta mission:
1) Écris une caption optimisée pour LinkedIn.
2) Propose un CTA (1 seule ligne) adapté à l’objectif.
3) Propose des hashtags (3 à 5) pertinents au sujet, avec une part de mots-clés de niche.

${universal}

${seoRules}

RÈGLES SPÉCIFIQUES:
${rulesLinkedIn}
${lengthAndTags}

SUGGESTION CTA (à adapter si besoin):
${ctaSuggestion}
`.trim();
};

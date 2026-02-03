// src/lib/prompts.ts

export type Objective = "vendre" | "attirer" | "éduquer" | "recruter" | "inspirer";
export type Network = "linkedin";

/**
 * Prompt LinkedIn 2026 (description de publication)
 * IMPORTANT: Ce prompt est encapsulé par l’API qui force une réponse JSON.
 * => Donc ici, on ne met PAS de "CAPTION:" / "CTA:" / "HASHTAGS:" dans le texte.
 *
 * Objectif 2026:
 * - Maximiser dwell time (lecture), sauvegardes, commentaires qualitatifs
 * - Éviter signaux négatifs (spam, CTA artificiels, liens)
 */
export const captionPrompt = (args: {
  subject: string;
  language: string; // "Français" | "Anglais" (ou tout texte)
  objective: Objective;
  network: Network; // LinkedIn only
}) => {
  const { subject, language, objective } = args;

  /**
   * ✅ CTA 2026 (NON ARTIFICIELS)
   * - On force une question finale ouverte qui appelle une réponse développée
   * - Pas de “Like si…”, pas de “Commente OUI/NON”, pas de “DM ‘OFFRE’”
   * - Pour vendre/recruter: on invite à partager le contexte/critères (conversation) au lieu de pousser une action agressive
   */
  const objectiveCTA: Record<Objective, string[]> = {
    vendre: [
      "Si vous deviez choisir 1 critère non négociable avant d’acheter, ce serait lequel — et pourquoi ?",
      "Qu’est-ce qui vous fait passer de “intéressant” à “je veux l’acheter” (sans promo) ?",
      "Quelle objection vous bloque le plus souvent avant de vous décider ?",
    ],
    attirer: [
      "Qu’est-ce qui vous a le plus surpris récemment sur ce sujet, et pourquoi ?",
      "Selon vous, quelle est l’erreur la plus fréquente ici (avec un exemple) ?",
      "Vous êtes plutôt “tester vite” ou “sécuriser avant d’agir” — et pourquoi ?",
    ],
    éduquer: [
      "Quelle étape vous semble la plus difficile à appliquer, concrètement, dans votre contexte ?",
      "Quelle règle vous a le plus aidé… ou le plus freiné ? Expliquez avec un exemple.",
      "Si vous deviez résumer la leçon en 1 phrase actionnable, ce serait quoi ?",
    ],
    recruter: [
      "Quand vous recrutez, quel signal vous donne le plus confiance (exemple concret) ?",
      "Côté candidat, qu’est-ce qui fait vraiment la différence dans votre secteur ?",
      "Quelle compétence est sous-estimée aujourd’hui — et pourquoi ?",
    ],
    inspirer: [
      "Quelle phrase vous auriez aimé entendre plus tôt dans votre parcours — et pourquoi ?",
      "Quel petit déclic a eu le plus d’impact chez vous (même si ça paraît simple) ?",
      "Qu’est-ce que vous choisissez de faire différemment cette semaine, concrètement ?",
    ],
  };

  const pickCTA = (obj: Objective) => {
    const list = objectiveCTA[obj] ?? objectiveCTA.attirer;
    return list[0];
  };

  /**
   * ✅ RÈGLES LINKEDIN 2026 (Description)
   * - Hook ultra-optimisé pour “Voir plus” (150–180 caractères)
   * - 1 seule idée (angle précis)
   * - Profondeur > généralités
   * - Lisibilité mobile (paragraphes très courts)
   * - Question finale ouverte (réponse > 10 mots)
   * - Hashtags 3–5 max, niche, fin de post
   * - AUCUN lien, AUCUNE URL, AUCUN appel artificiel
   */
  const rulesLinkedIn2026 = `
RÈGLES LINKEDIN 2026 (OBLIGATOIRES):
- Une seule idée centrale: choisis un angle précis. Si le sujet est trop large, restreins-le automatiquement.
- Hook: 150 à 180 caractères MAX, en 1–2 lignes, très percutant, qui donne envie de cliquer “Voir plus”.
- Pas de citations, pas de banalités, pas de “conseils génériques”.
- Profondeur: donne un insight non évident + un mini-framework (3 à 5 points MAX) OU une erreur fréquente expliquée OU un avant/après.
- Lisibilité: paragraphes de 1–2 lignes, sauts de ligne fréquents, pas de bloc dense.
- CTA: termine par UNE question ouverte intelligente (réponse développée, >10 mots). Pas de “like si…”, pas de “commente OUI/NON”, pas de “DM ‘OFFRE’”.
- Liens: AUCUN lien / URL dans le texte.
- Hashtags: 3 à 5 maximum, très ciblés, tout en bas.
- Longueur: vise ~900 à 1 300 caractères (lecture mobile + dwell time).
`.trim();

  /**
   * ✅ “SEO” version LinkedIn (sémantique, pas keyword stuffing)
   * On garde l’idée “mots-clés” mais en mode 2026:
   * - Cohérence sémantique
   * - Vocabulaire de niche
   * - Zéro répétition forcée
   */
  const semanticRules = `
RÈGLES SÉMANTIQUES (LINKEDIN 2026):
- Identifie 1 mot-clé principal lié au sujet + 5 à 10 termes secondaires (synonymes, variantes, jargon métier, outils, contexte).
- Intègre ces termes naturellement (sans répétition forcée).
- Chaque paragraphe doit contenir au moins:
  • 1 terme (principal OU secondaire)
  • + 1 élément concret (ex: chiffre, exemple, situation, outil, contrainte, “avant/après”).
- Interdiction du “keyword stuffing”: priorité à la fluidité et au sens.
- Le post doit faire comprendre implicitement l’audience visée (rôle/secteur/niveau) sans lister des personas.
`.trim();

  /**
   * ✅ STRUCTURE 2026 (description)
   * 1) Hook (150–180 chars)
   * 2) Contexte réel (observation/test)
   * 3) Insight + framework (3–5 points)
   * 4) Question finale (open-ended)
   * 5) Hashtags (3–5)
   */
  const universal = `
STRUCTURE OBLIGATOIRE (LINKEDIN 2026):
1) Hook (150–180 caractères max)
2) Contexte réel (1–3 paragraphes très courts)
3) Insight central + mini-framework (3–5 points max) OU erreur fréquente OU avant/après
4) Question finale ouverte (CTA)
5) Hashtags (3–5) tout en bas

CONTRAINTES IMPORTANTES:
- Langue: ${language}
- Sujet: """${subject}"""
- Objectif: ${objective}
- Réseau: linkedin
- Zéro lien / zéro URL / zéro promo agressive
`.trim();

  /**
   * ✅ Auto-contrôle: l’IA doit régénérer si non conforme
   * (sans le dire dans la réponse finale)
   */
  const selfCheck = `
AUTO-CONTRÔLE (OBLIGATOIRE AVANT RENDU):
- Le hook fait-il vraiment cliquer “Voir plus” ET fait-il 150–180 caractères max ?
- Le post traite-t-il UNE seule idée (angle précis) ?
- Y a-t-il au moins un élément concret (exemple/chiffre/situation) ?
- Le framework contient-il 3 à 5 points max ?
- Le texte est-il aéré (paragraphes 1–2 lignes) ?
- La question finale force-t-elle une réponse développée (>10 mots) ?
- Y a-t-il 3 à 5 hashtags max, niche, en bas ?
Si une règle échoue: régénère automatiquement. Ne mentionne jamais ce contrôle.
`.trim();

  const ctaSuggestion = pickCTA(objective);

  return `
Tu es un expert en copywriting LinkedIn 2026.

Ta mission:
- Génère une description de publication LinkedIn optimisée pour l’algorithme 2026:
  dwell time, sauvegardes, commentaires qualitatifs.
- Respecte STRICTEMENT les règles ci-dessous.

${universal}

${rulesLinkedIn2026}

${semanticRules}

QUESTION FINALE (exemple à adapter au sujet, doit rester ouverte et intelligente):
${ctaSuggestion}

${selfCheck}

IMPORTANT FORMAT:
- Ne mets pas de titres "CAPTION/CTA/HASHTAGS".
- Donne uniquement le texte final du post + les hashtags à la fin.
- Aucun commentaire meta, aucune explication.
`.trim();
};

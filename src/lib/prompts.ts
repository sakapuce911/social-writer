// src/lib/prompts.ts

export type Objective = "vendre" | "attirer" | "éduquer" | "recruter" | "inspirer";
export type Network = "linkedin";

/**
 * Prompt LinkedIn (cadre interne).
 * IMPORTANT: l’API force une réponse JSON, donc ici pas de titres CAPTION/CTA/HASHTAGS.
 */
export const captionPrompt = (args: {
  subject: string;
  language: string;
  objective: Objective;
  network: Network;
}) => {
  const { subject, language, objective } = args;

  const objectiveCTA: Record<Objective, string[]> = {
    vendre: [
      "Si vous deviez choisir 1 critère non négociable avant d’acheter, ce serait lequel — et pourquoi ?",
      "Quelle objection vous bloque le plus souvent avant de vous décider ? Donnez un exemple.",
      "Qu’est-ce qui vous fait passer de “intéressant” à “je veux l’acheter” (sans promo) ?",
    ],
    attirer: [
      "Selon vous, quelle est l’erreur la plus fréquente ici — avec un exemple concret ?",
      "Qu’est-ce qui vous a le plus surpris récemment sur ce sujet — et pourquoi ?",
      "Vous êtes plutôt “tester vite” ou “sécuriser avant d’agir” — et pourquoi ?",
    ],
    éduquer: [
      "Quelle étape vous semble la plus difficile à appliquer, concrètement, dans votre contexte ?",
      "Quelle règle vous a le plus aidé… ou le plus freiné ? Donnez un exemple.",
      "Si vous deviez résumer la leçon en 1 phrase actionnable, ce serait quoi ?",
    ],
    recruter: [
      "Quand vous recrutez, quel signal vous donne le plus confiance (exemple concret) ?",
      "Côté candidat, qu’est-ce qui fait vraiment la différence dans votre secteur ?",
      "Quelle compétence est sous-estimée aujourd’hui — et pourquoi ?",
    ],
    inspirer: [
      "Quel déclic concret a changé votre manière d’agir — et qu’est-ce que vous avez fait dès le lendemain ?",
      "Quel choix discret (mais difficile) vous a le plus fait grandir — et pourquoi ?",
      "Quelle action simple faites-vous aujourd’hui que votre “vous d’avant” n’aurait jamais faite ? Pourquoi ?",
    ],
  };

  const ctaSuggestion = (objectiveCTA[objective] ?? objectiveCTA.attirer)[0];

  return `
Tu es un expert en copywriting LinkedIn (règles internes).

CONTRAINTES:
- Langue: ${language}
- Sujet: """${subject}"""
- Objectif: ${objective}
- Réseau: linkedin
- Interdit: liens/URL, promo agressive, CTA artificiels (“like si…”, “commente GO”, “DM OFFRE”).
- Interdit: mentionner “2026”, “algorithme 2026”, “LinkedIn en 2026” (sauf si le sujet l’exige explicitement).

STRUCTURE OBLIGATOIRE:
1) Hook (1–2 lignes) : commence par “Vous”, vise 150–180 caractères, tension cognitive + promesse claire.
2) Contexte réel : mini-situation vécue / observation terrain / test (même simple).
3) Insight + mini-framework (3–5 points MAX) : points concrets, actionnables, pas génériques.
4) Question finale ouverte (finir par “?”) : réponse développée (>10 mots).
5) Hashtags : 3–5 max, niche, tout en bas.

LONGUEUR:
- Vise ~900 à 1 300 caractères.
- Texte aéré: paragraphes 1–2 lignes, retours à la ligne fréquents.

AUTO-CONTRÔLE (sans le dire):
- Une seule idée centrale (angle précis)
- Contexte réel présent
- Framework 3–5 points présent
- Question finale ouverte
- 3–5 hashtags max
Si une règle échoue: régénère.

IMPORTANT FORMAT:
- Ne mets pas de titres "CAPTION/CTA/HASHTAGS".
- Donne uniquement le texte final du post + les hashtags à la fin.
- Aucun commentaire meta.

QUESTION FINALE (exemple à adapter au sujet):
${ctaSuggestion}
`.trim();
};

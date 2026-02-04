// src/lib/prompts.ts

export type Objective = "vendre" | "attirer" | "éduquer" | "recruter" | "inspirer";
export type Network = "linkedin";

export const captionPrompt = (args: {
  subject: string;
  language: string; // "French" | "English"
  objective: Objective;
  network: Network;
}) => {
  const { subject, language, objective } = args;

  // ✅ CTA (question ouverte > 10 mots)
  const objectiveCTA: Record<Objective, string[]> = {
    vendre: [
      "Qu’est-ce qui vous fait passer de “intéressant” à “j’achète” sans promo, dans votre contexte précis ?",
      "Quelle objection revient le plus avant d’acheter, et comment vous la traitez concrètement ?",
      "Si vous deviez choisir 1 critère non négociable avant d’acheter, lequel et pourquoi ?",
    ],
    attirer: [
      "Quelle erreur voyez-vous le plus souvent sur ce sujet, et quel exemple concret vous vient en tête ?",
      "Qu’est-ce qui vous a surpris récemment sur ce sujet, et qu’est-ce que ça a changé pour vous ?",
      "Sur ce point, vous êtes plutôt “tester vite” ou “sécuriser avant d’agir” — dans quel cas, et pourquoi ?",
    ],
    éduquer: [
      "Quelle étape vous bloque le plus pour appliquer ça, et quel détail rend ça difficile chez vous ?",
      "Qu’est-ce qui a le plus amélioré vos résultats ici, et comment l’avez-vous mis en place concrètement ?",
      "Si vous deviez l’expliquer à un collègue en 30 secondes, vous diriez quoi exactement ?",
    ],
    recruter: [
      "Quel signal vous donne le plus confiance chez un candidat, et quel exemple vous a marqué récemment ?",
      "Quelle compétence est sous-estimée aujourd’hui, et comment la repérez-vous en entretien ?",
      "Qu’est-ce qui fait vraiment la différence sur un profil, selon votre contexte et vos exigences ?",
    ],
    inspirer: [
      "Quel déclic concret a changé votre façon d’agir, et qu’avez-vous fait dès le lendemain (vraiment) ?",
      "Quel choix discret mais difficile vous a fait grandir, et qu’est-ce que ça a débloqué ensuite ?",
      "Quelle action simple cette semaine vous rend fier, et quel impact concret ça a eu autour de vous ?",
    ],
  };

  // ✅ Angle (les 5 objectifs doivent produire des posts différents)
  const objectiveAngle: Record<Objective, string> = {
    vendre: "ANGLE VENDRE : valeur, différenciation, coût d’inaction, objections, preuves, comparaison.",
    attirer: "ANGLE ATTIRER : opinion claire, erreur fréquente, contre-intuitif, tension cognitive, exemple réel.",
    éduquer: "ANGLE ÉDUQUER : méthode étape-par-étape, mini-framework pédagogique, erreurs + correctifs, concret.",
    recruter: "ANGLE RECRUTER : signaux de sélection, attentes, erreurs de recrutement, critères, exemples terrain.",
    inspirer: "ANGLE INSPIRER : déclic vécu + action concrète + leçon précise (pas de motivation creuse).",
  };

  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
  const cta = pick(objectiveCTA[objective] ?? objectiveCTA.attirer);

  /**
   * IMPORTANT : ton audit prend le HOOK = 1ère ligne
   * => on force une 1ère ligne 150–180 chars.
   * Et on force paragraphes courts + framework 3–5 points.
   */
  return `
Tu es un expert LinkedIn. Tu dois produire un post qui passe un audit strict.

LANGUE: ${language}
SUJET: """${subject}"""
OBJECTIF: ${objective}
${objectiveAngle[objective]}

RÈGLES OBLIGATOIRES POUR L’AUDIT:
- Ne mentionne PAS "2026" (sauf si le sujet l'exige explicitement).
- La 1ère ligne (HOOK) doit faire ENTRE 150 ET 180 CARACTÈRES (inclus). C’est CRITIQUE.
- Hook = 1 seule ligne (pas de retour à la ligne dans le hook). Ensuite, saute une ligne vide.
- Caption doit faire environ 900 à 1300 caractères.
- Paragraphes très courts: 1–2 lignes. Utilise des lignes vides entre paragraphes.
- Donne un CONTEXTE RÉEL (observation, mini-histoire, chiffre, avant/après).
- Donne un mini-framework de 3 à 5 points MAX en liste (utilise "-" en début de ligne).
- AUCUN lien / AUCUNE URL.
- CTA = UNE question ouverte (réponse développée > 10 mots) et doit finir par "?".

HASHTAGS:
- 3 à 5 hashtags MAX, de niche, en bas, format "#tag".

FORMAT DE SORTIE STRICT (pas de markdown):
CAPTION:
(ici la caption complète, avec le hook en 1ère ligne, puis paragraphes, puis la liste 3–5 points)

CTA:
${cta}

HASHTAGS:
(3 à 5 hashtags, une seule ligne)
`.trim();
};

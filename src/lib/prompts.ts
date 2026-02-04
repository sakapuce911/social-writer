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

  const objectiveStyle: Record<Objective, string> = {
    vendre:
      "STYLE VENDRE: bénéfices concrets, preuve, réassurance, différenciation claire, objection handling doux. Ton direct, orienté décision. Pas agressif.",
    attirer:
      "STYLE ATTIRER: conversation early, opinion claire, tension cognitive, contre-intuitif, exemple réel. Phrases courtes. Ton humain, pas coach.",
    éduquer:
      "STYLE ÉDUQUER: mini-framework pédagogique 3–5 points, étapes actionnables, erreurs fréquentes + correctifs. Très sauvegardable.",
    recruter:
      "STYLE RECRUTER: critères, signaux, attentes, erreurs de recrutement, exemples terrain. Ton pro, précis, humain, inclusif.",
    inspirer:
      "STYLE INSPIRER: vécu court + déclic + action concrète + leçon spécifique. " +
      "Autorisé: 'soyons honnêtes' si pertinent. Zéro motivation creuse, zéro phrases génériques.",
  };

  return `
Tu es un expert LinkedIn. Tu écris un post conçu pour maximiser la lecture, la rétention et les commentaires qualitatifs.

LANGUE: ${language}
SUJET: """${subject}"""
OBJECTIF: ${objective}
${objectiveStyle[objective]}

RÈGLES LINKEDIN (OBLIGATOIRES)
- Tout doit être généré par l’IA (aucun contenu pré-écrit, pas de CTA imposée depuis le code).
- Ton naturel, crédible, humain. Si utile: "soyons honnêtes".
- Ne pas utiliser de jargon type "KPI" sauf si le sujet l'impose explicitement.
- Ne mentionne PAS "2026" (sauf si le sujet l'exige explicitement).
- AUCUN lien / AUCUNE URL.

CONTRAINTES DE STRUCTURE
- Tu dois répondre UNIQUEMENT avec un JSON strict (aucun texte autour, aucun markdown, aucun bloc \`\`\`).
- "cta" doit être une question (pas une phrase).
- La "caption" doit se terminer par "?" OU la "cta" doit se terminer par "?" (au moins un des deux).
- Le champ "caption" commence par le HOOK en 1ère ligne, puis 1 ligne vide, puis le reste.
- HOOK (1ère ligne de "caption"):
  * commence OBLIGATOIREMENT par "Vous"
  * doit inclure AU MOINS 1 des 2 éléments: (un chiffre) OU (une question ?)
  * longueur: ENTRE 150 ET 180 caractères (inclus)
  * 1 seule ligne
- Caption (hors CTA/hashtags): environ 900 à 1300 caractères.
- Paragraphes très courts (1–2 lignes) + ligne vide entre paragraphes.
- 1 seule idée principale (pas de dispersion).
- Contexte réel: observation / mini-histoire / avant-après,
  MAIS n’invente pas de chiffres précis si le sujet n’en fournit pas.
- Inclure un mini-framework de 3 à 5 points MAX en liste, chaque point commence par "- " (tiret + espace).
- Fin de caption : une question ouverte (pour déclencher des commentaires qualitatifs).

CONTRAINTES CTA + HASHTAGS
- "cta" doit être une question ouverte, qui pousse à une réponse développée (> 10 mots).
- La CTA doit se terminer par "?".
- Hashtags: 3 à 5, uniques, de niche, format "#tag", sur une seule ligne.

SORTIE ATTENDUE (JSON strict):
{
  "caption": "HOOK (150–180 chars)\\n\\n...caption...?",
  "cta": "question ouverte (générée par l’IA) ?",
  "hashtags": "#tag1 #tag2 #tag3"
}
`.trim();
};

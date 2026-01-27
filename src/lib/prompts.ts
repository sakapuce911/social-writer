export type Objective = "vendre" | "attirer" | "éduquer" | "recruter" | "inspirer";
export type Network = "linkedin" | "facebook" | "instagram" | "tiktok";

/**
 * Règles basées sur TON guide (longueur, structure, hashtags, ton, SEO)
 * + structure A.I.D.A. appliquée partout.
 *
 * IMPORTANT: Ce prompt est conçu pour être encapsulé par l’API en "réponds en JSON".
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
    // on garde une suggestion, mais le modèle doit adapter au réseau
    return list[0];
  };

  const rulesByNetwork: Record<Network, string> = {
    linkedin: `
RÈGLES LINKEDIN (Ton guide):
- Longueur recommandée: 1 000 à 2 000 caractères (format micro-article).
- Accroche: les 3 premières lignes doivent être très percutantes (pour “Voir plus”).
- Texte aéré: sauts de ligne fréquents, pas de gros blocs.
- Style: professionnel mais humain. Utiliser “Je” plutôt que “Nous” corporate.
- Mots-clés: intégrer naturellement des termes de l’industrie liés au sujet (SEO LinkedIn).
- Hashtags: 3 à 5 maximum, à la fin du post.
- Objectif: expertise + storytelling (exemple perso ou leçon).
`.trim(),

    facebook: `
RÈGLES FACEBOOK (Ton guide):
- Longueur idéale: très court 40–80 caractères (sinon moyen mais émotionnel).
- Ton: décontracté, conversationnel, proche.
- Finir par une question pour déclencher les commentaires.
- Éviter le langage corporate.
- Hashtags: 0 à 2 max (souvent éviter).
- Objectif: communauté + émotion + discussion.
`.trim(),

    instagram: `
RÈGLES INSTAGRAM (Ton guide):
- Accroche: doit tenir dans les 125 premiers caractères.
- Longueur: 250–400 caractères en moyenne (possible plus long si éducatif mais reste digeste).
- Emojis: indispensables pour le ton et l’aération (sans excès).
- Structure: Hook fort + valeur + CTA.
- Mots-clés: importants pour le SEO IG, placer les mots clés dans la 1ère phrase.
- Hashtags: viser ~10 pertinents (mix populaires + niche). Les mettre en bas.
- CTA: “Lien en bio”, “Enregistre”, “Identifie un ami”, “DM”.
`.trim(),

    tiktok: `
RÈGLES TIKTOK (Ton guide):
- Longueur: très court ~150 caractères (concis).
- Écrire comme un moteur de recherche: décrire littéralement ce que contient la vidéo.
- Mots-clés SEO: CRUCIAL. Inclure la requête exacte (ex: “recette de pâtes facile”).
- Hashtags: 3 à 6 (mix larges type #pourtoi + niche).
- Objectif: vitesse + SEO + tendance. CTA: commenter / suivre / DM / lien bio.
`.trim(),
  };

  // Ajustements par réseau (hashtags + longueur stricte)
  const lengthAndTags: Record<Network, string> = {
    linkedin: `Cible CAPTION: 1 000–2 000 caractères. Hashtags: 3–5.`,
    facebook: `Cible CAPTION: 40–80 caractères (priorité). Hashtags: 0–2 (souvent 0). La CAPTION doit se terminer par une question.`,
    instagram: `Cible CAPTION: 250–400 caractères. Accroche <125 caractères. Hashtags: ~10.`,
    tiktok: `Cible CAPTION: ~150 caractères. Hashtags: 3–6. Inclure une phrase descriptive: ce que montre la vidéo.`,
  };

  // Consignes universelles A.I.D.A
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
- Intègre des mots-clés naturellement (sans bourrage).
- Respecte STRICTEMENT les longueurs/hashtags du réseau.
- Le CTA doit être 1 ligne, adapté au réseau + objectif.
`.trim();

  const ctaSuggestion = pickCTA(objective);

  // ⚠️ Ici on ne force PAS la sortie en "CAPTION/CTA/HASHTAGS"
  // car l'API encapsule ensuite en "réponds en JSON".
  return `
Tu es un copywriter expert.

Ta mission:
1) Écris une caption optimisée pour ${network} en respectant les règles ci-dessous.
2) Propose un CTA (1 seule ligne) adapté au réseau et à l’objectif.
3) Propose des hashtags (respecte le nombre) en les rendant pertinents au sujet, dont quelques mots-clés de niche.

${universal}

RÈGLES SPÉCIFIQUES:
${rulesByNetwork[network]}
${lengthAndTags[network]}

SUGGESTION CTA (à adapter si besoin):
${ctaSuggestion}
`.trim();
};

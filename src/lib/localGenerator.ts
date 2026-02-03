// src/lib/localGenerator.ts
// ⚠️ DEPRECATED (2026)
// La génération locale a été supprimée : Social Writer est désormais IA-only.
//
// On conserve uniquement les types partagés pour éviter des imports cassés
// si d'autres fichiers les utilisaient. Aucune génération locale n'est disponible.

export type Objective = "vendre" | "attirer" | "éduquer" | "recruter" | "inspirer";
export type Network = "linkedin";
export type Lang = "fr" | "en";
export type Tone = "corporate" | "serieux" | "fun" | "cash";

export type LocalPostResult = {
  caption: string;
  cta: string;
  hashtags: string;
};

// ❌ La fonction generateLocalPost a été volontairement supprimée.

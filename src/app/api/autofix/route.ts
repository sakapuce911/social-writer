// src/app/api/autofix/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Auto-fix IA a été supprimé volontairement.
 * On garde la route pour éviter les erreurs côté clients anciens / caches,
 * et on renvoie un statut explicite.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "Auto-fix IA a été supprimé.",
      code: "gone",
    },
    { status: 410 }
  );
}
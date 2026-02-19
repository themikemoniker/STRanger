import { NextResponse } from "next/server";
import { hookEvents } from "@stranger/db";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/ids";
import { apiError, now } from "@/lib/api-helpers";

export async function POST(request: Request) {
  const db = getDb();
  const body = await request.json().catch(() => null);

  if (!body || !body.hookType) {
    return apiError("hookType is required");
  }

  const event = {
    id: newId("hk"),
    hookType: body.hookType as string,
    payload: body.filePath ? JSON.stringify({ filePath: body.filePath, sessionId: body.sessionId }) : null,
    processedAt: null,
    createdAt: now(),
  };

  db.insert(hookEvents).values(event).run();

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { verificationRuns } from "@ranger/db";
import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const scenarioId = searchParams.get("scenarioId");

  if (scenarioId) {
    const rows = db
      .select()
      .from(verificationRuns)
      .where(eq(verificationRuns.scenarioId, scenarioId))
      .all();
    return NextResponse.json(rows);
  }

  const rows = db.select().from(verificationRuns).all();
  return NextResponse.json(rows);
}

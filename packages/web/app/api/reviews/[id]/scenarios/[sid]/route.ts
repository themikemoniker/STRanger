import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { scenarios } from "@ranger/db";
import { getDb } from "@/lib/db";
import { apiError, now } from "@/lib/api-helpers";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; sid: string }> },
) {
  const { sid } = await params;
  const db = getDb();
  const body = await request.json();

  const existing = db
    .select()
    .from(scenarios)
    .where(eq(scenarios.id, sid))
    .get();
  if (!existing) return apiError("Scenario not found", 404);

  db.update(scenarios)
    .set({ ...body, updatedAt: now() })
    .where(eq(scenarios.id, sid))
    .run();

  const updated = db
    .select()
    .from(scenarios)
    .where(eq(scenarios.id, sid))
    .get();
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; sid: string }> },
) {
  const { sid } = await params;
  const db = getDb();

  const existing = db
    .select()
    .from(scenarios)
    .where(eq(scenarios.id, sid))
    .get();
  if (!existing) return apiError("Scenario not found", 404);

  db.delete(scenarios).where(eq(scenarios.id, sid)).run();
  return NextResponse.json({ deleted: true });
}

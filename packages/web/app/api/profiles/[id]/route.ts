import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { profiles } from "@stranger/db";
import { getDb } from "@/lib/db";
import { apiError, now } from "@/lib/api-helpers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();
  const row = db.select().from(profiles).where(eq(profiles.id, id)).get();
  if (!row) return apiError("Profile not found", 404);
  return NextResponse.json(row);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();
  const body = await request.json();

  const existing = db.select().from(profiles).where(eq(profiles.id, id)).get();
  if (!existing) return apiError("Profile not found", 404);

  db.update(profiles)
    .set({ ...body, updatedAt: now() })
    .where(eq(profiles.id, id))
    .run();

  const updated = db.select().from(profiles).where(eq(profiles.id, id)).get();
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();

  const existing = db.select().from(profiles).where(eq(profiles.id, id)).get();
  if (!existing) return apiError("Profile not found", 404);

  db.delete(profiles).where(eq(profiles.id, id)).run();
  return NextResponse.json({ deleted: true });
}

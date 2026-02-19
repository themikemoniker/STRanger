import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { profiles } from "@stranger/db";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/ids";
import { apiError, now } from "@/lib/api-helpers";

export async function GET() {
  const db = getDb();
  const rows = db.select().from(profiles).all();
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const db = getDb();
  const body = await request.json();

  if (!body.name || !body.baseUrl) {
    return apiError("name and baseUrl are required");
  }

  const existing = db
    .select()
    .from(profiles)
    .where(eq(profiles.name, body.name))
    .get();
  if (existing) {
    return apiError("Profile name already exists", 409);
  }

  const ts = now();
  const row = {
    id: newId("prof"),
    name: body.name as string,
    baseUrl: body.baseUrl as string,
    browser: (body.browser as string) || "chromium",
    viewport: (body.viewport as string) || null,
    isDefault: body.isDefault ? 1 : 0,
    createdAt: ts,
    updatedAt: ts,
  };

  db.insert(profiles).values(row).run();
  return NextResponse.json(row, { status: 201 });
}

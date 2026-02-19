import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { join } from "node:path";
import { homedir } from "node:os";
import { readFile } from "node:fs/promises";
import { artifacts, verificationRuns } from "@ranger/db";
import { getDb } from "@/lib/db";
import { apiError } from "@/lib/api-helpers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();

  const artifact = db
    .select()
    .from(artifacts)
    .where(eq(artifacts.id, id))
    .get();
  if (!artifact) return apiError("Artifact not found", 404);

  const run = db
    .select()
    .from(verificationRuns)
    .where(eq(verificationRuns.id, artifact.runId))
    .get();
  if (!run) return apiError("Run not found", 404);

  const filePath = join(
    homedir(),
    ".ranger",
    "data",
    "artifacts",
    run.id,
    artifact.filename,
  );

  try {
    const buffer = await readFile(filePath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": artifact.mimeType,
        "Content-Length": String(buffer.length),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return apiError("File not found on disk", 404);
  }
}

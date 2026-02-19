import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { verificationRuns, artifacts, scenarios, profiles } from "@ranger/db";
import { getDb } from "@/lib/db";
import { apiError } from "@/lib/api-helpers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();

  const run = db
    .select()
    .from(verificationRuns)
    .where(eq(verificationRuns.id, id))
    .get();
  if (!run) return apiError("Run not found", 404);

  const runArtifacts = db
    .select()
    .from(artifacts)
    .where(eq(artifacts.runId, id))
    .all();

  const scenario = db
    .select()
    .from(scenarios)
    .where(eq(scenarios.id, run.scenarioId))
    .get();

  const profile = db
    .select()
    .from(profiles)
    .where(eq(profiles.id, run.profileId))
    .get();

  return NextResponse.json({
    ...run,
    artifacts: runArtifacts,
    scenario,
    profile,
  });
}

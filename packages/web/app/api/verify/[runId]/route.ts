import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { verificationRuns, artifacts, scenarios } from "@ranger/db";
import { getDb } from "@/lib/db";
import { apiError } from "@/lib/api-helpers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const db = getDb();

  const run = db
    .select()
    .from(verificationRuns)
    .where(eq(verificationRuns.id, runId))
    .get();
  if (!run) return apiError("Run not found", 404);

  const runArtifacts = db
    .select()
    .from(artifacts)
    .where(eq(artifacts.runId, runId))
    .all();

  const scenario = db
    .select()
    .from(scenarios)
    .where(eq(scenarios.id, run.scenarioId))
    .get();

  return NextResponse.json({
    ...run,
    artifacts: runArtifacts,
    scenario,
    done: run.verdict !== "running" && run.verdict !== "pending",
  });
}

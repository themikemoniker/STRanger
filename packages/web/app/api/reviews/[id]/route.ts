import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { featureReviews, scenarios, verificationRuns, artifacts, profiles } from "@ranger/db";
import { getDb } from "@/lib/db";
import { apiError, now } from "@/lib/api-helpers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();

  const review = db
    .select()
    .from(featureReviews)
    .where(eq(featureReviews.id, id))
    .get();
  if (!review || review.deletedAt) {
    return apiError("Review not found", 404);
  }

  const profile = review.profileId
    ? db.select().from(profiles).where(eq(profiles.id, review.profileId)).get()
    : null;

  const scenarioRows = db
    .select()
    .from(scenarios)
    .where(eq(scenarios.reviewId, id))
    .all();

  // Enrich scenarios with their latest runs + artifacts
  const enrichedScenarios = scenarioRows.map((sc) => {
    const runs = db
      .select()
      .from(verificationRuns)
      .where(eq(verificationRuns.scenarioId, sc.id))
      .all();

    const enrichedRuns = runs.map((run) => ({
      ...run,
      artifacts: db
        .select()
        .from(artifacts)
        .where(eq(artifacts.runId, run.id))
        .all(),
    }));

    return { ...sc, runs: enrichedRuns };
  });

  return NextResponse.json({
    ...review,
    profile,
    scenarios: enrichedScenarios,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();
  const body = await request.json();

  const existing = db
    .select()
    .from(featureReviews)
    .where(eq(featureReviews.id, id))
    .get();
  if (!existing || existing.deletedAt) {
    return apiError("Review not found", 404);
  }

  db.update(featureReviews)
    .set({ ...body, updatedAt: now() })
    .where(eq(featureReviews.id, id))
    .run();

  const updated = db
    .select()
    .from(featureReviews)
    .where(eq(featureReviews.id, id))
    .get();

  const updatedScenarios = db
    .select()
    .from(scenarios)
    .where(eq(scenarios.reviewId, id))
    .all();

  return NextResponse.json({ ...updated, scenarios: updatedScenarios });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();

  const existing = db
    .select()
    .from(featureReviews)
    .where(eq(featureReviews.id, id))
    .get();
  if (!existing || existing.deletedAt) {
    return apiError("Review not found", 404);
  }

  // Soft delete
  db.update(featureReviews)
    .set({ deletedAt: now(), updatedAt: now() })
    .where(eq(featureReviews.id, id))
    .run();

  return NextResponse.json({ deleted: true });
}

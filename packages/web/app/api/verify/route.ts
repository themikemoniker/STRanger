import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { featureReviews, scenarios, profiles } from "@ranger/db";
import { getDb } from "@/lib/db";
import { apiError, now } from "@/lib/api-helpers";
import { startVerification } from "@/lib/agent-manager";

export async function POST(request: Request) {
  const db = getDb();
  const body = await request.json();

  if (!body.reviewId) {
    return apiError("reviewId is required");
  }

  // Load review
  const review = db
    .select()
    .from(featureReviews)
    .where(eq(featureReviews.id, body.reviewId))
    .get();
  if (!review || review.deletedAt) {
    return apiError("Review not found", 404);
  }

  // Determine profile
  const profileId = body.profileId || review.profileId;
  if (!profileId) {
    return apiError("No profile specified and review has no default profile");
  }

  const profile = db
    .select()
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .get();
  if (!profile) {
    return apiError("Profile not found", 404);
  }

  // Get scenarios to run
  let scenarioRows = db
    .select()
    .from(scenarios)
    .where(eq(scenarios.reviewId, body.reviewId))
    .all();

  if (body.scenarioIds && Array.isArray(body.scenarioIds)) {
    const ids = new Set(body.scenarioIds as string[]);
    scenarioRows = scenarioRows.filter((s) => ids.has(s.id));
  }

  if (scenarioRows.length === 0) {
    return apiError("No scenarios to verify");
  }

  // Update review status
  db.update(featureReviews)
    .set({ status: "in_progress", updatedAt: now() })
    .where(eq(featureReviews.id, body.reviewId))
    .run();

  // Start a run for each scenario
  const runIds: string[] = [];
  for (const sc of scenarioRows) {
    const runId = startVerification({
      scenarioId: sc.id,
      profileId: profile.id,
      baseUrl: profile.baseUrl,
      browser: profile.browser || "chromium",
      viewport: profile.viewport || undefined,
      scenarioTitle: sc.title,
      scenarioDescription: sc.description,
      startPath: sc.startPath,
      notes: body.notes || undefined,
    });
    runIds.push(runId);
  }

  return NextResponse.json(
    {
      reviewId: body.reviewId,
      runIds,
      scenarioCount: scenarioRows.length,
    },
    { status: 202 },
  );
}

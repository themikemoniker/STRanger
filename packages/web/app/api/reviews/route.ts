import { NextResponse } from "next/server";
import { eq, isNull, and } from "drizzle-orm";
import { featureReviews, scenarios } from "@ranger/db";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/ids";
import { apiError, now } from "@/lib/api-helpers";
import type { CreateScenarioInput } from "@ranger/db/types";

export async function GET(request: Request) {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const branch = searchParams.get("branch");

  const conditions = [isNull(featureReviews.deletedAt)];
  if (status) {
    conditions.push(eq(featureReviews.status, status));
  }
  if (branch) {
    conditions.push(eq(featureReviews.branch, branch));
  }

  const rows = db
    .select()
    .from(featureReviews)
    .where(and(...conditions))
    .all();

  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const db = getDb();
  const body = await request.json();

  if (!body.title) {
    return apiError("title is required");
  }

  const ts = now();
  const reviewId = newId("rev");

  const review = {
    id: reviewId,
    title: body.title as string,
    description: (body.description as string) || null,
    status: "draft",
    branch: (body.branch as string) || null,
    profileId: (body.profileId as string) || null,
    createdAt: ts,
    updatedAt: ts,
  };

  db.insert(featureReviews).values(review).run();

  // Insert scenarios if provided
  if (body.scenarios && Array.isArray(body.scenarios)) {
    const scenarioRows = (body.scenarios as CreateScenarioInput[]).map(
      (s, i) => ({
        id: newId("sc"),
        reviewId,
        ordinal: i + 1,
        title: s.title,
        description: s.description,
        startPath: s.startPath || null,
        status: "pending",
        createdAt: ts,
        updatedAt: ts,
      }),
    );
    if (scenarioRows.length > 0) {
      db.insert(scenarios).values(scenarioRows).run();
    }
  }

  // Return with scenarios
  const created = db
    .select()
    .from(featureReviews)
    .where(eq(featureReviews.id, reviewId))
    .get();
  const createdScenarios = db
    .select()
    .from(scenarios)
    .where(eq(scenarios.reviewId, reviewId))
    .all();

  return NextResponse.json(
    { ...created, scenarios: createdScenarios },
    { status: 201 },
  );
}

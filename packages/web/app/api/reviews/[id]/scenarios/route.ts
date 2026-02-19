import { NextResponse } from "next/server";
import { eq, count } from "drizzle-orm";
import { scenarios, featureReviews } from "@stranger/db";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/ids";
import { apiError, now } from "@/lib/api-helpers";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: reviewId } = await params;
  const db = getDb();
  const body = await request.json();

  // Verify review exists
  const review = db
    .select()
    .from(featureReviews)
    .where(eq(featureReviews.id, reviewId))
    .get();
  if (!review || review.deletedAt) {
    return apiError("Review not found", 404);
  }

  if (!body.title || !body.description) {
    return apiError("title and description are required");
  }

  // Get next ordinal
  const [{ value: total }] = db
    .select({ value: count() })
    .from(scenarios)
    .where(eq(scenarios.reviewId, reviewId))
    .all();

  const ts = now();
  const row = {
    id: newId("sc"),
    reviewId,
    ordinal: total + 1,
    title: body.title as string,
    description: body.description as string,
    startPath: (body.startPath as string) || null,
    status: "pending",
    createdAt: ts,
    updatedAt: ts,
  };

  db.insert(scenarios).values(row).run();
  return NextResponse.json(row, { status: 201 });
}

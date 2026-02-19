import { NextResponse } from "next/server";
import { eq, isNull, and, ne } from "drizzle-orm";
import { featureReviews } from "@stranger/db";
import { getDb } from "@/lib/db";
import { apiError } from "@/lib/api-helpers";

export async function POST(request: Request) {
  const db = getDb();
  const body = await request.json().catch(() => null);

  if (!body || !body.branch) {
    return apiError("branch is required");
  }

  const review = db
    .select()
    .from(featureReviews)
    .where(
      and(
        eq(featureReviews.branch, body.branch as string),
        ne(featureReviews.status, "draft"),
        isNull(featureReviews.deletedAt),
      ),
    )
    .get();

  if (!review) {
    return NextResponse.json({
      shouldVerify: false,
      message: `No active review found for branch "${body.branch}".`,
    });
  }

  return NextResponse.json({
    review: { id: review.id, title: review.title, status: review.status },
    shouldVerify: true,
    message: `Review "${review.title}" (${review.id}) is active on this branch. Run \`stranger go ${review.id}\` to verify.`,
  });
}

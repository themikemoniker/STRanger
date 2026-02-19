import Link from "next/link";
import { eq } from "drizzle-orm";
import {
  featureReviews,
  scenarios,
  verificationRuns,
  profiles,
} from "@stranger/db";
import { getDb } from "@/lib/db";
import { StatusBadge } from "@/app/components/status-badge";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();

  const review = db
    .select()
    .from(featureReviews)
    .where(eq(featureReviews.id, id))
    .get();

  if (!review || review.deletedAt) notFound();

  const profile = review.profileId
    ? db.select().from(profiles).where(eq(profiles.id, review.profileId)).get()
    : null;

  const scenarioRows = db
    .select()
    .from(scenarios)
    .where(eq(scenarios.reviewId, id))
    .all();

  // Enrich each scenario with its latest run
  const enrichedScenarios = scenarioRows.map((sc) => {
    const runs = db
      .select()
      .from(verificationRuns)
      .where(eq(verificationRuns.scenarioId, sc.id))
      .all();
    const latestRun = runs.length > 0 ? runs[runs.length - 1] : null;
    return { ...sc, latestRun, runCount: runs.length };
  });

  return (
    <div>
      <div className="mb-2">
        <Link
          href="/reviews"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; Reviews
        </Link>
      </div>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{review.title}</h1>
          {review.description && (
            <p className="mt-1 text-gray-600">{review.description}</p>
          )}
          <div className="mt-2 flex items-center gap-3 text-sm text-gray-500">
            {review.branch && (
              <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">
                {review.branch}
              </span>
            )}
            {profile && <span>Profile: {profile.name}</span>}
          </div>
        </div>
        <StatusBadge status={review.status} />
      </div>

      <h2 className="text-lg font-semibold mb-3">
        Scenarios ({scenarioRows.length})
      </h2>

      {scenarioRows.length === 0 ? (
        <p className="text-gray-500">No scenarios yet.</p>
      ) : (
        <div className="space-y-3">
          {enrichedScenarios.map((sc) => (
            <div
              key={sc.id}
              className="rounded-lg border border-gray-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-400">
                      #{sc.ordinal}
                    </span>
                    <h3 className="font-semibold">{sc.title}</h3>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">
                    {sc.description}
                  </p>
                  {sc.startPath && (
                    <span className="mt-1 inline-block rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-600">
                      {sc.startPath}
                    </span>
                  )}
                </div>
                <StatusBadge status={sc.status} />
              </div>

              {sc.latestRun && (
                <div className="mt-3 border-t border-gray-100 pt-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={sc.latestRun.verdict} />
                      <span className="text-gray-500">
                        {sc.latestRun.durationMs
                          ? `${(sc.latestRun.durationMs / 1000).toFixed(1)}s`
                          : "running..."}
                      </span>
                    </div>
                    <Link
                      href={`/reviews/${id}/runs/${sc.latestRun.id}`}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      View run &rarr;
                    </Link>
                  </div>
                  {sc.latestRun.summary && (
                    <p className="mt-1 text-sm text-gray-500">
                      {sc.latestRun.summary}
                    </p>
                  )}
                </div>
              )}

              {sc.runCount > 1 && (
                <p className="mt-2 text-xs text-gray-400">
                  {sc.runCount} total run{sc.runCount !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

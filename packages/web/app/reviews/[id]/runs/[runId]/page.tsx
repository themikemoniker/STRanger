import Link from "next/link";
import { eq } from "drizzle-orm";
import { verificationRuns, artifacts, scenarios } from "@ranger/db";
import { getDb } from "@/lib/db";
import { StatusBadge } from "@/app/components/status-badge";
import { notFound } from "next/navigation";
import { LiveRunView } from "./live";

export const dynamic = "force-dynamic";

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string; runId: string }>;
}) {
  const { id: reviewId, runId } = await params;
  const db = getDb();

  const run = db
    .select()
    .from(verificationRuns)
    .where(eq(verificationRuns.id, runId))
    .get();
  if (!run) notFound();

  const scenario = db
    .select()
    .from(scenarios)
    .where(eq(scenarios.id, run.scenarioId))
    .get();

  const runArtifacts = db
    .select()
    .from(artifacts)
    .where(eq(artifacts.runId, runId))
    .all()
    .sort((a, b) => (a.stepIndex ?? 0) - (b.stepIndex ?? 0));

  return (
    <div>
      <div className="mb-2">
        <Link
          href={`/reviews/${reviewId}`}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; Back to review
        </Link>
      </div>

      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              Run: {scenario?.title || runId}
            </h1>
            {scenario?.description && (
              <p className="mt-1 text-gray-600">{scenario.description}</p>
            )}
          </div>
          <StatusBadge status={run.verdict} />
        </div>

        <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
          {run.durationMs && (
            <span>{(run.durationMs / 1000).toFixed(1)}s</span>
          )}
          <span>
            Started: {new Date(run.startedAt).toLocaleString()}
          </span>
          {run.finishedAt && (
            <span>
              Finished: {new Date(run.finishedAt).toLocaleString()}
            </span>
          )}
        </div>

        {run.summary && (
          <p className="mt-3 rounded bg-gray-100 p-3 text-sm">
            {run.summary}
          </p>
        )}

        {run.errorMsg && (
          <p className="mt-3 rounded bg-red-50 p-3 text-sm text-red-700">
            {run.errorMsg}
          </p>
        )}
      </div>

      {run.verdict === "running" ? (
        <>
          <h2 className="text-lg font-semibold mb-3">Live Progress</h2>
          <LiveRunView runId={runId} />
        </>
      ) : (
        <>
          <h2 className="text-lg font-semibold mb-3">
            Screenshots ({runArtifacts.length})
          </h2>

          {runArtifacts.length === 0 ? (
            <p className="text-gray-500">No artifacts captured yet.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {runArtifacts.map((art) => (
                <div
                  key={art.id}
                  className="overflow-hidden rounded-lg border border-gray-200 bg-white"
                >
                  <div className="aspect-video bg-gray-100 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/artifacts/${art.id}/file`}
                      alt={art.caption || art.filename}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium">
                      Step {art.stepIndex ?? "?"}
                    </p>
                    {art.caption && (
                      <p className="mt-0.5 text-sm text-gray-500">
                        {art.caption}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-gray-400">
                      {art.filename}
                      {art.sizeBytes
                        ? ` (${(art.sizeBytes / 1024).toFixed(1)} KB)`
                        : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

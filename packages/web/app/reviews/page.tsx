import Link from "next/link";
import { isNull } from "drizzle-orm";
import { featureReviews } from "@stranger/db";
import { getDb } from "@/lib/db";
import { StatusBadge } from "@/app/components/status-badge";

export const dynamic = "force-dynamic";

export default function ReviewsPage() {
  const db = getDb();
  const reviews = db
    .select()
    .from(featureReviews)
    .where(isNull(featureReviews.deletedAt))
    .all();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reviews</h1>
        <span className="text-sm text-gray-500">
          {reviews.length} review{reviews.length !== 1 ? "s" : ""}
        </span>
      </div>

      {reviews.length === 0 ? (
        <p className="text-gray-500">
          No reviews yet. Create one via the CLI or API.
        </p>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <Link
              key={r.id}
              href={`/reviews/${r.id}`}
              className="block rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="font-semibold truncate">{r.title}</h2>
                  {r.description && (
                    <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                      {r.description}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                    {r.branch && (
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono">
                        {r.branch}
                      </span>
                    )}
                    <span>{new Date(r.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <StatusBadge status={r.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

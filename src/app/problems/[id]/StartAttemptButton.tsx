"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Client Component for the "Start Attempt" button.
 * Needs interactivity (click handler, loading state, navigation).
 */
export default function StartAttemptButton({ problemId }: { problemId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/problems/${problemId}/attempts`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to create attempt");
      const data = await res.json();
      router.push(`/attempts/${data.id}`);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
    >
      {loading ? "Starting..." : "Start New Attempt"}
    </button>
  );
}

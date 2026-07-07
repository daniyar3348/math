"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { api } from "@/lib/api";
import { schoolById, type ApiChallengeMeta } from "@/lib/types";
import { SchoolBadge, Spinner } from "@/components/ui";

export default function ChallengesPage() {
  const { t, tr } = useI18n();
  const { me } = useSession();
  const [challenges, setChallenges] = useState<ApiChallengeMeta[] | null>(null);

  useEffect(() => {
    api<{ challenges: ApiChallengeMeta[] }>("/api/challenges")
      .then((d) => setChallenges(d.challenges))
      .catch(() => setChallenges([]));
  }, [me?.enrolledCourseIds.length]);

  if (challenges === null) return <Spinner />;

  return (
    <div className="container-app py-10">
      <h1 className="text-3xl font-extrabold text-slate-900">{t("challenges")}</h1>
      <p className="mt-2 text-slate-500">{t("heroSubtitle")}</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {challenges.map((ch) => {
          const school = schoolById(ch.school ?? "bil");
          const best = me?.bestScores[ch.id];
          return (
            <div key={ch.id} className="card flex flex-col p-5">
              <div className="flex items-start justify-between">
                <SchoolBadge school={school} />
                <span className="chip bg-amber-100 text-amber-700">⚡ {ch.xp} XP</span>
              </div>
              <h3 className="mt-3 font-bold text-slate-800">{tr(ch.title)}</h3>
              <p className="mt-1 text-sm text-slate-500">{tr(ch.description)}</p>
              <div className="mt-2 text-xs text-slate-400">{tr(ch.courseTitle)}</div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <div className="flex gap-2">
                  <span className="chip bg-slate-100 text-slate-600">
                    ⏱ {Math.round(ch.timeLimitSec / 60)} {t("minutes")}
                  </span>
                  <span className="chip bg-slate-100 text-slate-600">
                    {ch.questionCount} {t("questionsCount")}
                  </span>
                  {best != null && (
                    <span className="chip bg-emerald-100 text-emerald-700">✓ {best}%</span>
                  )}
                </div>
                {!ch.locked ? (
                  <Link href={`/challenge/${ch.id}`} className="btn-brand !py-2">
                    {t("startChallenge")}
                  </Link>
                ) : (
                  <Link href={`/course/${ch.courseId}`} className="btn-outline !py-2">
                    🔒 {t("buy")}
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

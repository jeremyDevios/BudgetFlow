import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { logger } from "@/lib/logger";

interface UseCalendarHeatmapResult {
  loginDates: Set<string>;
  loading: boolean;
}

export function useCalendarHeatmap(
  userId: string | null,
  monthDate: Date
): UseCalendarHeatmapResult {
  const [loginDates, setLoginDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const monthKey = useMemo(() => {
    const year = monthDate.getFullYear();
    const month = String(monthDate.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }, [monthDate.getFullYear(), monthDate.getMonth()]);

  useEffect(() => {
    if (!userId) {
      setLoginDates(new Set());
      setLoading(false);
      return;
    }

    setLoading(true);

    const start = `${monthKey}-01`;
    const end = `${monthKey}-31`;
    const q = query(
      collection(db, "users", userId, "dailyActivity"),
      where("date", ">=", start),
      where("date", "<=", end)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const nextDates = new Set<string>();
        snapshot.forEach((activityDoc) => {
          const data = activityDoc.data();
          if (typeof data.date === "string" && data.loggedIn === true) {
            nextDates.add(data.date);
          }
        });

        setLoginDates(nextDates);
        setLoading(false);
      },
      (error) => {
        logger.warn("Failed to load calendar heatmap activity");
        setLoginDates(new Set());
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [userId, monthKey]);

  return { loginDates, loading };
}

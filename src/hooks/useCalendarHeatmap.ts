import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";

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

    let cancelled = false;

    const loadDailyActivity = async () => {
      setLoading(true);

      try {
        const snapshot = await getDocs(
          collection(db, "users", userId, "dailyActivity")
        );

        if (cancelled) return;

        const nextDates = new Set<string>();
        snapshot.forEach((activityDoc) => {
          const data = activityDoc.data();
          if (
            typeof data.date === "string" &&
            data.date.startsWith(monthKey) &&
            data.loggedIn === true
          ) {
            nextDates.add(data.date);
          }
        });

        setLoginDates(nextDates);
      } catch (error) {
        logger.warn("Failed to load calendar heatmap activity");
        if (!cancelled) {
          setLoginDates(new Set());
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadDailyActivity();

    return () => {
      cancelled = true;
    };
  }, [userId, monthKey]);

  return { loginDates, loading };
}

import { useEffect, useMemo, useState } from "react";
import { collection, documentId, onSnapshot, query, where } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { logger } from "@/lib/logger";
import {
  budgetMonthKeyForDate,
  budgetPeriod,
  CustomMonthConfig,
  DEFAULT_CUSTOM_MONTH_CONFIG,
} from "@/lib/budgetMonth";

interface UseCalendarHeatmapResult {
  loginDates: Set<string>;
  loading: boolean;
}

export function useCalendarHeatmap(
  userId: string | null,
  monthDate: Date,
  customMonthConfig: CustomMonthConfig = DEFAULT_CUSTOM_MONTH_CONFIG,
): UseCalendarHeatmapResult {
  const [loginDates, setLoginDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // Bornes de la période affichée : mois budgétaire (ex. 05/09 → 02/10) quand
  // l'option est active, mois calendaire sinon (identité stricte).
  // Dépendances volontairement primitives (chaînes/entiers) : l'effet ne doit
  // JAMAIS dépendre de l'identité d'objets recréés à chaque rendu (boucle).
  const monthDayKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}-${String(monthDate.getDate()).padStart(2, "0")}`;
  const overridesSignature = Object.entries(customMonthConfig.overrides)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, day]) => `${month}:${day}`)
    .join("|");

  const bounds = useMemo(() => {
    const key = budgetMonthKeyForDate(monthDayKey, customMonthConfig);
    const period = budgetPeriod(key, customMonthConfig);
    return { start: period.start, end: period.end.slice(0, 10) };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- config props are
    // accessed through the signature strings below.
  }, [monthDayKey, customMonthConfig.enabled, customMonthConfig.startDay, overridesSignature]);

  useEffect(() => {
    if (!userId) {
      setLoginDates(new Set());
      setLoading(false);
      return;
    }

    setLoading(true);

    const q = query(
      collection(db, "users", userId, "dailyActivity"),
      where(documentId(), ">=", bounds.start),
      where(documentId(), "<=", bounds.end)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const nextDates = new Set<string>();
        snapshot.forEach((activityDoc) => {
          const data = activityDoc.data();
          if (data.loggedIn === true) {
            nextDates.add(activityDoc.id);
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
  }, [userId, bounds]);

  return { loginDates, loading };
}

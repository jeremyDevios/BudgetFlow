"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Info } from "lucide-react";

import type { SmartSpendingNotification } from "@/lib/spendingInsights";

interface RotatingSmartInsightProps {
  notifications: SmartSpendingNotification[];
  intervalMs?: number;
  className?: string;
}

export default function RotatingSmartInsight({
  notifications,
  intervalMs = 8000,
  className = "",
}: RotatingSmartInsightProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const previousNotificationIdsRef = useRef("");

  const notificationIds = useMemo(
    () => notifications.map((notification) => notification.id).join("|"),
    [notifications]
  );

  useEffect(() => {
    if (notifications.length <= 1) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setActiveIndex((currentIndex) => (currentIndex + 1) % notifications.length);
    }, intervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [intervalMs, notifications.length, notificationIds]);

  if (notifications.length === 0) {
    return null;
  }

  const hasNotificationListChanged =
    previousNotificationIdsRef.current !== notificationIds;
  const notification =
    notifications[
      hasNotificationListChanged
        ? 0
        : Math.min(activeIndex, notifications.length - 1)
    ] ?? notifications[0];

  previousNotificationIdsRef.current = notificationIds;
  const isWarning = notification.severity === "warning";
  const Icon = isWarning ? AlertTriangle : Info;

  return (
    <div
      className={`rounded-xl border px-3 py-2 text-left transition-all duration-300 ${
        isWarning
          ? "border-red-500/20 bg-red-500/10"
          : "border-cyan-500/20 bg-cyan-500/10"
      } ${className}`}
      role="status"
      aria-live="polite"
      data-testid="rotating-smart-insight"
    >
      <div
        className={`flex items-start gap-2 ${
          isWarning ? "text-red-300" : "text-cyan-300"
        }`}
      >
        <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <div className="min-w-0 space-y-1">
          <div className="text-[11px] font-semibold leading-snug text-app-text">
            {notification.title}
          </div>
          <div className="text-[10px] leading-snug text-app-text-secondary">
            {notification.description}
          </div>
        </div>
      </div>
    </div>
  );
}

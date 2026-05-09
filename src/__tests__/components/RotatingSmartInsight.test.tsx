import React from "react";
import { act, render, screen } from "@testing-library/react";

import RotatingSmartInsight from "@/components/dashboard/RotatingSmartInsight";

describe("RotatingSmartInsight", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it("renders nothing when there is no notification", () => {
    const { container } = render(<RotatingSmartInsight notifications={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("rotates to the next notification every eight seconds and loops", () => {
    render(
      <RotatingSmartInsight
        notifications={[
          {
            id: "one",
            kind: "exceptional_spending",
            severity: "warning",
            scope: "global",
            title: "Première alerte",
            description: "Description 1",
          },
          {
            id: "two",
            kind: "frequent_overspend",
            severity: "warning",
            scope: "global",
            title: "Deuxième alerte",
            description: "Description 2",
          },
        ]}
      />
    );

    expect(screen.getByText("Première alerte")).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(8000);
    });

    expect(screen.getByText("Deuxième alerte")).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(8000);
    });

    expect(screen.getByText("Première alerte")).toBeInTheDocument();
  });

  it("resets to the first notification when the list changes", () => {
    const { rerender } = render(
      <RotatingSmartInsight
        notifications={[
          {
            id: "one",
            kind: "exceptional_spending",
            severity: "warning",
            scope: "global",
            title: "Première alerte",
            description: "Description 1",
          },
          {
            id: "two",
            kind: "frequent_underspend",
            severity: "info",
            scope: "global",
            title: "Deuxième alerte",
            description: "Description 2",
          },
        ]}
      />
    );

    act(() => {
      jest.advanceTimersByTime(8000);
    });

    expect(screen.getByText("Deuxième alerte")).toBeInTheDocument();

    rerender(
      <RotatingSmartInsight
        notifications={[
          {
            id: "three",
            kind: "rapid_spending",
            severity: "warning",
            scope: "global",
            title: "Nouvelle alerte",
            description: "Description 3",
          },
        ]}
      />
    );

    expect(screen.getByText("Nouvelle alerte")).toBeInTheDocument();
  });
});

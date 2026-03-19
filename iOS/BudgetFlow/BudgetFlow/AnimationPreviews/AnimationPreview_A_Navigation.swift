import SwiftUI

// MARK: - A1
struct AppLaunchTransitionPreview: View {
    @State private var showDashboard = false

    var body: some View {
        VStack(spacing: 24) {
            ZStack {
                if !showDashboard {
                    VStack(spacing: 14) {
                        Image(systemName: "chart.pie.fill")
                            .font(.system(size: 64, weight: .bold))
                            .foregroundStyle(Color.appAccent)

                        Text("BudgetFlow")
                            .font(.system(.largeTitle, design: .rounded, weight: .bold))
                            .foregroundStyle(Color.appText)
                    }
                    .transition(.move(edge: .top).combined(with: .opacity))
                }

                if showDashboard {
                    VStack(alignment: .leading, spacing: 14) {
                        HStack(spacing: 12) {
                            EnvelopeIconView(icon: "chart.pie.fill", colorString: "bg-amber-500", size: 44)
                            Text("Dashboard")
                                .font(.title2.weight(.bold))
                                .foregroundStyle(Color.appText)
                        }

                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color.appBackground.opacity(0.7))
                            .overlay(
                                HStack {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text("Solde global")
                                            .font(.caption)
                                            .foregroundStyle(Color.appSecondaryText)
                                        Text("4 290 €")
                                            .font(.title3.weight(.semibold))
                                            .foregroundStyle(Color.appText)
                                    }
                                    Spacer()
                                }
                                .padding(12)
                            )
                            .frame(height: 84)
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(Color.appBorder, lineWidth: 1)
                            )
                    }
                    .padding(20)
                    .frame(maxWidth: .infinity)
                    .background(Color.appSurface)
                    .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 20, style: .continuous)
                            .stroke(Color.appBorder, lineWidth: 1)
                    )
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
            .frame(maxWidth: .infinity, maxHeight: 340)

            if !showDashboard {
                PrimaryButton(title: "Simuler le lancement", icon: "play.fill") {
                    withAnimation(.smooth(duration: 0.5)) {
                        showDashboard = true
                    }
                }
            } else {
                PrimaryButton(title: "Reset", icon: "arrow.counterclockwise") {
                    withAnimation(.smooth(duration: 0.5)) {
                        showDashboard = false
                    }
                }
            }
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.appBackground)
        .animation(.smooth(duration: 0.5), value: showDashboard)
    }
}

#Preview("A1 · Lancement App") {
    AppLaunchTransitionPreview()
        .preferredColorScheme(.dark)
}

// MARK: - A2
struct OnboardingCompletionPreview: View {
    enum CelebrationPhase {
        case idle
        case tapped
        case success
    }

    @State private var phase: CelebrationPhase = .idle
    @State private var showMainTabCard = false
    @State private var showBurst = false

    private var checkScale: CGFloat {
        switch phase {
        case .idle: return 0
        case .tapped: return 0
        case .success: return 1
        }
    }

    private var buttonScale: CGFloat {
        phase == .tapped ? 0.95 : 1.0
    }

    var body: some View {
        VStack(spacing: 22) {
            Spacer(minLength: 12)

            ZStack {
                if phase == .success {
                    ForEach(0..<4, id: \.self) { index in
                        Circle()
                            .fill(Color.appGreen.opacity(0.45))
                            .frame(width: 34, height: 34)
                            .scaleEffect(showBurst ? 2.0 + CGFloat(index) * 0.2 : 0.01)
                            .opacity(showBurst ? 0 : 0.8)
                            .animation(
                                .easeOut(duration: 0.55)
                                    .delay(Double(index) * 0.08),
                                value: showBurst
                            )
                    }
                }

                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 72))
                    .foregroundStyle(Color.appGreen)
                    .scaleEffect(checkScale)
                    .opacity(phase == .success ? 1 : 0)
                    .animation(.bouncy(duration: 0.6), value: phase)
            }
            .frame(height: 110)

            PrimaryButton(title: "Terminer l'onboarding", icon: "sparkles") {
                runCelebration()
            }
            .scaleEffect(buttonScale)
            .opacity(phase == .tapped ? 0.88 : 1)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.appAccent.opacity(phase == .tapped ? 0.7 : 0), lineWidth: 2)
                    .blur(radius: phase == .tapped ? 0 : 6)
            )
            .disabled(phase != .idle)
            .animation(.easeInOut(duration: 0.15), value: phase)

            ZStack {
                if showMainTabCard {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("MainTabView placeholder")
                            .font(.headline)
                            .foregroundStyle(Color.appText)
                        Text("Budget · Historique · Evolution · Cash Flow")
                            .font(.subheadline)
                            .foregroundStyle(Color.appSecondaryText)
                    }
                    .padding(16)
                    .frame(maxWidth: .infinity, minHeight: 90, alignment: .leading)
                    .background(Color.appSurface)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .stroke(Color.appBorder, lineWidth: 1)
                    )
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
            .frame(height: 120)

            Button("Reset") {
                withAnimation(.smooth(duration: 0.35)) {
                    phase = .idle
                    showBurst = false
                    showMainTabCard = false
                }
            }
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(Color.appSecondaryText)
            .buttonStyle(.plain)

            Spacer()
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.appBackground)
        .sensoryFeedback(.success, trigger: phase == .success)
    }

    private func runCelebration() {
        guard phase == .idle else { return }

        Task {
            withAnimation(.easeInOut(duration: 0.12)) {
                phase = .tapped
            }

            try? await Task.sleep(for: .milliseconds(150))

            withAnimation(.bouncy(duration: 0.6)) {
                phase = .success
                showBurst = true
            }

            try? await Task.sleep(for: .milliseconds(280))

            withAnimation(.smooth(duration: 0.45)) {
                showMainTabCard = true
            }
        }
    }
}

#Preview("A2 · Fin Onboarding 🎉") {
    OnboardingCompletionPreview()
        .preferredColorScheme(.dark)
}

// MARK: - A3
struct MonthSelectorTransitionPreview: View {
    @State private var currentMonth = "Mars 2026"
    @State private var isMovingForward = true
    @State private var monthIndex = 2
    @State private var remainingAmount = 543

    private let months = ["Janvier 2026", "Février 2026", "Mars 2026", "Avril 2026"]
    private let remainingByMonth = [492, 701, 543, 418]

    var body: some View {
        VStack(spacing: 22) {
            HStack(spacing: 20) {
                Button {
                    guard monthIndex > 0 else { return }
                    isMovingForward = false
                    withAnimation(.snappy) {
                        monthIndex -= 1
                        currentMonth = months[monthIndex]
                        remainingAmount = remainingByMonth[monthIndex]
                    }
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.headline.weight(.semibold))
                        .foregroundStyle(Color.appText)
                        .frame(width: 40, height: 40)
                        .background(Color.appSurface)
                        .clipShape(Circle())
                }

                ZStack {
                    Text(currentMonth)
                        .id(currentMonth)
                        .font(.title3.weight(.bold))
                        .foregroundStyle(Color.appText)
                        .transition(
                            .asymmetric(
                                insertion: .move(edge: isMovingForward ? .trailing : .leading).combined(with: .opacity),
                                removal: .move(edge: isMovingForward ? .leading : .trailing).combined(with: .opacity)
                            )
                        )
                }
                .frame(maxWidth: .infinity)

                Button {
                    guard monthIndex < months.count - 1 else { return }
                    isMovingForward = true
                    withAnimation(.snappy) {
                        monthIndex += 1
                        currentMonth = months[monthIndex]
                        remainingAmount = remainingByMonth[monthIndex]
                    }
                } label: {
                    Image(systemName: "chevron.right")
                        .font(.headline.weight(.semibold))
                        .foregroundStyle(Color.appText)
                        .frame(width: 40, height: 40)
                        .background(Color.appSurface)
                        .clipShape(Circle())
                }
            }

            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color.appSurface)
                .frame(height: 150)
                .overlay(
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Solde du mois")
                            .font(.subheadline)
                            .foregroundStyle(Color.appSecondaryText)

                        Text("Restant: \(remainingAmount) €")
                            .font(.title2.weight(.bold))
                            .foregroundStyle(Color.appText)
                            .contentTransition(.numericText())
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(18)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .stroke(Color.appBorder, lineWidth: 1)
                )

            Spacer()
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.appBackground)
    }
}

#Preview("A3 · Sélecteur de Mois") {
    MonthSelectorTransitionPreview()
        .preferredColorScheme(.dark)
}

// MARK: - A4
struct TabIndicatorPreview: View {
    @State private var selectedTab = 0
    @Namespace private var tabNamespace

    private let tabs: [(title: String, icon: String)] = [
        ("Budget", "chart.pie"),
        ("Historique", "clock"),
        ("Évolution", "chart.line.uptrend.xyaxis"),
        ("Cash Flow", "arrow.left.arrow.right")
    ]

    var body: some View {
        VStack(spacing: 20) {
            Spacer(minLength: 8)

            ZStack {
                Text(tabs[selectedTab].title)
                    .id(selectedTab)
                    .font(.title2.weight(.bold))
                    .foregroundStyle(Color.appText)
                    .transition(.opacity)
            }
            .frame(maxWidth: .infinity, minHeight: 80)
            .padding(.vertical, 8)
            .background(Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(Color.appBorder, lineWidth: 1)
            )

            HStack(spacing: 8) {
                ForEach(Array(tabs.enumerated()), id: \.offset) { index, item in
                    Button {
                        selectedTab = index
                    } label: {
                        VStack(spacing: 6) {
                            Image(systemName: item.icon)
                                .font(.headline)
                            Text(item.title)
                                .font(.caption2.weight(.semibold))
                                .lineLimit(1)
                                .minimumScaleFactor(0.8)
                        }
                        .foregroundStyle(selectedTab == index ? Color.black : Color.appSecondaryText)
                        .frame(maxWidth: .infinity)
                        .frame(height: 56)
                        .background {
                            if selectedTab == index {
                                RoundedRectangle(cornerRadius: 14, style: .continuous)
                                    .fill(Color.appYellow)
                                    .matchedGeometryEffect(id: "tabIndicator", in: tabNamespace)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(8)
            .background(Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(Color.appBorder, lineWidth: 1)
            )

            Spacer()
        }
        .padding(20)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.appBackground)
        .animation(.spring(response: 0.3, dampingFraction: 0.75), value: selectedTab)
        .sensoryFeedback(.selection, trigger: selectedTab)
    }
}

#Preview("A4 · Tab Indicateur Animé") {
    TabIndicatorPreview()
        .preferredColorScheme(.dark)
}

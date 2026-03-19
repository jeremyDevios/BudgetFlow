import SwiftUI

// MARK: - D1
struct EnvelopeCardStaggerPreview: View {
    private let mockEnvelopes: [(name: String, icon: String, color: String, budget: Double, spent: Double)] = [
        ("Courses", "cart", "bg-green-500", 200, 44),
        ("Transport", "car", "bg-blue-500", 150, 112),
        ("Loisirs", "gamecontroller", "bg-purple-500", 100, 30),
        ("Maison", "house", "bg-orange-500", 300, 89),
        ("Sante", "heart", "bg-red-500", 80, 12),
        ("Sorties", "fork.knife", "bg-pink-500", 120, 67),
    ]

    @State private var appeared = false

    private let columns: [GridItem] = [
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12),
    ]

    var body: some View {
        ZStack {
            Color.appBackground.ignoresSafeArea()

            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    Text("Mes Enveloppes · D1")
                        .font(.title3.bold())
                        .foregroundStyle(Color.appText)

                    Spacer()

                    Button("Rejouer", action: replay)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color.appAccent)
                }

                LazyVGrid(columns: columns, spacing: 12) {
                    ForEach(Array(mockEnvelopes.enumerated()), id: \.offset) { index, env in
                        EnvelopeStaggerCard(envelope: env)
                            .opacity(appeared ? 1 : 0)
                            .offset(y: appeared ? 0 : 28)
                            .animation(.smooth(duration: 0.4).delay(Double(index) * 0.06), value: appeared)
                    }
                }

                Spacer(minLength: 0)
            }
            .padding(20)
        }
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                withAnimation {
                    appeared = true
                }
            }
        }
    }

    private func replay() {
        withAnimation(.easeOut(duration: 0.12)) {
            appeared = false
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
            withAnimation {
                appeared = true
            }
        }
    }
}

private struct EnvelopeStaggerCard: View {
    let envelope: (name: String, icon: String, color: String, budget: Double, spent: Double)

    private var remaining: Double {
        max(envelope.budget - envelope.spent, 0)
    }

    private var progress: Double {
        guard envelope.budget > 0 else { return 0 }
        return min(envelope.spent / envelope.budget, 1)
    }

    var body: some View {
        RoundedRectangle(cornerRadius: 16, style: .continuous)
            .fill(Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(Color.appBorder, lineWidth: 1)
            )
            .frame(height: 110)
            .overlay(alignment: .topLeading) {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 10) {
                        EnvelopeIconView(icon: envelope.icon, colorString: envelope.color, size: 32)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(envelope.name)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(Color.appText)
                                .lineLimit(1)

                            Text("Restant \(remaining, format: .currency(code: "EUR"))")
                                .font(.caption)
                                .foregroundStyle(Color.appSecondaryText)
                                .lineLimit(1)
                        }
                    }

                    Spacer(minLength: 0)

                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule()
                                .fill(Color.white.opacity(0.08))

                            Capsule()
                                .fill(Color.fromString(envelope.color))
                                .frame(width: geo.size.width * progress)
                        }
                    }
                    .frame(height: 6)
                }
                .padding(12)
            }
    }
}

#Preview("D1 · Stagger Enveloppes") {
    EnvelopeCardStaggerPreview()
        .preferredColorScheme(.dark)
}

// MARK: - D2
struct EnvelopeDetailHeroPreview: View {
    private let envelopes: [(name: String, icon: String, color: String, remaining: Double)] = [
        ("Courses", "cart", "bg-green-500", 156),
        ("Transport", "car", "bg-blue-500", 38),
        ("Loisirs", "gamecontroller", "bg-purple-500", 70),
    ]

    @State private var selectedEnvelope: String? = nil
    @State private var detailAppeared = false
    @Namespace private var heroNamespace

    private let columns: [GridItem] = [
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12),
    ]

    var body: some View {
        ZStack {
            Color.appBackground.ignoresSafeArea()

            VStack(alignment: .leading, spacing: 16) {
                Text("Envelope Detail · D2")
                    .font(.title3.bold())
                    .foregroundStyle(Color.appText)

                LazyVGrid(columns: columns, spacing: 12) {
                    ForEach(envelopes, id: \.name) { env in
                        envelopeGridCard(env)
                    }
                }

                Spacer(minLength: 0)
            }
            .padding(20)

            detailOverlay
                .zIndex(selectedEnvelope != nil ? 1 : 0)
        }
    }

    @ViewBuilder
    private var detailOverlay: some View {
        if let selected = selectedEnvelope,
           let env = envelopes.first(where: { $0.name == selected }) {
            ZStack {
                Color.appBackground
                    .ignoresSafeArea()

                VStack(alignment: .leading, spacing: 18) {
                    HStack {
                        Button("Retour") {
                            withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                                selectedEnvelope = nil
                                detailAppeared = false
                            }
                        }
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color.appAccent)

                        Spacer()
                    }

                    HStack(spacing: 14) {
                        EnvelopeIconView(icon: env.icon, colorString: env.color, size: 64)
                            .matchedGeometryEffect(id: "icon_\(env.name)", in: heroNamespace)

                        Text(env.name)
                            .font(.largeTitle.bold())
                            .foregroundStyle(Color.appText)
                            .matchedGeometryEffect(id: "name_\(env.name)", in: heroNamespace)
                    }

                    Text("Solde restant: \(env.remaining, format: .currency(code: "EUR"))")
                        .font(.headline)
                        .foregroundStyle(Color.appSecondaryText)

                    VStack(spacing: 10) {
                        ForEach(Array(mockTransactions.enumerated()), id: \.offset) { index, row in
                            HStack {
                                Text(row.title)
                                    .foregroundStyle(Color.appText)
                                Spacer()
                                Text(row.amount)
                                    .foregroundStyle(Color.appSecondaryText)
                            }
                            .padding(.horizontal, 14)
                            .padding(.vertical, 12)
                            .background(Color.appSurface, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .stroke(Color.appBorder, lineWidth: 1)
                            )
                            .opacity(detailAppeared ? 1 : 0)
                            .offset(y: detailAppeared ? 0 : 20)
                            .animation(.smooth.delay(Double(index) * 0.08), value: detailAppeared)
                        }
                    }

                    Spacer(minLength: 0)
                }
                .padding(20)
            }
            .transition(.asymmetric(insertion: .scale(scale: 0.96).combined(with: .opacity), removal: .opacity))
            .onAppear {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                    detailAppeared = true
                }
            }
        }
    }

    private var mockTransactions: [(title: String, amount: String)] {
        [
            ("Supermarche", "-24,50 €"),
            ("Boulangerie", "-8,20 €"),
            ("Prime cashback", "+5,00 €"),
        ]
    }

    private func envelopeGridCard(_ env: (name: String, icon: String, color: String, remaining: Double)) -> some View {
        Button {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.75)) {
                selectedEnvelope = env.name
            }
        } label: {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .stroke(Color.appBorder, lineWidth: 1)
                )
                .frame(height: 110)
                .overlay(alignment: .topLeading) {
                    VStack(alignment: .leading, spacing: 8) {
                        EnvelopeIconView(icon: env.icon, colorString: env.color, size: 42)
                            .matchedGeometryEffect(id: "icon_\(env.name)", in: heroNamespace)

                        Text(env.name)
                            .font(.headline)
                            .foregroundStyle(Color.appText)
                            .matchedGeometryEffect(id: "name_\(env.name)", in: heroNamespace)

                        Text("\(env.remaining, format: .currency(code: "EUR")) restants")
                            .font(.caption)
                            .foregroundStyle(Color.appSecondaryText)
                    }
                    .padding(12)
                }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Ouvrir l'enveloppe \(env.name)")
    }
}

#Preview("D2 · Hero EnvelopeDetail") {
    EnvelopeDetailHeroPreview()
        .preferredColorScheme(.dark)
}

// MARK: - D3
struct WelcomeViewEntrancePreview: View {
    @State private var animate = false
    @State private var floating = false

    var body: some View {
        ZStack {
            Color.appBackground.ignoresSafeArea()

            floatingBackground

            VStack(spacing: 18) {
                HStack {
                    Spacer()
                    Button("Rejouer") {
                        withAnimation(.easeOut(duration: 0.15)) {
                            animate = false
                        }
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                            withAnimation {
                                animate = true
                            }
                        }
                    }
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Color.appAccent)
                }

                Spacer(minLength: 12)

                Image(systemName: "chart.pie.fill")
                    .font(.system(size: 60, weight: .semibold))
                    .foregroundStyle(Color.appAccent)
                    .scaleEffect(animate ? 1 : 0.6)
                    .opacity(animate ? 1 : 0)
                    .animation(.bouncy(duration: 0.6, extraBounce: 0.25).delay(0.0), value: animate)

                Text("BudgetFlow")
                    .font(.largeTitle.bold())
                    .foregroundStyle(Color.appText)
                    .offset(y: animate ? 0 : 20)
                    .opacity(animate ? 1 : 0)
                    .animation(.smooth(duration: 0.45).delay(0.25), value: animate)

                Text("Gerez votre budget\nen toute simplicite")
                    .font(.subheadline)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Color.appSecondaryText)
                    .offset(y: animate ? 0 : 20)
                    .opacity(animate ? 1 : 0)
                    .animation(.smooth(duration: 0.45).delay(0.45), value: animate)

                VStack(spacing: 8) {
                    featurePill("✓ Enveloppes budgetaires", delay: 0.65)
                    featurePill("✓ Suivi en temps reel", delay: 0.75)
                    featurePill("✓ Graphiques", delay: 0.85)
                }

                PrimaryButton(title: "Commencer", icon: "arrow.right") {}
                    .padding(.top, 8)
                    .offset(y: animate ? 0 : 30)
                    .opacity(animate ? 1 : 0)
                    .animation(.smooth(duration: 0.45).delay(1.0), value: animate)

                Spacer(minLength: 24)
            }
            .padding(.horizontal, 24)
            .padding(.top, 18)
        }
        .onAppear {
            withAnimation {
                animate = true
            }
            floating = true
        }
    }

    private func featurePill(_ title: String, delay: Double) -> some View {
        Text(title)
            .font(.footnote.weight(.semibold))
            .foregroundStyle(Color.appText)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color.appSurface, in: Capsule())
            .overlay(
                Capsule().stroke(Color.appBorder, lineWidth: 1)
            )
            .scaleEffect(animate ? 1 : 0.8)
            .opacity(animate ? 1 : 0)
            .animation(.smooth(duration: 0.35).delay(delay), value: animate)
    }

    private var floatingBackground: some View {
        ZStack {
            floatingPill("🛒 -45€")
                .offset(x: -120, y: -230)
            floatingPill("⛽ -68€")
                .offset(x: 112, y: -160)
            floatingPill("🎮 -13€")
                .offset(x: -8, y: -305)
        }
    }

    private func floatingPill(_ text: String) -> some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(Color.appSurface.opacity(0.92), in: Capsule())
            .overlay(Capsule().stroke(Color.appBorder, lineWidth: 1))
            .foregroundStyle(Color.appSecondaryText)
            .offset(y: floating ? -8 : 8)
            .animation(
                .easeInOut(duration: 2.2)
                    .repeatForever(autoreverses: true),
                value: floating
            )
    }
}

#Preview("D3 · Welcome Entrance") {
    WelcomeViewEntrancePreview()
        .preferredColorScheme(.dark)
}

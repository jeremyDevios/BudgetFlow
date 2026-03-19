import SwiftUI

// MARK: - B1
struct FABPulsePreview: View {
    @State private var isGlowing = false
    @State private var tapCount = 0
    @State private var tapScale: CGFloat = 1.0
    @State private var showHint = false

    var body: some View {
        ZStack {
            Color.appBackground
                .ignoresSafeArea()

            RoundedRectangle(cornerRadius: 24)
                .fill(Color.appSurface)
                .frame(width: 300, height: 190)
                .overlay(alignment: .topLeading) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Restant ce mois")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Color.appSecondaryText)
                        Text("1 240,00 €")
                            .font(.system(size: 32, weight: .heavy, design: .rounded))
                            .foregroundStyle(Color.appText)
                    }
                    .padding(20)
                }
                .overlay(
                    RoundedRectangle(cornerRadius: 24)
                        .stroke(Color.appBorder, lineWidth: 1)
                )

            VStack {
                HStack {
                    Button {
                        resetAnimation()
                    } label: {
                        Label("Reset", systemImage: "arrow.clockwise")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Color.appText)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(Color.appSurface)
                            .clipShape(Capsule())
                            .overlay(
                                Capsule()
                                    .stroke(Color.appBorder, lineWidth: 1)
                            )
                    }

                    Spacer()
                }
                .padding(.horizontal, 20)
                .padding(.top, 20)

                Spacer()
            }

            VStack {
                Spacer()
                HStack {
                    Spacer()

                    VStack(alignment: .trailing, spacing: 10) {
                        if showHint {
                            Text("Ajouter une dépense")
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(Color.appText)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .background(Color.appSurface)
                                .clipShape(Capsule())
                                .overlay(
                                    Capsule()
                                        .stroke(Color.appBorder, lineWidth: 1)
                                )
                                .transition(.move(edge: .bottom).combined(with: .opacity))
                        }

                        Button {
                            handleTap()
                        } label: {
                            Image(systemName: "plus")
                                .font(.title2.weight(.bold))
                                .foregroundStyle(Color.black)
                                .frame(width: 60, height: 60)
                                .background(Color.appYellow)
                                .clipShape(Circle())
                                .shadow(color: Color.appYellow.opacity(isGlowing ? 0.7 : 0.2), radius: isGlowing ? 18 : 6)
                                .scaleEffect((isGlowing ? 1.06 : 1.0) * tapScale)
                        }
                        .sensoryFeedback(.impact, trigger: tapCount)
                    }
                    .padding(.trailing, 20)
                    .padding(.bottom, 20)
                }
            }
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 1.8).repeatForever(autoreverses: true)) {
                isGlowing = true
            }
        }
    }

    private func handleTap() {
        tapCount += 1
        withAnimation(.bouncy(duration: 0.22)) {
            tapScale = 0.88
            showHint = true
        }

        Task {
            try? await Task.sleep(for: .milliseconds(160))
            withAnimation(.bouncy(duration: 0.28)) {
                tapScale = 1.0
            }

            try? await Task.sleep(for: .milliseconds(1500))
            withAnimation(.easeInOut(duration: 0.25)) {
                showHint = false
            }
        }
    }

    private func resetAnimation() {
        tapScale = 1.0
        showHint = false
        tapCount = 0
        isGlowing = false

        withAnimation(.easeInOut(duration: 1.8).repeatForever(autoreverses: true)) {
            isGlowing = true
        }
    }
}

#Preview("B1 · FAB Pulse & Bounce") {
    FABPulsePreview()
        .preferredColorScheme(.dark)
}

// MARK: - B2
struct EnvelopeSelectionPreview: View {
    private struct MockEnvelope: Identifiable {
        let id: String
        let name: String
        let icon: String
        let color: String
    }

    private let envelopes: [MockEnvelope] = [
        .init(id: "courses", name: "Courses", icon: "cart", color: "bg-green-500"),
        .init(id: "transport", name: "Transport", icon: "car", color: "bg-blue-500"),
        .init(id: "loisirs", name: "Loisirs", icon: "gamecontroller", color: "bg-purple-500"),
        .init(id: "maison", name: "Maison", icon: "house", color: "bg-orange-500")
    ]

    @State private var selectedId: String? = nil
    @State private var bouncedId: String? = nil
    @Namespace private var selectionNamespace

    private let columns = [GridItem(.fixed(112)), GridItem(.fixed(112))]

    var body: some View {
        VStack(spacing: 24) {
            Text("Sélection de l'enveloppe")
                .font(.headline.weight(.bold))
                .foregroundStyle(Color.appText)

            LazyVGrid(columns: columns, spacing: 14) {
                ForEach(envelopes) { envelope in
                    Button {
                        select(envelope)
                    } label: {
                        VStack(spacing: 8) {
                            EnvelopeIconView(icon: envelope.icon, colorString: envelope.color, size: 34)
                            Text(envelope.name)
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(Color.appText)
                        }
                        .frame(width: 100, height: 80)
                        .background {
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .fill(Color.appSurface)

                            if selectedId == envelope.id {
                                RoundedRectangle(cornerRadius: 16, style: .continuous)
                                    .fill(Color.appYellow.opacity(0.2))
                                    .matchedGeometryEffect(id: "selectedBackground", in: selectionNamespace)
                            }
                        }
                        .overlay {
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .strokeBorder(selectedId == envelope.id ? Color.appYellow : Color.clear, lineWidth: 2)
                        }
                        .overlay {
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .stroke(Color.appBorder, lineWidth: 1)
                        }
                        .opacity(selectedId == nil || selectedId == envelope.id ? 1 : 0.5)
                        .scaleEffect(bouncedId == envelope.id ? 1.08 : 1.0)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(18)
            .background(Color.appSurface.opacity(0.55))
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .stroke(Color.appBorder, lineWidth: 1)
            )
            .sensoryFeedback(.selection, trigger: selectedId)

            Group {
                if let selected = envelopes.first(where: { $0.id == selectedId }) {
                    Text("Enveloppe choisie : \(selected.name)")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color.appYellow)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(Color.appSurface)
                        .clipShape(Capsule())
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.top, 48)
        .background(Color.appBackground.ignoresSafeArea())
        .animation(.bouncy, value: selectedId)
    }

    private func select(_ envelope: MockEnvelope) {
        selectedId = envelope.id
        bouncedId = envelope.id

        Task {
            try? await Task.sleep(for: .milliseconds(200))
            withAnimation(.bouncy) {
                bouncedId = nil
            }
        }
    }
}

#Preview("B2 · Sélection Enveloppe") {
    EnvelopeSelectionPreview()
        .preferredColorScheme(.dark)
}

// MARK: - B3
struct SaveButtonPhasePreview: View {
    enum SavePhase {
        case idle
        case loading
        case success
    }

    @State private var savePhase: SavePhase = .idle
    @State private var showToast = false
    @State private var pulseCard = false
    @State private var flashBorder = false

    var body: some View {
        ZStack(alignment: .top) {
            Color.appBackground
                .ignoresSafeArea()

            VStack(spacing: 18) {
                VStack(alignment: .leading, spacing: 14) {
                    Text("Nouvelle dépense")
                        .font(.headline)
                        .foregroundStyle(Color.appText)

                    previewField(title: "Montant", value: "45,00 €")
                    previewField(title: "Enveloppe", value: "Courses")
                    previewField(title: "Libellé", value: "Supermarché")
                }
                .padding(18)
                .background(Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 20, style: .continuous)
                        .stroke(Color.appBorder, lineWidth: 1)
                )

                VStack(alignment: .leading, spacing: 10) {
                    Text("EnvelopeCard")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Color.appSecondaryText)

                    RoundedRectangle(cornerRadius: 16)
                        .fill(Color.appSurface)
                        .frame(height: 86)
                        .overlay(alignment: .leading) {
                            HStack(spacing: 12) {
                                EnvelopeIconView(icon: "cart", colorString: "bg-green-500", size: 34)
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Courses")
                                        .foregroundStyle(Color.appText)
                                    Text("Solde mis à jour")
                                        .font(.caption)
                                        .foregroundStyle(Color.appSecondaryText)
                                }
                                Spacer()
                            }
                            .padding(.horizontal, 14)
                        }
                        .overlay(
                            RoundedRectangle(cornerRadius: 16)
                                .stroke(flashBorder ? Color.appGreen : Color.appBorder, lineWidth: flashBorder ? 2 : 1)
                        )
                        .scaleEffect(pulseCard ? 1.03 : 1.0)
                        .animation(.easeInOut(duration: 0.35), value: pulseCard)
                }

                Spacer()

                saveButton
            }
            .padding(20)

            if showToast {
                Text("✓ 45,00 € ajoutés dans Courses")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Color.black)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(Color.appGreen)
                    .clipShape(Capsule())
                    .padding(.top, 16)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
    }

    private var saveButton: some View {
        ZStack {
            PrimaryButton(title: " ", icon: nil) {
                startSaveFlow()
            }
            .allowsHitTesting(savePhase == .idle)
            .scaleEffect(savePhase == .loading ? 0.97 : 1.0)
            .opacity(savePhase == .loading ? 0.82 : 1.0)
            .overlay {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Color.appGreen)
                    .opacity(savePhase == .success ? 1 : 0)
            }

            Group {
                switch savePhase {
                case .idle:
                    Label("Enregistrer la dépense", systemImage: "square.and.arrow.down")
                        .font(.headline.weight(.bold))
                        .foregroundStyle(Color.black)
                case .loading:
                    ProgressView()
                        .tint(Color.black)
                case .success:
                    Label("Dépense ajoutée !", systemImage: "checkmark.circle.fill")
                        .font(.headline.weight(.bold))
                        .foregroundStyle(Color.black)
                }
            }
            .contentTransition(.opacity)
        }
    }

    private func previewField(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.appSecondaryText)
            Text(value)
                .font(.body.weight(.semibold))
                .foregroundStyle(Color.appText)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 12)
                .padding(.vertical, 11)
                .background(Color.appBackground)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(Color.appBorder, lineWidth: 1)
                )
        }
    }

    private func startSaveFlow() {
        guard savePhase == .idle else { return }

        Task {
            withAnimation(.easeInOut(duration: 0.2)) {
                savePhase = .loading
            }

            try? await Task.sleep(for: .seconds(1.5))

            withAnimation(.bouncy(duration: 0.45)) {
                savePhase = .success
                showToast = true
                pulseCard = true
                flashBorder = true
            }

            try? await Task.sleep(for: .milliseconds(350))
            withAnimation(.easeOut(duration: 0.2)) {
                pulseCard = false
            }

            try? await Task.sleep(for: .seconds(2.0))
            withAnimation(.easeInOut(duration: 0.25)) {
                showToast = false
                flashBorder = false
                savePhase = .idle
            }
        }
    }
}

#Preview("B3 · Bouton Enregistrer") {
    SaveButtonPhasePreview()
        .preferredColorScheme(.dark)
}

// MARK: - B4
struct EnvelopeCardPulsePreview: View {
    private let budget: Double = 200
    private let expenseAmount: Double = 45

    @State private var spent: Double = 44
    @State private var cardScale: CGFloat = 1.0
    @State private var glowRadius: CGFloat = 0
    @State private var highlightAmount = false
    @State private var pulseTrigger = 0

    private var remaining: Double {
        budget - spent
    }

    private var progress: Double {
        max(0, min(spent / budget, 1))
    }

    private var isOverBudget: Bool {
        remaining < 0
    }

    var body: some View {
        VStack(spacing: 20) {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 12) {
                    EnvelopeIconView(icon: "cart", colorString: "bg-green-500", size: 36)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Courses")
                            .font(.headline.weight(.bold))
                            .foregroundStyle(Color.appText)
                        Text("Budget: 200 €")
                            .font(.caption)
                            .foregroundStyle(Color.appSecondaryText)
                    }
                    Spacer()
                }

                Text("Restant: \(remaining, format: .currency(code: "EUR"))")
                    .font(.title3.weight(.heavy))
                    .foregroundStyle(highlightAmount ? Color.appYellow : (isOverBudget ? .red : Color.appText))
                    .contentTransition(.numericText())
                    .animation(.easeInOut(duration: 0.25), value: remaining)
                    .animation(.easeInOut(duration: 0.2), value: highlightAmount)

                VStack(alignment: .leading, spacing: 6) {
                    GeometryReader { proxy in
                        let width = proxy.size.width
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 6)
                                .fill(Color.appBackground)
                            RoundedRectangle(cornerRadius: 6)
                                .fill(isOverBudget ? Color.red : Color.appGreen)
                                .frame(width: width * progress)
                                .animation(.easeOut(duration: 0.6), value: progress)
                        }
                    }
                    .frame(height: 12)

                    Text("Progression: \(Int(progress * 100))%")
                        .font(.caption)
                        .foregroundStyle(Color.appSecondaryText)
                }
            }
            .padding(18)
            .background(Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .stroke(isOverBudget ? Color.red.opacity(0.8) : Color.appBorder, lineWidth: isOverBudget ? 2 : 1)
            )
            .shadow(color: Color.appYellow.opacity(glowRadius > 0 ? 0.45 : 0), radius: glowRadius)
            .scaleEffect(cardScale)
            .animation(.spring(response: 0.3, dampingFraction: 0.62), value: pulseTrigger)

            PrimaryButton(title: "Ajouter une dépense", icon: "plus") {
                applyExpense()
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
        .background(Color.appBackground.ignoresSafeArea())
    }

    private func applyExpense() {
        spent += expenseAmount
        pulseTrigger += 1

        withAnimation(.spring(response: 0.3, dampingFraction: 0.62)) {
            cardScale = 1.025
        }
        withAnimation(.easeInOut(duration: 0.3)) {
            glowRadius = 15
            highlightAmount = true
        }

        Task {
            try? await Task.sleep(for: .milliseconds(170))
            withAnimation(.spring(response: 0.28, dampingFraction: 0.72)) {
                cardScale = 1.0
            }

            try? await Task.sleep(for: .milliseconds(420))
            withAnimation(.easeOut(duration: 0.25)) {
                glowRadius = 0
                highlightAmount = false
            }
        }
    }
}

#Preview("B4 · Feedback Carte Enveloppe") {
    EnvelopeCardPulsePreview()
        .preferredColorScheme(.dark)
}

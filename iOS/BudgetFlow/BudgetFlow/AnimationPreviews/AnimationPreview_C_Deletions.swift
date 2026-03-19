import SwiftUI

// MARK: - Shared Mock Data

struct MockTransaction: Identifiable {
    let id = UUID()
    let note: String
    let amount: Double
    let dateLabel: String
    let envelopeName: String
    let envelopeColor: String
}

private let mockTransactions: [MockTransaction] = [
    MockTransaction(note: "Carrefour", amount: 45.50, dateLabel: "Hier", envelopeName: "Courses", envelopeColor: "bg-green-500"),
    MockTransaction(note: "Essence Total", amount: 68.00, dateLabel: "Hier", envelopeName: "Transport", envelopeColor: "bg-blue-500"),
    MockTransaction(note: "Netflix", amount: 13.99, dateLabel: "15 mars", envelopeName: "Loisirs", envelopeColor: "bg-purple-500"),
    MockTransaction(note: "Pizza Hut", amount: 22.00, dateLabel: "14 mars", envelopeName: "Restaurants", envelopeColor: "bg-orange-500"),
    MockTransaction(note: "SNCF Billet", amount: 89.00, dateLabel: "12 mars", envelopeName: "Transport", envelopeColor: "bg-blue-500")
]

struct MockEnvelope: Identifiable {
    let id = UUID()
    let name: String
    let icon: String
    let colorString: String
    let budget: Double
    let spent: Double
}

private let mockEnvelopes: [MockEnvelope] = [
    MockEnvelope(name: "Courses", icon: "cart", colorString: "bg-green-500", budget: 200, spent: 44),
    MockEnvelope(name: "Transport", icon: "car", colorString: "bg-blue-500", budget: 150, spent: 112),
    MockEnvelope(name: "Loisirs", icon: "gamecontroller", colorString: "bg-purple-500", budget: 100, spent: 30),
    MockEnvelope(name: "Maison", icon: "house", colorString: "bg-orange-500", budget: 300, spent: 89)
]

// MARK: - C1

struct TransactionDeletePreview: View {
    @State private var transactions = mockTransactions
    @State private var deletedCount = 0

    var body: some View {
        ZStack {
            Color.appBackground.ignoresSafeArea()

            VStack(spacing: 12) {
                header

                if transactions.isEmpty {
                    ContentUnavailableView("Aucune transaction", systemImage: "tray")
                        .foregroundStyle(Color.appSecondaryText)
                        .transition(.opacity)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List {
                        ForEach(transactions) { transaction in
                            transactionRow(transaction)
                                .listRowSeparator(.hidden)
                                .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
                                .listRowBackground(Color.clear)
                                .transition(
                                    .asymmetric(
                                        insertion: .move(edge: .trailing).combined(with: .opacity),
                                        removal: .move(edge: .leading).combined(with: .opacity)
                                    )
                                )
                                .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                    Button(role: .destructive) {
                                        deleteTransaction(transaction)
                                    } label: {
                                        Label("Supprimer", systemImage: "trash")
                                    }
                                }
                        }
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                    .animation(.spring(response: 0.50, dampingFraction: 0.84), value: transactions.map(\.id))
                    .transition(.opacity)
                }
            }
            .padding(.vertical, 12)
        }
        .sensoryFeedback(.warning, trigger: deletedCount)
    }

    private var header: some View {
        HStack {
            Text("Historique · C1")
                .font(.title3.weight(.semibold))
                .foregroundStyle(Color.appText)

            Spacer()

            Button("Reset") {
                withAnimation(.smooth(duration: 0.35)) {
                    transactions = mockTransactions
                }
            }
            .buttonStyle(.bordered)
            .tint(Color.appAccent)
            .disabled(transactions.count == mockTransactions.count)
        }
        .padding(.horizontal, 16)
    }

    private func transactionRow(_ transaction: MockTransaction) -> some View {
        HStack(spacing: 12) {
            Circle()
                .fill(Color.fromString(transaction.envelopeColor))
                .frame(width: 12, height: 12)

            VStack(alignment: .leading, spacing: 3) {
                Text(transaction.note)
                    .font(.headline)
                    .foregroundStyle(Color.appText)
                    .lineLimit(1)

                Text(transaction.envelopeName)
                    .font(.caption)
                    .foregroundStyle(Color.appSecondaryText)
                    .lineLimit(1)
            }

            Spacer(minLength: 8)

            VStack(alignment: .trailing, spacing: 3) {
                Text("\(transaction.amount, format: .currency(code: "EUR"))")
                    .font(.headline.monospacedDigit())
                    .foregroundStyle(Color.appText)

                Text(transaction.dateLabel)
                    .font(.caption)
                    .foregroundStyle(Color.appSecondaryText)
            }
        }
        .padding(14)
        .background(Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(Color.appBorder, lineWidth: 1)
        )
    }

    private func deleteTransaction(_ transaction: MockTransaction) {
        guard let index = transactions.firstIndex(where: { $0.id == transaction.id }) else { return }
        withAnimation(.smooth(duration: 0.35)) {
            transactions.remove(at: index)
        }
        deletedCount += 1
    }
}

#Preview("C1 · Suppression Transaction") {
    TransactionDeletePreview()
        .preferredColorScheme(.dark)
}

// MARK: - C2

struct EnvelopeDeletePreview: View {
    @State private var envelopes = mockEnvelopes
    @State private var deletingId: UUID?
    @State private var deletedEnvelopeCount = 0

    private let columns = [
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12)
    ]

    var body: some View {
        ZStack {
            Color.appBackground.ignoresSafeArea()

            VStack(spacing: 12) {
                header

                if envelopes.isEmpty {
                    ContentUnavailableView("Aucune enveloppe", systemImage: "square.grid.2x2")
                        .foregroundStyle(Color.appSecondaryText)
                        .transition(.opacity)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    ScrollView {
                        LazyVGrid(columns: columns, spacing: 12) {
                            ForEach(envelopes) { envelope in
                                envelopeCard(envelope)
                                    .scaleEffect(deletingId == envelope.id ? 0.75 : 1.0)
                                    .rotationEffect(deletingId == envelope.id ? .degrees(8) : .degrees(0))
                                    .opacity(deletingId == envelope.id ? 0 : 1)
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.bottom, 16)
                    }
                    .transition(.opacity)
                }
            }
            .padding(.vertical, 12)
        }
        .animation(.spring(response: 0.45, dampingFraction: 0.82), value: envelopes.map(\.id))
        .sensoryFeedback(.warning, trigger: deletedEnvelopeCount)
    }

    private var header: some View {
        HStack {
            Text("Enveloppes · C2")
                .font(.title3.weight(.semibold))
                .foregroundStyle(Color.appText)

            Spacer()

            Button("Reset") {
                withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) {
                    deletingId = nil
                    envelopes = mockEnvelopes
                }
            }
            .buttonStyle(.bordered)
            .tint(Color.appAccent)
            .disabled(envelopes.count == mockEnvelopes.count)
        }
        .padding(.horizontal, 16)
    }

    private func envelopeCard(_ envelope: MockEnvelope) -> some View {
        let remaining = envelope.budget - envelope.spent
        let progress = max(0, min(1, envelope.spent / max(envelope.budget, 1)))

        return VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                EnvelopeIconView(icon: envelope.icon, colorString: envelope.colorString, size: 32)

                Spacer()

                Button {
                    deleteEnvelope(envelope)
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 19, weight: .semibold))
                        .foregroundStyle(Color.appSecondaryText)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Supprimer \(envelope.name)")
            }

            Text(envelope.name)
                .font(.headline)
                .foregroundStyle(Color.appText)
                .lineLimit(1)

            Text("Reste \(remaining, format: .currency(code: "EUR"))")
                .font(.subheadline.monospacedDigit())
                .foregroundStyle(remaining >= 0 ? Color.appGreen : Color.red)

            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 4, style: .continuous)
                        .fill(Color.white.opacity(0.08))
                    RoundedRectangle(cornerRadius: 4, style: .continuous)
                        .fill(Color.fromString(envelope.colorString))
                        .frame(width: geo.size.width * progress)
                }
            }
            .frame(height: 8)
        }
        .padding(14)
        .background(Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(Color.appBorder, lineWidth: 1)
        )
        .animation(.spring(response: 0.30, dampingFraction: 0.80), value: deletingId)
        .onLongPressGesture {
            deleteEnvelope(envelope)
        }
    }

    private func deleteEnvelope(_ envelope: MockEnvelope) {
        guard deletingId == nil else { return }
        deletingId = envelope.id

        withAnimation(.spring(response: 0.30, dampingFraction: 0.80)) {
            deletingId = envelope.id
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.22) {
            withAnimation(.spring(response: 0.40, dampingFraction: 0.82)) {
                envelopes.removeAll { $0.id == envelope.id }
                deletingId = nil
            }
            deletedEnvelopeCount += 1
        }
    }
}

#Preview("C2 · Suppression Enveloppe") {
    EnvelopeDeletePreview()
        .preferredColorScheme(.dark)
}

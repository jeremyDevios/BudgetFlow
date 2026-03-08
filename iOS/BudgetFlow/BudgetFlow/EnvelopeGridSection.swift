import SwiftUI

struct EnvelopeGridSection: View {
    let envelopes: [Envelope]
    let spentPerEnvelope: [UUID: Double]
    let monthRange: (start: Date, end: Date)
    let onAddTransaction: (Envelope) -> Void

    private let columns = [GridItem(.flexible()), GridItem(.flexible())]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Mes Enveloppes")
                    .font(.headline)
                    .foregroundStyle(.white)
                Spacer()
                Text("\(envelopes.count) catégorie\(envelopes.count > 1 ? "s" : "")")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if envelopes.isEmpty {
                ContentUnavailableView(
                    "Aucune enveloppe",
                    systemImage: "tray",
                    description: Text("Créez des enveloppes dans les paramètres.")
                )
                .foregroundStyle(.secondary)
            } else {
                LazyVGrid(columns: columns, spacing: 12) {
                    ForEach(envelopes) { envelope in
                        NavigationLink(value: envelope) {
                            EnvelopeCard(
                                envelope: envelope,
                                spentThisMonth: spentPerEnvelope[envelope.id, default: 0],
                                monthRange: monthRange,
                                onAddTransaction: { onAddTransaction(envelope) }
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }
}

// MARK: - Envelope Card

private struct EnvelopeCard: View {
    let envelope: Envelope
    let spentThisMonth: Double
    let monthRange: (start: Date, end: Date)
    let onAddTransaction: () -> Void

    var remaining: Double { envelope.budget - spentThisMonth }
    var cardColor: Color { Color.fromString(envelope.color) }

    var monthlyTransactions: [Transaction] {
        envelope.transactions
            .filter { $0.date >= monthRange.start && $0.date <= monthRange.end }
            .sorted { $0.date < $1.date }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Top row: icon + name + menu
            HStack(alignment: .top, spacing: 8) {
                EnvelopeIconView(icon: envelope.icon, colorString: envelope.color, size: 32)

                Text(envelope.name)
                    .font(.subheadline.bold())
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Menu {
                    Button {
                        onAddTransaction()
                    } label: {
                        Label("Nouvelle Dépense", systemImage: "plus")
                    }
                    NavigationLink(value: envelope) {
                        Label("Détails & Historique", systemImage: "clock")
                    }
                } label: {
                    Image(systemName: "ellipsis")
                        .foregroundStyle(.secondary)
                        .frame(width: 28, height: 28)
                        .contentShape(Rectangle())
                }
                .accessibilityLabel("Options pour \(envelope.name)")
            }

            Text(remaining, format: .currency(code: "EUR"))
                .font(.title3.bold())
                .foregroundStyle(remaining < 0 ? .red : .white)
                .contentTransition(.numericText())

            Text("sur \(envelope.budget, format: .currency(code: "EUR"))")
                .font(.caption)
                .foregroundStyle(.secondary)

            TransactionSegmentBar(
                transactions: monthlyTransactions,
                color: cardColor,
                budget: envelope.budget
            )
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background {
            ZStack {
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.black)
                RoundedRectangle(cornerRadius: 16)
                    .fill(cardColor.opacity(0.12))
                RoundedRectangle(cornerRadius: 16)
                    .stroke(cardColor.opacity(0.30), lineWidth: 1)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}

// MARK: - Transaction Segment Bar

private struct TransactionSegmentBar: View {
    let transactions: [Transaction]
    let color: Color
    let budget: Double

    var body: some View {
        GeometryReader { geo in
            HStack(spacing: 1) {
                ForEach(transactions) { tx in
                    let width = budget > 0
                        ? geo.size.width * min(tx.amount / budget, 1.0)
                        : 0
                    if width > 0 {
                        Capsule()
                            .fill(color.opacity(0.8))
                            .frame(width: max(width, 3))
                    }
                }
            }
            .frame(maxWidth: geo.size.width, alignment: .leading)
            .background(Capsule().fill(.white.opacity(0.08)))
            .clipShape(RoundedRectangle(cornerRadius: 3))
        }
        .frame(height: 5)
    }
}

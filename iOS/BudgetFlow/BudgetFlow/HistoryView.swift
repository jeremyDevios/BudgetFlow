import SwiftUI
import SwiftData

struct HistoryView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(SyncService.self) private var syncService
    @Query(sort: \Transaction.date, order: .reverse) private var allTransactions: [Transaction]
    @Query private var userSettingsList: [UserSettings]

    @State private var editingTransaction: Transaction? = nil

    // Group transactions by month (descending)
    var groupedTransactions: [(String, [Transaction])] {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "fr_FR")
        formatter.dateFormat = "MMMM yyyy"

        let grouped = Dictionary(grouping: allTransactions) { tx in
            Calendar.current.startOfMonth(for: tx.date)
        }

        return grouped
            .sorted { $0.key > $1.key }
            .map { (key, transactions) in
                let label = formatter.string(from: key).capitalized
                return (label, transactions.sorted { $0.date > $1.date })
            }
    }

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(hex: "18181B"), Color(hex: "09090B")],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            if allTransactions.isEmpty {
                ContentUnavailableView(
                    "Aucune transaction",
                    systemImage: "list.bullet.rectangle",
                    description: Text("Vos dépenses apparaîtront ici.")
                )
            } else {
                List {
                    ForEach(groupedTransactions, id: \.0) { (monthLabel, transactions) in
                        Section {
                            ForEach(transactions) { tx in
                                TransactionHistoryRow(transaction: tx)
                                    .contentShape(Rectangle())
                                    .onTapGesture { editingTransaction = tx }
                                    .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                        Button(role: .destructive) {
                                            deleteSingleTransaction(tx)
                                        } label: {
                                            Label("Supprimer", systemImage: "trash")
                                        }
                                    }
                            }
                        } header: {
                            Text(monthLabel)
                                .font(.subheadline.bold())
                                .foregroundStyle(Color.appYellow)
                                .textCase(.none)
                        }
                    }
                }
                .listStyle(.insetGrouped)
                .scrollContentBackground(.hidden)
            }
        }
        .navigationTitle("Historique")
        .navigationBarTitleDisplayMode(.large)
        .toolbarBackground(.ultraThinMaterial, for: .navigationBar)
        .sheet(item: $editingTransaction) { tx in
            TransactionEditSheet(transaction: tx)
        }
    }

    private func deleteSingleTransaction(_ tx: Transaction) {
        let txId = tx.firestoreId
        let envelope = tx.envelope
        tx.envelope?.spent = max(0, (tx.envelope?.spent ?? 0) - tx.amount)
        modelContext.delete(tx)

        if let settings = userSettingsList.first,
           settings.isOnlineMode,
           !settings.firebaseUserId.isEmpty {
            let userId = settings.firebaseUserId
            Task {
                if !txId.isEmpty {
                    await syncService.deleteTransaction(firestoreId: txId, userId: userId)
                }
                if let env = envelope {
                    try? await syncService.syncEnvelope(env, userId: userId)
                }
            }
        }
    }
}

// MARK: - Transaction Row

private struct TransactionHistoryRow: View {
    let transaction: Transaction

    var envelopeColor: Color {
        Color.fromString(transaction.envelope?.color ?? "gray")
    }

    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(envelopeColor)
                .frame(width: 10, height: 10)

            VStack(alignment: .leading, spacing: 2) {
                Text(transaction.envelope?.name ?? "Enveloppe supprimée")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Text(transaction.note.isEmpty ? "Dépense" : transaction.note)
                    .font(.body)

                Text(transaction.date, format: .dateTime.day().month().year())
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                Text(transaction.amount, format: .currency(code: "EUR"))
                    .font(.body.bold())
                    .foregroundStyle(.red)
                Image(systemName: "chevron.right")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.vertical, 4)
        .listRowBackground(Color(hex: "1C1C1E"))
    }
}

#Preview {
    NavigationStack {
        HistoryView()
    }
    .modelContainer(for: [UserSettings.self, Envelope.self, Transaction.self], inMemory: true)
    .preferredColorScheme(.dark)
}

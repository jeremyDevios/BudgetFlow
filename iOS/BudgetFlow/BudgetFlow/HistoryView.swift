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
                colors: [Color.appSurface, Color.appBackground],
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
                                    .accessibilityAction(named: "Supprimer") {
                                        deleteSingleTransaction(tx)
                                    }
                            }
                        } header: {
                            Text(monthLabel)
                                .font(.subheadline.bold())
                                .foregroundStyle(Color.appAccent)
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
        HStack(spacing: 0) {
            // Timeline column: vertical line + colored dot
            ZStack {
                // Vertical line running full height through the dot center
                Rectangle()
                    .fill(envelopeColor.opacity(0.35))
                    .frame(width: 2)
                // Colored dot on top of the line
                Circle()
                    .fill(envelopeColor)
                    .frame(width: 11, height: 11)
                    .overlay(
                        Circle()
                            .stroke(Color.appSurface, lineWidth: 2)
                    )
            }
            .frame(width: 24)

            // Transaction info
            VStack(alignment: .leading, spacing: 2) {
                Text(transaction.envelope?.name ?? "Enveloppe supprimée")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(transaction.note.isEmpty ? "Dépense" : transaction.note)
                    .font(.body)
                    .foregroundStyle(Color.appText)
                Text(transaction.date, format: .dateTime.day().month().year())
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
            .padding(.leading, 12)

            Spacer()

            // Amount + chevron: vertically centered, chevron separated
            HStack(alignment: .center, spacing: 10) {
                Text(transaction.amount, format: .currency(code: "EUR"))
                    .font(.body.bold())
                    .foregroundStyle(.red)
                Image(systemName: "chevron.right")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.vertical, 2)
        .listRowBackground(Color.appSurface)
    }
}

#Preview {
    let config = ModelConfiguration(isStoredInMemoryOnly: true)
    let container = try! ModelContainer(for: UserSettings.self, Envelope.self, Transaction.self, configurations: config)
    let ctx = container.mainContext

    // Enveloppes
    let courses  = Envelope(name: "Courses",    icon: "ShoppingCart", color: "bg-purple-500", budget: 400, order: 0)
    let essence  = Envelope(name: "Essence",    icon: "Fuel",         color: "bg-orange-500", budget: 150, order: 1)
    let resto    = Envelope(name: "Restaurant", icon: "Utensils",     color: "bg-blue-500",   budget: 120, order: 2)
    let loisirs  = Envelope(name: "Loisirs",    icon: "Gamepad2",     color: "bg-green-500",  budget: 80,  order: 3)
    [courses, essence, resto, loisirs].forEach { ctx.insert($0) }

    let cal = Calendar.current
    func date(_ year: Int, _ month: Int, _ day: Int) -> Date {
        cal.date(from: DateComponents(year: year, month: month, day: day))!
    }

    // Mars 2026
    ctx.insert(Transaction(amount: 87.40,  note: "Intermarché",    date: date(2026, 3, 11), envelope: courses))
    ctx.insert(Transaction(amount: 14.52,  note: "Moto",           date: date(2026, 3, 11), envelope: essence))
    ctx.insert(Transaction(amount: 30.00,  note: "Restau mecs",    date: date(2026, 3,  9), envelope: resto))
    ctx.insert(Transaction(amount: 201.22, note: "Courses semaine",date: date(2026, 3,  5), envelope: courses))
    ctx.insert(Transaction(amount: 22.00,  note: "Ciné + pop-corn",date: date(2026, 3,  3), envelope: loisirs))

    // Février 2026
    ctx.insert(Transaction(amount: 112.60, note: "Leclerc",        date: date(2026, 2, 25), envelope: courses))
    ctx.insert(Transaction(amount: 48.90,  note: "Plein essence",  date: date(2026, 2, 18), envelope: essence))
    ctx.insert(Transaction(amount: 35.00,  note: "Sushi Shop",     date: date(2026, 2, 14), envelope: resto))
    ctx.insert(Transaction(amount: 19.99,  note: "Netflix",        date: date(2026, 2, 10), envelope: loisirs))
    ctx.insert(Transaction(amount: 67.30,  note: "Lidl",           date: date(2026, 2,  4), envelope: courses))
    ctx.insert(Transaction(amount: 28.50,  note: "Pizza Hut",      date: date(2026, 2,  1), envelope: resto))

    // Janvier 2026
    ctx.insert(Transaction(amount: 95.00,  note: "Auchan",         date: date(2026, 1, 28), envelope: courses))
    ctx.insert(Transaction(amount: 52.10,  note: "Essence A10",    date: date(2026, 1, 22), envelope: essence))
    ctx.insert(Transaction(amount: 42.00,  note: "Bowling",        date: date(2026, 1, 18), envelope: loisirs))
    ctx.insert(Transaction(amount: 18.50,  note: "McDonald's",     date: date(2026, 1, 15), envelope: resto))
    ctx.insert(Transaction(amount: 130.75, note: "Carrefour",      date: date(2026, 1,  8), envelope: courses))
    ctx.insert(Transaction(amount: 45.00,  note: "Plein moto",     date: date(2026, 1,  3), envelope: essence))

    // Décembre 2025
    ctx.insert(Transaction(amount: 210.00, note: "Courses Noël",   date: date(2025, 12, 23), envelope: courses))
    ctx.insert(Transaction(amount: 60.00,  note: "Réveillon resto",date: date(2025, 12, 31), envelope: resto))
    ctx.insert(Transaction(amount: 38.00,  note: "Escape Game",    date: date(2025, 12, 20), envelope: loisirs))
    ctx.insert(Transaction(amount: 55.80,  note: "Plein essence",  date: date(2025, 12, 12), envelope: essence))

    return NavigationStack {
        HistoryView()
    }
    .modelContainer(container)
    .environment(SyncService())
    .preferredColorScheme(.dark)
}

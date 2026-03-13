import SwiftUI
import SwiftData

struct EnvelopeDetailView: View {
    @Bindable var envelope: Envelope
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Envelope.order) private var allEnvelopes: [Envelope]

    var selectedMonth: Date = Date()

    @State private var showingEditSheet = false
    @State private var showingAddTransaction = false
    @State private var editingTransaction: Transaction? = nil

    var monthRange: (start: Date, end: Date) {
        (Calendar.current.startOfMonth(for: selectedMonth),
         Calendar.current.endOfMonth(for: selectedMonth))
    }

    var filteredTransactions: [Transaction] {
        envelope.transactions
            .filter { $0.date >= monthRange.start && $0.date <= monthRange.end }
            .sorted { $0.date > $1.date }
    }

    var monthlySpentAmount: Double {
        filteredTransactions.reduce(0) { $0 + $1.amount }
    }

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            List {
                // Header section
                Section {
                    VStack(spacing: 15) {
                        EnvelopeIconView(icon: envelope.icon, colorString: envelope.color, size: 80)
                            .shadow(radius: 5)

                        VStack(spacing: 4) {
                            Text(selectedMonth, format: .dateTime.month(.wide).year())
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .textCase(.none)

                            HStack(spacing: 2) {
                                Text(monthlySpentAmount, format: .currency(code: "EUR"))
                                    .font(.title2.bold())
                                    .foregroundColor(monthlySpentAmount > envelope.budget ? .red : .primary)
                                Text(" / ")
                                    .foregroundColor(.secondary)
                                Text(envelope.budget, format: .currency(code: "EUR"))
                                    .foregroundColor(.secondary)
                            }
                        }

                        ProgressView(value: min(monthlySpentAmount, max(envelope.budget, 0.01)), total: max(envelope.budget, 0.01))
                            .tint(Color.fromString(envelope.color))
                            .padding(.horizontal, 40)
                            .scaleEffect(x: 1, y: 2, anchor: .center)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 20)
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                }

                // Transactions section
                Section {
                    if filteredTransactions.isEmpty {
                        Text("Aucune dépense pour ce mois")
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity)
                            .multilineTextAlignment(.center)
                            .padding()
                            .listRowBackground(Color.appSurface)
                    } else {
                        ForEach(filteredTransactions) { tx in
                            TransactionDetailRow(transaction: tx)
                                .contentShape(Rectangle())
                                .onTapGesture { editingTransaction = tx }
                                .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                    Button(role: .destructive) {
                                        deleteTransaction(tx)
                                    } label: {
                                        Label("Supprimer", systemImage: "trash")
                                    }
                                }
                                .listRowBackground(Color.appSurface)
                        }
                    }
                } header: {
                    Text("Historique")
                        .font(.subheadline.bold())
                        .foregroundStyle(Color.appAccent)
                        .textCase(.none)
                }
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background(
                LinearGradient(
                    colors: [Color.appSurface, Color.appBackground],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()
            )

            // FAB
            Button {
                showingAddTransaction = true
            } label: {
                Image(systemName: "plus")
                    .font(.title2.bold())
                    .foregroundStyle(.black)
                    .frame(width: 56, height: 56)
                        .background(Color.appAccent)
                    .clipShape(Circle())
                        .shadow(color: Color.appAccent.opacity(0.4), radius: 12, y: 4)
            }
            .padding(.trailing, 20)
            .padding(.bottom, 20)
            .accessibilityLabel("Nouvelle dépense")
        }
        .navigationTitle(envelope.name)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button { showingEditSheet = true } label: {
                    Image(systemName: "pencil")
                }
            }
        }
        .sheet(isPresented: $showingEditSheet) {
            EnvelopeEditSheet(envelope: envelope)
        }
        .sheet(isPresented: $showingAddTransaction) {
            AddTransactionView(envelopes: allEnvelopes, preselectedEnvelope: envelope)
        }
        .sheet(item: $editingTransaction) { tx in
            TransactionEditSheet(transaction: tx)
        }
    }

    private func deleteTransaction(_ tx: Transaction) {
        envelope.spent = max(0, envelope.spent - tx.amount)
        modelContext.delete(tx)
    }
}

// MARK: - Transaction Row

private struct TransactionDetailRow: View {
    let transaction: Transaction

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(transaction.note.isEmpty ? "Dépense" : transaction.note)
                    .font(.body.bold())
                Text(transaction.date, format: .dateTime.day().month().year())
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Text(transaction.amount, format: .currency(code: "EUR"))
                .font(.body.bold())
                .foregroundStyle(.red)
        }
        .padding(.vertical, 4)
    }
}

#Preview {
    let config = ModelConfiguration(isStoredInMemoryOnly: true)
    let container = try! ModelContainer(for: Envelope.self, Transaction.self, configurations: config)
    let envelope = Envelope(name: "Courses", icon: "cart", color: "0000FF", budget: 500, order: 0)
    container.mainContext.insert(envelope)
    return NavigationStack {
        EnvelopeDetailView(envelope: envelope)
    }
    .modelContainer(container)
    .preferredColorScheme(.dark)
}

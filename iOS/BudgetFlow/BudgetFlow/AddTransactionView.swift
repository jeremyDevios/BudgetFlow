import SwiftUI
import SwiftData

struct AddTransactionView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Environment(SyncService.self) private var syncService
    @Query private var allTransactions: [Transaction]
    @Query private var userSettingsList: [UserSettings]

    var envelopes: [Envelope]

    @State private var amount: String = ""
    @State private var selectedEnvelope: Envelope?
    @State private var desc: String = ""
    @State private var date: Date = Date()

    let columns = [GridItem(.adaptive(minimum: 100))]

    init(envelopes: [Envelope], preselectedEnvelope: Envelope? = nil) {
        self.envelopes = envelopes
        _selectedEnvelope = State(initialValue: preselectedEnvelope)
    }

    private var currentMonthRange: (start: Date, end: Date) {
        (Calendar.current.startOfMonth(for: Date()),
         Calendar.current.endOfMonth(for: Date()))
    }

    private var envelopeSpentThisMonth: Double {
        guard let envelope = selectedEnvelope else { return 0 }
        return monthlySpent(for: envelope, in: currentMonthRange)
    }

    private var envelopeRemaining: Double {
        guard let envelope = selectedEnvelope else { return 0 }
        return envelope.budget - envelopeSpentThisMonth
    }

    private var enteredAmount: Double {
        let clean = amount.replacingOccurrences(of: ",", with: ".")
        return Double(clean) ?? 0
    }

    private var willExceedBudget: Bool {
        selectedEnvelope != nil && enteredAmount > envelopeRemaining
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {

                    // Amount field
                    VStack(spacing: 8) {
                        Text("Montant")
                            .font(.headline)
                            .foregroundStyle(.secondary)

                        TextField("0.00", text: $amount)
                            .font(.system(size: 40, weight: .bold))
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.center)
                            .padding()
                            .background(Color.appSurface)
                            .clipShape(RoundedRectangle(cornerRadius: 12))

                        // Envelope remaining hint (shown when envelope is selected)
                        if let envelope = selectedEnvelope {
                            HStack {
                                Text("Disponible \(envelope.name) :")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                Spacer()
                                Text(envelopeRemaining, format: .currency(code: "EUR"))
                                    .font(.caption.bold())
                                    .foregroundStyle(envelopeRemaining <= 0 ? .red : Color.appGreen)
                            }
                            .padding(.horizontal, 4)

                            if willExceedBudget {
                                Label("Dépasse le budget de l'enveloppe", systemImage: "exclamationmark.triangle.fill")
                                    .font(.caption)
                                    .foregroundStyle(.orange)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding(.horizontal, 4)
                            }
                        }
                    }
                    .padding(.horizontal)

                    Text("Enveloppe")
                        .font(.headline)
                        .padding(.horizontal)

                    LazyVGrid(columns: columns, spacing: 10) {
                        ForEach(envelopes) { envelope in
                            Button(action: { selectedEnvelope = envelope }) {
                                VStack {
                                    EnvelopeIconView(icon: envelope.icon, colorString: envelope.color, size: 32)
                                        .padding(.bottom, 2)
                                    Text(envelope.name)
                                        .font(.caption)
                                        .lineLimit(1)
                                }
                                .padding()
                                .frame(maxWidth: .infinity)
                                .background(
                                    selectedEnvelope?.id == envelope.id
                                        ? Color.fromString(envelope.color).opacity(0.2)
                                    : Color.appSurface
                                )
                                .foregroundStyle(.primary)
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 10)
                                        .stroke(
                                            selectedEnvelope?.id == envelope.id
                                                ? Color.fromString(envelope.color)
                                                : Color.clear,
                                            lineWidth: 2
                                        )
                                )
                            }
                        }
                    }
                    .padding(.horizontal)

                    HStack {
                        TextField("Note (Ex: Burger King)", text: $desc)
                            .padding()
                            .background(Color.appSurface)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.appBorder, lineWidth: 1))

                        DatePicker("", selection: $date, displayedComponents: .date)
                            .labelsHidden()
                    }
                    .padding(.horizontal)

                    Spacer()
                }
                .padding(.top)
            }
            .dismissKeyboardOnTap()
            .navigationTitle("Nouvelle Dépense")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Enregistrer") { saveTransaction() }
                        .disabled(amount.isEmpty || selectedEnvelope == nil)
                }
            }
        }
    }

    private func saveTransaction() {
        let cleanAmount = amount.replacingOccurrences(of: ",", with: ".")
        guard let amountVal = Double(cleanAmount),
              let envelope = selectedEnvelope else { return }

        let transaction = Transaction(amount: amountVal, note: desc, date: date, envelope: envelope)
        modelContext.insert(transaction)
        envelope.spent += amountVal

        // Sync to Firestore if online mode
        if let settings = userSettingsList.first,
           settings.isOnlineMode,
           !settings.firebaseUserId.isEmpty {
            let userId = settings.firebaseUserId
            Task {
                try? await syncService.syncTransaction(transaction, userId: userId)
                try? await syncService.syncEnvelope(envelope, userId: userId)
            }
        }

        dismiss()
    }
}

#Preview {
    let config = ModelConfiguration(isStoredInMemoryOnly: true)
    let container = try! ModelContainer(for: Envelope.self, Transaction.self, configurations: config)
    let envelope = Envelope(name: "Courses", icon: "cart", color: "orange", budget: 500, order: 0)
    container.mainContext.insert(envelope)
    return AddTransactionView(envelopes: [envelope])
        .modelContainer(container)
        .environment(SyncService())
        .preferredColorScheme(.dark)
}

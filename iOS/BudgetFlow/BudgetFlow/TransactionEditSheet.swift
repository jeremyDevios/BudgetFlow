import SwiftUI
import SwiftData

struct TransactionEditSheet: View {
    @Bindable var transaction: Transaction
    @Environment(\.dismiss) private var dismiss
    @Environment(SyncService.self) private var syncService
    @Query private var userSettingsList: [UserSettings]

    @State private var amountText: String = ""
    @State private var descriptionText: String = ""
    @State private var date: Date = Date()

    // Remaining budget for this envelope, with this transaction excluded from spent
    private var envelopeRemaining: Double {
        guard let env = transaction.envelope else { return 0 }
        return env.budget - (env.spent - transaction.amount)
    }

    private var newAmount: Double { convertToDouble(amountText) ?? 0 }

    private var willExceedBudget: Bool {
        transaction.envelope != nil && newAmount > envelopeRemaining
    }

    var isSaveDisabled: Bool {
        newAmount <= 0
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Modifier la dépense")
                    .font(.title2).bold().foregroundColor(.white)
                    .padding(.top, 8)

                // Amount
                VStack(alignment: .leading, spacing: 8) {
                    Text("Montant").font(.caption).foregroundColor(.gray)
                    HStack {
                        TextField("0", text: $amountText)
                            .keyboardType(.decimalPad)
                            .foregroundColor(.white)
                        Text("€").foregroundColor(.gray)
                    }
                    .padding()
                    .background(Color.black)
                    .cornerRadius(8)
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.white.opacity(0.1), lineWidth: 1))

                    // Envelope budget hint
                    if let envelope = transaction.envelope {
                        HStack {
                            Text("Disponible \(envelope.name) :")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            Spacer()
                            Text(envelopeRemaining, format: .currency(code: "EUR"))
                                .font(.caption.bold())
                                .foregroundStyle(envelopeRemaining <= 0 ? .red : Color.appGreen)
                        }

                        if willExceedBudget {
                            Label("Dépasse le budget de l'enveloppe", systemImage: "exclamationmark.triangle.fill")
                                .font(.caption)
                                .foregroundStyle(.orange)
                        }
                    }
                }

                // Note
                VStack(alignment: .leading, spacing: 8) {
                    Text("Note").font(.caption).foregroundColor(.gray)
                    TextField("Ex: Burger King", text: $descriptionText)
                        .padding()
                        .background(Color.black)
                        .cornerRadius(8)
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.white.opacity(0.1), lineWidth: 1))
                        .foregroundColor(.white)
                }

                // Date
                VStack(alignment: .leading, spacing: 8) {
                    Text("Date").font(.caption).foregroundColor(.gray)
                    DatePicker("", selection: $date, displayedComponents: .date)
                        .labelsHidden()
                        .colorScheme(.dark)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                // Buttons
                HStack(spacing: 15) {
                    Button(action: { dismiss() }) {
                        Text("Annuler")
                            .fontWeight(.bold)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.white.opacity(0.1))
                            .cornerRadius(12)
                    }

                    Button(action: saveChanges) {
                        Text("Sauvegarder")
                            .fontWeight(.bold)
                            .foregroundColor(isSaveDisabled ? .gray : .black)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(isSaveDisabled ? Color.gray.opacity(0.3) : Color.white)
                            .cornerRadius(12)
                    }
                    .disabled(isSaveDisabled)
                }
                .padding(.bottom, 20)
            }
            .padding(24)
        }
        .background(Color(hex: "1C1C1E").ignoresSafeArea())
        .presentationDetents([.medium])
        .dismissKeyboardOnTap()
        .onAppear {
            amountText = transaction.amount > 0 ? String(format: "%.2f", transaction.amount) : ""
            descriptionText = transaction.note
            date = transaction.date
        }
    }

    private func saveChanges() {
        guard newAmount > 0 else { return }
        let diff = newAmount - transaction.amount
        transaction.envelope?.spent += diff
        transaction.amount = newAmount
        transaction.note = descriptionText
        transaction.date = date

        // Sync to Firestore if online mode
        if let settings = userSettingsList.first,
           settings.isOnlineMode,
           !settings.firebaseUserId.isEmpty {
            let userId = settings.firebaseUserId
            let tx = transaction
            let env = transaction.envelope
            Task {
                try? await syncService.syncTransaction(tx, userId: userId)
                if let envelope = env {
                    try? await syncService.syncEnvelope(envelope, userId: userId)
                }
            }
        }

        dismiss()
    }
}

#Preview {
    let config = ModelConfiguration(isStoredInMemoryOnly: true)
    let container = try! ModelContainer(for: Envelope.self, Transaction.self, configurations: config)
    let envelope = Envelope(name: "Courses", icon: "cart", color: "0000FF", budget: 500, order: 0)
    container.mainContext.insert(envelope)
    let tx = Transaction(amount: 42.5, note: "Burger King", date: Date(), envelope: envelope)
    container.mainContext.insert(tx)
    return TransactionEditSheet(transaction: tx)
        .modelContainer(container)
        .preferredColorScheme(.dark)
}

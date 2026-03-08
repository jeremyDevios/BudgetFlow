import SwiftUI
import SwiftData

struct AddTransactionView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    var envelopes: [Envelope]
    @State private var preselectedEnvelopeId: UUID?

    @State private var amount: String = ""
    @State private var selectedEnvelope: Envelope?
    @State private var desc: String = ""
    @State private var date: Date = Date()

    let columns = [GridItem(.adaptive(minimum: 100))]

    init(envelopes: [Envelope], preselectedEnvelope: Envelope? = nil) {
        self.envelopes = envelopes
        _selectedEnvelope = State(initialValue: preselectedEnvelope)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    VStack {
                        Text("Montant")
                            .font(.headline)
                            .foregroundStyle(.secondary)

                        TextField("0.00", text: $amount)
                            .font(.system(size: 40, weight: .bold))
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.center)
                            .padding()
                            .background(Color(hex: "1C1C1E"))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
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
                                        : Color(hex: "1C1C1E")
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
                            .background(Color(hex: "1C1C1E"))
                            .clipShape(RoundedRectangle(cornerRadius: 10))

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

        dismiss()
    }
}

#Preview {
    let config = ModelConfiguration(isStoredInMemoryOnly: true)
    let container = try! ModelContainer(for: Envelope.self, Transaction.self, configurations: config)
    let envelope = Envelope(name: "Courses", icon: "cart", color: "orange", budget: 500, orderIndex: 0)
    container.mainContext.insert(envelope)

    return AddTransactionView(envelopes: [envelope])
        .modelContainer(container)
        .preferredColorScheme(.dark)
}

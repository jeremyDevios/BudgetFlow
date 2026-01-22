import SwiftUI
import SwiftData

struct AddEnvelopeView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    
    // To calculate new order index
    @Query(sort: \Envelope.orderIndex, order: .reverse) var envelopes: [Envelope]

    @State private var name: String = ""
    @State private var icon: String = "cart" // Default SF Symbol
    @State private var color: Color = .blue
    @State private var budget: Double = 0.0
    
    // Provide a list of common icons
    let commonIcons = ["cart", "car", "gamecontroller", "fork.knife", "airplane", "heart", "bus", "tshirt", "music.note", "cup.and.saucer", "briefcase", "graduationcap", "gift", "iphone", "wifi", "bolt", "drop", "hammer"]

    var body: some View {
        NavigationStack {
            Form {
                Section(header: Text("Détails")) {
                    TextField("Nom", text: $name)
                    
                    Picker("Icône", selection: $icon) {
                        ForEach(commonIcons, id: \.self) { iconName in
                            Label(iconName, systemImage: iconName)
                                .tag(iconName)
                        }
                    }
                    
                    ColorPicker("Couleur", selection: $color)
                    
                    TextField("Budget Mensuel", value: $budget, format: .currency(code: "EUR"))
                        .keyboardType(.decimalPad)
                }
            }
            .navigationTitle("Nouvelle Enveloppe")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Ajouter") {
                        let nextOrder = (envelopes.first?.orderIndex ?? -1) + 1
                        let newEnvelope = Envelope(
                            name: name,
                            icon: icon,
                            color: color.toHex() ?? "0000FF",
                            budget: budget,
                            orderIndex: nextOrder
                        )
                        modelContext.insert(newEnvelope)
                        dismiss()
                    }
                    .disabled(name.isEmpty || budget <= 0)
                }
            }
        }
    }
}

#Preview {
    AddEnvelopeView()
        .modelContainer(for: Envelope.self, inMemory: true)
}

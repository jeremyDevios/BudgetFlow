import SwiftUI
import SwiftData

struct SettingsView: View {
    @Bindable var settings: UserSettings
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationStack {
            Form {
                Section(header: Text("Budget Global")) {
                    TextField("Revenus (Salaire)", value: $settings.monthlyIncome, format: .currency(code: "EUR"))
                        .keyboardType(.decimalPad)
                    
                    TextField("Frais Fixes", value: $settings.fixedCosts, format: .currency(code: "EUR"))
                        .keyboardType(.decimalPad)
                    
                    TextField("Épargne Souhaitée", value: $settings.monthlySavings, format: .currency(code: "EUR"))
                        .keyboardType(.decimalPad)
                }
                
                Section {
                    NavigationLink("Gérer les Enveloppes", destination: ManageEnvelopesView())
                }
            }
            .navigationTitle("Configuration")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fermer") {
                        dismiss()
                    }
                }
            }
        }
    }
}

#Preview {
    let config = ModelConfiguration(isStoredInMemoryOnly: true)
    let container = try! ModelContainer(for: UserSettings.self, configurations: config)
    let settings = UserSettings(monthlyIncome: 2500, fixedCosts: 1000, monthlySavings: 200)
    
    return SettingsView(settings: settings)
        .modelContainer(container)
}

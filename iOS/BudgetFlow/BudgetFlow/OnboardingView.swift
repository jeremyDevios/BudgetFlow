import SwiftUI
import SwiftData

struct OnboardingView: View {
    @Environment(\.modelContext) private var modelContext
    @AppStorage("isOnboardingCompleted") private var isOnboardingCompleted = false
    
    @Binding var settings: UserSettings
    
    @State private var step = 1
    @State private var monthlyIncome: Double?
    @State private var fixedCosts: Double?
    @State private var monthlySavings: Double?
    
    var body: some View {
        NavigationStack {
            VStack {
                if step == 1 {
                    StepOneView(income: $monthlyIncome, fixedCosts: $fixedCosts, savings: $monthlySavings)
                } else if step == 2 {
                    StepTwoView(onComplete: finishOnboarding)
                }
            }
            .navigationTitle(step == 1 ? "Revenus & Charges" : "Enveloppes")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    if step == 1 {
                        Button("Suivant") {
                            saveSettings()
                            withAnimation { step = 2 }
                        }
                        .disabled(monthlyIncome == nil || fixedCosts == nil || monthlySavings == nil)
                    }
                }
            }
        }
    }
    
    private func saveSettings() {
        settings.monthlyIncome = monthlyIncome ?? 0
        settings.fixedCosts = fixedCosts ?? 0
        settings.monthlySavings = monthlySavings ?? 0
        // Settings are already in context if passed correctly, or update existing object
    }
    
    private func finishOnboarding() {
        isOnboardingCompleted = true
    }
}

struct StepOneView: View {
    @Binding var income: Double?
    @Binding var fixedCosts: Double?
    @Binding var savings: Double?
    
    var body: some View {
        Form {
            Section(header: Text("Revenus Mensuels")) {
                TextField("Salaire, aides, etc.", value: $income, format: .currency(code: "EUR"))
                    .keyboardType(.decimalPad)
            }
            
            Section(header: Text("Charges Fixes")) {
                TextField("Loyer, électricité, internet...", value: $fixedCosts, format: .currency(code: "EUR"))
                    .keyboardType(.decimalPad)
            }
            
            Section(header: Text("Épargne Souhaitée")) {
                TextField("Montant à mettre de côté", value: $savings, format: .currency(code: "EUR"))
                    .keyboardType(.decimalPad)
            }
        }
    }
}

struct StepTwoView: View {
    var onComplete: () -> Void
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Envelope.orderIndex) private var envelopes: [Envelope]
    
    // Default categories
    let defaults = [
        ("Courses", "cart", "Blue", 400.0),
        ("Loisirs", "gamecontroller", "Purple", 100.0),
        ("Transport", "bus", "Orange", 150.0),
        ("Restaurant", "fork.knife", "Green", 100.0)
    ]
    
    var body: some View {
        List {
            Section(header: Text("Enveloppes Suggérées")) {
                if envelopes.isEmpty {
                    Text("Aucune enveloppe. Ajoutez-en pour commencer.")
                        .foregroundColor(.secondary)
                }
                ForEach(envelopes) { envelope in
                    HStack {
                        Image(systemName: envelope.icon)
                            .foregroundColor(Color(hex: envelope.color))
                        Text(envelope.name)
                        Spacer()
                        Text(envelope.budget, format: .currency(code: "EUR"))
                    }
                }
                .onDelete(perform: deleteEnvelope)
            }
            
            Button("Ajouter les enveloppes par défaut") {
                addDefaults()
            }
            .disabled(!envelopes.isEmpty)
            
            Button("Terminer") {
                onComplete()
            }
            .buttonStyle(.borderedProminent)
            .frame(maxWidth: .infinity)
            .padding()
        }
        .onAppear {
            if envelopes.isEmpty {
                addDefaults()
            }
        }
    }
    
    func deleteEnvelope(at offsets: IndexSet) {
        for index in offsets {
            modelContext.delete(envelopes[index])
        }
    }
    
    func addDefaults() {
        for (index, item) in defaults.enumerated() {
            let env = Envelope(name: item.0, icon: item.1, color: item.2, budget: item.3, orderIndex: index)
            modelContext.insert(env)
        }
    }
}

#Preview {
    let config = ModelConfiguration(isStoredInMemoryOnly: true)
    let container = try! ModelContainer(for: UserSettings.self, Envelope.self, configurations: config)
    let settings = UserSettings()
    
    return OnboardingView(settings: .constant(settings))
        .modelContainer(container)
}

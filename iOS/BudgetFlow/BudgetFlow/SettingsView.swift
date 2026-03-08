import SwiftUI
import SwiftData

struct SettingsView: View {
    @Bindable var settings: UserSettings
    @Environment(\.dismiss) private var dismiss
    @Query(sort: \Envelope.orderIndex) private var envelopes: [Envelope]

    @State private var incomeText: String = ""
    @State private var fixedCostsText: String = ""
    @State private var savingsText: String = ""

    private var totalEnvelopes: Double {
        envelopes.reduce(0) { $0 + $1.budget }
    }

    private var equilibre: Double {
        let income = convertToDouble(incomeText) ?? settings.monthlyIncome
        let fixed = convertToDouble(fixedCostsText) ?? settings.fixedCosts
        let savings = convertToDouble(savingsText) ?? settings.monthlySavings
        return income - fixed - savings - totalEnvelopes
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.appBackground.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 20) {

                        // --- Budget Global Section ---
                        VStack(alignment: .leading, spacing: 16) {
                            HStack(spacing: 8) {
                                Image(systemName: "briefcase.fill")
                                    .foregroundColor(.appYellow)
                                Text("Budget Global")
                                    .font(.headline)
                                    .foregroundColor(.white)
                            }

                            CustomInput(
                                title: "Revenus (Salaire)",
                                icon: "wallet.pass",
                                text: $incomeText,
                                placeholder: "2500"
                            )
                            CustomInput(
                                title: "Frais Fixes",
                                icon: "building.columns",
                                text: $fixedCostsText,
                                placeholder: "1200"
                            )
                            CustomInput(
                                title: "Épargne Souhaitée",
                                icon: "briefcase",
                                text: $savingsText,
                                placeholder: "300"
                            )
                        }
                        .padding()
                        .background(Color.appSurface)
                        .clipShape(RoundedRectangle(cornerRadius: 20))
                        .overlay(RoundedRectangle(cornerRadius: 20).stroke(.white.opacity(0.08), lineWidth: 1))

                        // --- Summary Card ---
                        VStack(spacing: 0) {
                            summaryRow(
                                label: "Total Enveloppes",
                                value: totalEnvelopes,
                                color: .appYellow
                            )
                            Divider()
                                .background(.white.opacity(0.1))
                                .padding(.horizontal, 4)
                            summaryRow(
                                label: "Épargne visée",
                                value: convertToDouble(savingsText) ?? settings.monthlySavings,
                                color: .appGreen
                            )
                            Divider()
                                .background(.white.opacity(0.1))
                                .padding(.horizontal, 4)
                            summaryRow(
                                label: "Équilibre (Reste à allouer)",
                                value: equilibre,
                                color: equilibre == 0 ? .appGreen : (equilibre < 0 ? .red : .appGreen)
                            )
                        }
                        .padding(.horizontal)
                        .padding(.vertical, 8)
                        .background(Color.appSurface)
                        .clipShape(RoundedRectangle(cornerRadius: 20))
                        .overlay(RoundedRectangle(cornerRadius: 20).stroke(.white.opacity(0.08), lineWidth: 1))

                        // --- Navigation to Envelopes ---
                        NavigationLink(destination: ManageEnvelopesView()) {
                            HStack {
                                Image(systemName: "tray.2.fill")
                                    .foregroundColor(.appYellow)
                                Text("Mes Enveloppes")
                                    .foregroundColor(.white)
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .foregroundColor(.secondary)
                                    .font(.caption)
                            }
                            .padding()
                            .background(Color.appSurface)
                            .clipShape(RoundedRectangle(cornerRadius: 16))
                            .overlay(RoundedRectangle(cornerRadius: 16).stroke(.white.opacity(0.08), lineWidth: 1))
                        }
                    }
                    .padding(.horizontal)
                    .padding(.top, 16)
                    .padding(.bottom, 40)
                }
                .dismissKeyboardOnTap()
            }
            .navigationTitle("Configuration")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fermer") {
                        dismiss()
                    }
                }
            }
            .onAppear {
                loadStrings()
            }
            .onChange(of: incomeText)     { syncToSettings() }
            .onChange(of: fixedCostsText) { syncToSettings() }
            .onChange(of: savingsText)    { syncToSettings() }
        }
    }

    @ViewBuilder
    private func summaryRow(label: String, value: Double, color: Color) -> some View {
        HStack {
            Text(label)
                .foregroundColor(.secondary)
                .font(.subheadline)
            Spacer()
            Text(value, format: .currency(code: "EUR"))
                .foregroundColor(color)
                .font(.subheadline.bold())
        }
        .padding(.vertical, 10)
    }

    private func loadStrings() {
        if settings.monthlyIncome > 0 {
            incomeText = String(format: "%.0f", settings.monthlyIncome)
        }
        if settings.fixedCosts > 0 {
            fixedCostsText = String(format: "%.0f", settings.fixedCosts)
        }
        if settings.monthlySavings > 0 {
            savingsText = String(format: "%.0f", settings.monthlySavings)
        }
    }

    private func syncToSettings() {
        if let v = convertToDouble(incomeText), v > 0 {
            settings.monthlyIncome = v
        }
        if let v = convertToDouble(fixedCostsText), v > 0 {
            settings.fixedCosts = v
        }
        if let v = convertToDouble(savingsText), v > 0 {
            settings.monthlySavings = v
        }
    }
}

#Preview {
    let config = ModelConfiguration(isStoredInMemoryOnly: true)
    let container = try! ModelContainer(for: UserSettings.self, Envelope.self, configurations: config)
    let settings = UserSettings(monthlyIncome: 3000, fixedCosts: 1520, monthlySavings: 480)
    container.mainContext.insert(settings)

    return SettingsView(settings: settings)
        .modelContainer(container)
        .preferredColorScheme(.dark)
}

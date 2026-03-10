import SwiftUI
import SwiftData

struct AddEnvelopeView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Query(sort: \Envelope.order, order: .reverse) private var existingEnvelopes: [Envelope]
    @Query private var userSettingsList: [UserSettings]

    @State private var name: String = ""
    @State private var amountText: String = ""
    @State private var selectedIcon: String = "ShoppingCart"
    @State private var selectedColor: String = "bg-amber-500"

    let availableIcons = [
        "ShoppingCart", "Utensils", "Fuel", "Car", "Plane",
        "Heart", "Gamepad2", "Bus", "Shirt", "Music",
        "Coffee", "Briefcase", "GraduationCap", "Baby", "PawPrint",
        "Gift", "Smartphone", "Wifi", "Zap", "Droplets",
        "Hammer", "Home", "Train", "Bike", "DollarSign",
        "CreditCard", "ShoppingBag", "Package", "Star", "Book",
        "Pill", "Dumbbell", "Camera", "Moon", "Sun"
    ]

    let availableColors: [(Color, String)] = [
        (Color(hex: "F59E0B"), "bg-amber-500"),
        (Color(hex: "F97316"), "bg-orange-500"),
        (Color(hex: "EF4444"), "bg-red-500"),
        (Color(hex: "F43F5E"), "bg-rose-500"),
        (Color(hex: "EC4899"), "bg-pink-500"),
        (Color(hex: "A855F7"), "bg-purple-500"),
        (Color(hex: "6366F1"), "bg-indigo-500"),
        (Color(hex: "3B82F6"), "bg-blue-500"),
        (Color(hex: "06B6D4"), "bg-cyan-500"),
        (Color(hex: "14B8A6"), "bg-teal-500"),
        (Color(hex: "22C55E"), "bg-green-500"),
        (Color(hex: "84CC16"), "bg-lime-500"),
        (Color(hex: "EAB308"), "bg-yellow-500"),
        (Color(hex: "71717A"), "bg-zinc-500")
    ]

    private var settings: UserSettings? { userSettingsList.first }

    private var otherEnvelopesTotal: Double {
        existingEnvelopes.reduce(0) { $0 + $1.budget }
    }

    private var availableForNew: Double {
        guard let s = settings else { return 0 }
        return s.monthlyIncome - s.fixedCosts - s.monthlySavings - otherEnvelopesTotal
    }

    private var currentAmount: Double { convertToDouble(amountText) ?? 0 }

    private var isOverBudget: Bool {
        settings != nil && currentAmount > availableForNew
    }

    var isSaveDisabled: Bool {
        name.trimmingCharacters(in: .whitespaces).isEmpty ||
        (convertToDouble(amountText) ?? 0) <= 0
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Nouvelle enveloppe")
                    .font(.title2).bold().foregroundColor(.white)
                    .padding(.top, 8)

                // Name
                VStack(alignment: .leading, spacing: 8) {
                    Text("Nom").font(.caption).foregroundColor(.gray)
                    TextField("Ex: Courses", text: $name)
                        .padding()
                        .background(Color.black)
                        .cornerRadius(8)
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.white.opacity(0.1), lineWidth: 1))
                        .foregroundColor(.white)
                }

                // Amount
                VStack(alignment: .leading, spacing: 8) {
                    Text("Budget Mensuel").font(.caption).foregroundColor(.gray)
                    HStack {
                        TextField("0", text: $amountText)
                            .keyboardType(.decimalPad)
                            .foregroundColor(isOverBudget ? .red : .white)
                        Text("€").foregroundColor(.gray)
                    }
                    .padding()
                    .background(Color.black)
                    .cornerRadius(8)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(isOverBudget ? Color.red.opacity(0.7) : Color.white.opacity(0.1), lineWidth: 1)
                    )

                    // Budget capacity indicator
                    HStack {
                        Text("Disponible :")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Spacer()
                        Text(availableForNew, format: .currency(code: "EUR"))
                            .font(.caption.bold())
                            .foregroundStyle(isOverBudget ? .red : Color.appGreen)
                    }

                    if isOverBudget {
                        Label("Dépasse le budget disponible", systemImage: "exclamationmark.triangle.fill")
                            .font(.caption)
                            .foregroundStyle(.red)
                    }
                }

                // Icon Picker
                VStack(alignment: .leading, spacing: 8) {
                    Text("Icône").font(.caption).foregroundColor(.gray)
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 5), spacing: 10) {
                        ForEach(availableIcons, id: \.self) { icon in
                            Image(systemName: Color.lucideToSFSymbol[icon] ?? icon)
                                .foregroundColor(selectedIcon == icon ? .black : .gray)
                                .padding(10)
                                .background(selectedIcon == icon ? Color.appYellow : Color.appSurface)
                                .cornerRadius(8)
                                .onTapGesture { selectedIcon = icon }
                        }
                    }
                }

                // Color Picker
                VStack(alignment: .leading, spacing: 8) {
                    Text("Couleur").font(.caption).foregroundColor(.gray)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 12) {
                            ForEach(availableColors, id: \.1) { (displayColor, tailwindClass) in
                                Circle()
                                    .fill(displayColor)
                                    .frame(width: 32, height: 32)
                                    .overlay(
                                        Circle().strokeBorder(Color.white, lineWidth: selectedColor == tailwindClass ? 4 : 0)
                                    )
                                    .onTapGesture { selectedColor = tailwindClass }
                            }
                        }
                    }
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

                    Button(action: addEnvelope) {
                        Text("Ajouter")
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
        .presentationDetents([.medium, .large])
        .dismissKeyboardOnTap()
    }

    private func addEnvelope() {
        let nextOrder = (existingEnvelopes.first?.order ?? -1) + 1
        let envelope = Envelope(
            name: name.trimmingCharacters(in: .whitespaces),
            icon: selectedIcon,
            color: selectedColor,
            budget: convertToDouble(amountText) ?? 0,
            order: nextOrder
        )
        modelContext.insert(envelope)
        dismiss()
    }
}

#Preview {
    let config = ModelConfiguration(isStoredInMemoryOnly: true)
    let container = try! ModelContainer(for: Envelope.self, UserSettings.self, configurations: config)
    let settings = UserSettings(monthlyIncome: 3000, fixedCosts: 1520, monthlySavings: 480)
    container.mainContext.insert(settings)
    return AddEnvelopeView()
        .modelContainer(container)
        .preferredColorScheme(.dark)
}

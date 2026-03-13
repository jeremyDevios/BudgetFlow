import SwiftUI
import SwiftData

struct EnvelopeEditSheet: View {
    @Bindable var envelope: Envelope
    @Environment(\.dismiss) private var dismiss
    @Environment(SyncService.self) private var syncService

    @Query private var allEnvelopes: [Envelope]
    @Query private var userSettingsList: [UserSettings]

    @State private var editedName: String = ""
    @State private var editedAmountText: String = ""
    @State private var editedIcon: String = "ShoppingCart"
    @State private var editedColor: String = "bg-amber-500"

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
        allEnvelopes.filter { $0.id != envelope.id }.reduce(0) { $0 + $1.budget }
    }

    private var availableForThis: Double {
        guard let s = settings else { return 0 }
        return s.monthlyIncome - s.fixedCosts - s.monthlySavings - otherEnvelopesTotal
    }

    private var currentAmount: Double { convertToDouble(editedAmountText) ?? 0 }

    private var isOverBudget: Bool {
        settings != nil && currentAmount > availableForThis
    }

    var isSaveDisabled: Bool {
        editedName.trimmingCharacters(in: .whitespaces).isEmpty ||
        (convertToDouble(editedAmountText) ?? 0) <= 0
    }

    var body: some View {
        ZStack {
            Color.black.opacity(0.001).ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Text("Modifier l'enveloppe")
                        .font(.title2)
                        .bold()
                        .foregroundColor(Color.appText)
                        .padding(.top, 8)

                    // Name
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Nom").font(.caption).foregroundColor(Color.appSecondaryText)
                        TextField("Nom", text: $editedName)
                            .padding()
                            .background(Color.appSurface)
                            .cornerRadius(8)
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.appBorder, lineWidth: 1))
                            .foregroundColor(Color.appText)
                    }

                    // Amount
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Budget Mensuel").font(.caption).foregroundColor(Color.appSecondaryText)
                        HStack {
                            TextField("0", text: $editedAmountText)
                                .keyboardType(.decimalPad)
                                .foregroundColor(isOverBudget ? .red : Color.appText)
                            Text("€").foregroundColor(Color.appSecondaryText)
                        }
                        .padding()
                        .background(Color.appSurface)
                        .cornerRadius(8)
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(isOverBudget ? Color.red.opacity(0.7) : Color.appBorder, lineWidth: 1)
                        )

                        // Budget capacity indicator
                        HStack {
                            Text("Disponible :")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            Spacer()
                            Text(availableForThis, format: .currency(code: "EUR"))
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
                        Text("Icône").font(.caption).foregroundColor(Color.appSecondaryText)
                        LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 5), spacing: 10) {
                            ForEach(availableIcons, id: \.self) { icon in
                                Image(systemName: Color.lucideToSFSymbol[icon] ?? icon)
                                    .foregroundColor(editedIcon == icon ? .black : .gray)
                                    .padding(10)
                                    .background(editedIcon == icon ? Color.appYellow : Color.appSurface)
                                    .cornerRadius(8)
                                    .onTapGesture { editedIcon = icon }
                            }
                        }
                    }

                    // Color Picker
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Couleur").font(.caption).foregroundColor(Color.appSecondaryText)
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 12) {
                                ForEach(availableColors, id: \.1) { (displayColor, tailwindClass) in
                                    Circle()
                                        .fill(displayColor)
                                        .frame(width: 32, height: 32)
                                        .overlay(
                                            Circle().strokeBorder(Color.white, lineWidth: editedColor == tailwindClass ? 4 : 0)
                                        )
                                        .onTapGesture { editedColor = tailwindClass }
                                }
                            }
                        }
                    }

                    // Buttons
                    HStack(spacing: 15) {
                        Button(action: { dismiss() }) {
                            Text("Annuler")
                                .fontWeight(.bold)
                                .foregroundColor(Color.appText)
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(Color(.systemGray5))
                                .cornerRadius(12)
                        }

                        Button(action: saveChanges) {
                            Text("Sauvegarder")
                                .fontWeight(.bold)
                                .foregroundColor(isSaveDisabled ? Color.appSecondaryText : .white)
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(isSaveDisabled ? Color.appBorder : Color.appAccent)
                                .cornerRadius(12)
                        }
                        .disabled(isSaveDisabled)
                    }
                    .padding(.bottom, 20)
                }
                .padding(24)
            }
        }
        .background(Color.appBackground.ignoresSafeArea())
        .presentationDetents([.medium, .large])
        .dismissKeyboardOnTap()
        .onAppear {
            editedName = envelope.name
            editedAmountText = envelope.budget > 0 ? String(format: "%.0f", envelope.budget) : ""
            editedIcon = availableIcons.contains(envelope.icon) ? envelope.icon : (availableIcons.first ?? "ShoppingCart")
            let availableColorClasses = Set(availableColors.map { $0.1 })
            editedColor = availableColorClasses.contains(envelope.color) ? envelope.color : (availableColors.first?.1 ?? "bg-amber-500")
        }
    }

    private func saveChanges() {
        envelope.name = editedName.trimmingCharacters(in: .whitespaces)
        if let amount = convertToDouble(editedAmountText), amount > 0 {
            envelope.budget = amount
        }
        envelope.icon = editedIcon
        envelope.color = editedColor

        // Sync to Firestore if online mode
        if let s = settings, s.isOnlineMode, !s.firebaseUserId.isEmpty {
            let userId = s.firebaseUserId
            let env = envelope
            Task { try? await syncService.syncEnvelope(env, userId: userId) }
        }

        dismiss()
    }
}

#Preview {
    let config = ModelConfiguration(isStoredInMemoryOnly: true)
    let container = try! ModelContainer(for: Envelope.self, UserSettings.self, configurations: config)
    let settings = UserSettings(monthlyIncome: 3000, fixedCosts: 1520, monthlySavings: 480)
    container.mainContext.insert(settings)
    let envelope = Envelope(name: "Courses", icon: "ShoppingCart", color: "bg-blue-500", budget: 300, order: 0)
    container.mainContext.insert(envelope)
    return EnvelopeEditSheet(envelope: envelope)
        .modelContainer(container)
        .environment(SyncService())
        .preferredColorScheme(.dark)
}

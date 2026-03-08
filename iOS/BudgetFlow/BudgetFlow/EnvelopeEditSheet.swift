import SwiftUI
import SwiftData

struct EnvelopeEditSheet: View {
    @Bindable var envelope: Envelope
    @Environment(\.dismiss) private var dismiss

    @State private var editedName: String = ""
    @State private var editedAmountText: String = ""
    @State private var editedIcon: String = "cart"
    @State private var editedColorName: String = "Blue"

    let availableIcons = [
        "cart", "fuelpump", "fork.knife", "airplane", "heart",
        "gamecontroller", "bus", "tshirt", "music.note", "cup.and.saucer",
        "briefcase", "graduationcap", "gift", "pawprint", "star.fill"
    ]

    let availableColors: [(Color, String)] = [
        (.blue, "Blue"), (.orange, "Orange"), (.green, "Green"), (.red, "Red"),
        (.purple, "Purple"), (.pink, "Pink"), (.indigo, "Indigo"), (.teal, "Teal"),
        (.brown, "Brown"), (.cyan, "Cyan")
    ]

    var isSaveDisabled: Bool {
        editedName.trimmingCharacters(in: .whitespaces).isEmpty ||
        (convertToDouble(editedAmountText) ?? 0) <= 0
    }

    var body: some View {
        ZStack {
            Color.black.opacity(0.001).ignoresSafeArea() // transparent bg for sheet

            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Text("Modifier l'enveloppe")
                        .font(.title2)
                        .bold()
                        .foregroundColor(.white)
                        .padding(.top, 8)

                    // Name
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Nom").font(.caption).foregroundColor(.gray)
                        TextField("Nom", text: $editedName)
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
                            TextField("0", text: $editedAmountText)
                                .keyboardType(.decimalPad)
                                .foregroundColor(.white)
                            Text("€").foregroundColor(.gray)
                        }
                        .padding()
                        .background(Color.black)
                        .cornerRadius(8)
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.white.opacity(0.1), lineWidth: 1))
                    }

                    // Icon Picker
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Icône").font(.caption).foregroundColor(.gray)
                        LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 5), spacing: 10) {
                            ForEach(availableIcons, id: \.self) { icon in
                                Image(systemName: icon)
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
                        Text("Couleur").font(.caption).foregroundColor(.gray)
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 12) {
                                ForEach(availableColors, id: \.1) { (color, name) in
                                    Circle()
                                        .fill(color)
                                        .frame(width: 32, height: 32)
                                        .overlay(
                                            Circle().strokeBorder(Color.white, lineWidth: editedColorName == name ? 4 : 0)
                                        )
                                        .onTapGesture { editedColorName = name }
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
        }
        .background(Color(hex: "1C1C1E").ignoresSafeArea())
        .presentationDetents([.medium, .large])
        .onAppear {
            editedName = envelope.name
            editedAmountText = envelope.budget > 0 ? String(format: "%.0f", envelope.budget) : ""
            editedIcon = envelope.icon

            // Reverse-map hex to color name
            let hexUpper = envelope.color.uppercased()
            let matched = availableColors.first { (color, _) in
                (color.toHex() ?? "").uppercased() == hexUpper
            }
            editedColorName = matched?.1 ?? "Blue"
        }
    }

    private func saveChanges() {
        envelope.name = editedName.trimmingCharacters(in: .whitespaces)
        if let amount = convertToDouble(editedAmountText), amount > 0 {
            envelope.budget = amount
        }
        envelope.icon = editedIcon
        envelope.color = Color.fromString(editedColorName).toHex() ?? envelope.color
        dismiss()
    }
}

#Preview {
    let config = ModelConfiguration(isStoredInMemoryOnly: true)
    let container = try! ModelContainer(for: Envelope.self, configurations: config)
    let envelope = Envelope(name: "Courses", icon: "cart", color: "0000FF", budget: 300, orderIndex: 0)
    container.mainContext.insert(envelope)
    return EnvelopeEditSheet(envelope: envelope)
        .modelContainer(container)
        .preferredColorScheme(.dark)
}
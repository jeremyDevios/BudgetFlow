import SwiftUI
import SwiftData

struct AddTransactionView: View {
    private enum SavePhase: Equatable {
        case idle, loading, success
    }

    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Environment(SyncService.self) private var syncService
    @Query private var allTransactions: [Transaction]
    @Query private var userSettingsList: [UserSettings]

    var envelopes: [Envelope]
    var onTransactionSaved: ((Envelope, Double) -> Void)? = nil

    @State private var amount: String = ""
    @State private var selectedEnvelope: Envelope?
    @State private var desc: String = ""
    @State private var date: Date = Date()
    @State private var savePhase: SavePhase = .idle
    @State private var saveButtonScale: CGFloat = 1.0
    @State private var successRingScale: CGFloat = 0.3
    @State private var successRingOpacity: Double = 0
    @FocusState private var amountFocused: Bool

    let columns = [GridItem(.adaptive(minimum: 100))]

    init(envelopes: [Envelope], preselectedEnvelope: Envelope? = nil, onTransactionSaved: ((Envelope, Double) -> Void)? = nil) {
        self.envelopes = envelopes
        _selectedEnvelope = State(initialValue: preselectedEnvelope)
        self.onTransactionSaved = onTransactionSaved
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

    private var buttonBackgroundColor: Color {
        switch savePhase {
        case .idle:
            return (amount.isEmpty || selectedEnvelope == nil) ? Color.appSurface : Color(hex: "#F59E0B")
        case .loading:
            return Color(hex: "#E08800")
        case .success:
            return Color.appGreen
        }
    }

    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .font(.system(size: 12, weight: .semibold))
            .textCase(.uppercase)
            .tracking(1.2)
            .foregroundStyle(Color.appSecondaryText)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    VStack(alignment: .leading, spacing: 12) {
                        sectionHeader("MONTANT")

                        HStack(spacing: 12) {
                            Text("€")
                                .font(.system(size: 32, weight: .semibold))
                                .foregroundStyle(Color.appYellow)
                                .accessibilityHidden(true)

                            TextField("0.00", text: $amount)
                                .font(.system(size: 48, weight: .heavy, design: .rounded))
                                .keyboardType(.decimalPad)
                                .multilineTextAlignment(.center)
                                .focused($amountFocused)
                                .tint(Color.appYellow)
                                .onChange(of: amountFocused) { _, focused in
                                    if !focused {
                                        let clean = amount.replacingOccurrences(of: ",", with: ".")
                                        if let val = Double(clean), val > 0 {
                                            amount = String(format: "%.2f", val)
                                        }
                                    }
                                }
                        }
                        .padding(.horizontal, 20)
                        .padding(.vertical, 18)
                        .background(Color.appSurface)
                        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 20, style: .continuous)
                                .stroke(amountFocused ? Color.appYellow : Color.appBorder, lineWidth: amountFocused ? 2 : 1)
                        )
                        .animation(.easeInOut(duration: 0.2), value: amountFocused)

                        if let envelope = selectedEnvelope {
                            HStack {
                                Text("Disponible \(envelope.name) :")
                                    .font(.caption)
                                    .foregroundStyle(Color.appSecondaryText)
                                Spacer()
                                Text(envelopeRemaining, format: .currency(code: "EUR"))
                                    .font(.caption.bold())
                                    .foregroundStyle(envelopeRemaining <= 0 ? .red : Color.appGreen)
                            }
                            .padding(.horizontal, 4)
                        }
                    }
                    .padding(.horizontal)

                    if willExceedBudget {
                        HStack(spacing: 10) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundStyle(Color.appYellow)

                            Text("Dépasse le budget de l'enveloppe")
                                .font(.system(size: 14, weight: .medium))
                                .foregroundStyle(Color.appYellow)

                            Spacer(minLength: 0)
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 12)
                        .background(Color(hex: "#F4941A").opacity(0.15))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .stroke(Color(hex: "#F4941A").opacity(0.35), lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .padding(.horizontal)
                        .transition(.move(edge: .top).combined(with: .opacity))
                    }

                    VStack(alignment: .leading, spacing: 12) {
                        sectionHeader("ENVELOPPE")

                        LazyVGrid(columns: columns, spacing: 10) {
                            ForEach(envelopes) { envelope in
                                Button(action: {
                                    withAnimation(.bouncy(duration: 0.3)) {
                                        selectedEnvelope = envelope
                                    }
                                }) {
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
                                    .foregroundStyle(Color.appText)
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
                                    .scaleEffect(selectedEnvelope?.id == envelope.id ? 1.06 : 1.0)
                                    .animation(.bouncy(duration: 0.3), value: selectedEnvelope?.id)
                                }
                            }
                        }
                        .sensoryFeedback(.selection, trigger: selectedEnvelope?.id)
                    }
                    .padding(.horizontal)

                    VStack(alignment: .leading, spacing: 12) {
                        sectionHeader("DÉTAILS")

                        VStack(spacing: 0) {
                            HStack(spacing: 12) {
                                Image(systemName: "tag")
                                    .foregroundStyle(Color.appSecondaryText)

                                TextField("Nom de la dépense", text: $desc)
                                    .foregroundStyle(Color.appText)
                            }
                            .padding(.horizontal, 16)
                            .padding(.vertical, 14)

                            Divider()
                                .overlay(Color.appBorder)

                            HStack(spacing: 12) {
                                Image(systemName: "calendar")
                                    .foregroundStyle(Color.appSecondaryText)

                                Text("Date")
                                    .font(.system(size: 17))
                                    .foregroundStyle(Color.appSecondaryText)

                                Spacer()

                                DatePicker("", selection: $date, displayedComponents: .date)
                                    .labelsHidden()
                            }
                            .padding(.horizontal, 16)
                            .padding(.vertical, 14)
                        }
                        .background(Color.appSurface)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .stroke(Color.appBorder, lineWidth: 1)
                        )
                    }
                    .padding(.horizontal)

                    ZStack {
                        Capsule()
                            .fill(Color.appGreen.opacity(successRingOpacity))
                            .frame(maxWidth: .infinity)
                            .frame(height: 56)
                            .scaleEffect(x: successRingScale, y: 1.0)
                            .padding(.horizontal, 20)

                        Button(action: handleSaveTap) {
                            ZStack {
                                if savePhase == .idle {
                                    Text("Valider la dépense")
                                        .font(.system(size: 17, weight: .semibold))
                                        .foregroundStyle(
                                            amount.isEmpty || selectedEnvelope == nil
                                                ? Color.appSecondaryText.opacity(0.5)
                                                : Color.white
                                        )
                                        .transition(.opacity.combined(with: .scale(scale: 0.85)))
                                }

                                if savePhase == .loading {
                                    HStack(spacing: 10) {
                                        ProgressView()
                                            .tint(.white)
                                            .scaleEffect(0.9)
                                        Text("Enregistrement...")
                                            .font(.system(size: 15, weight: .medium))
                                            .foregroundStyle(.white)
                                    }
                                    .transition(.opacity.combined(with: .scale(scale: 0.85)))
                                }

                                if savePhase == .success {
                                    HStack(spacing: 8) {
                                        Image(systemName: "checkmark.circle.fill")
                                            .font(.system(size: 20, weight: .semibold))
                                        Text("Dépense ajoutée !")
                                            .font(.system(size: 17, weight: .semibold))
                                    }
                                    .foregroundStyle(.white)
                                    .transition(.opacity.combined(with: .scale(scale: 0.85)))
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .frame(height: 56)
                            .background {
                                Capsule()
                                    .fill(buttonBackgroundColor)
                            }
                            .clipShape(Capsule())
                            .scaleEffect(saveButtonScale)
                            .animation(.spring(response: 0.35, dampingFraction: 0.7), value: savePhase)
                        }
                        .disabled(amount.isEmpty || selectedEnvelope == nil || savePhase != .idle)
                        .padding(.horizontal, 20)
                    }
                    .padding(.bottom, 16)
                    .sensoryFeedback(.impact, trigger: savePhase == .loading)
                    .sensoryFeedback(.success, trigger: savePhase == .success)

                    Spacer()
                }
                .padding(.top)
                .onAppear {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                        amountFocused = true
                    }
                }
                .animation(.easeInOut(duration: 0.2), value: willExceedBudget)
            }
            .dismissKeyboardOnTap()
            .navigationTitle("Nouvelle Dépense")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") { dismiss() }
                }
            }
        }
    }

    private func handleSaveTap() {
        guard savePhase == .idle else { return }

        withAnimation(.spring(response: 0.12, dampingFraction: 0.6)) {
            saveButtonScale = 0.94
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) {
            withAnimation(.spring(response: 0.3, dampingFraction: 0.65)) {
                saveButtonScale = 1.0
                savePhase = .loading
            }
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 1.1) {
            saveTransactionData()
            withAnimation(.spring(response: 0.4, dampingFraction: 0.65)) {
                savePhase = .success
            }
            withAnimation(.easeOut(duration: 0.5).delay(0.05)) {
                successRingScale = 1.05
                successRingOpacity = 0.25
            }
            withAnimation(.easeOut(duration: 0.4).delay(0.35)) {
                successRingOpacity = 0
            }
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 2.3) {
            dismiss()
        }
    }

    private func saveTransactionData() {
        let cleanAmount = amount.replacingOccurrences(of: ",", with: ".")
        guard let amountVal = Double(cleanAmount),
              let envelope = selectedEnvelope else { return }

        let transaction = Transaction(amount: amountVal, note: desc, date: date, envelope: envelope)
        modelContext.insert(transaction)
        envelope.spent += amountVal
        onTransactionSaved?(envelope, amountVal)

        if let settings = userSettingsList.first,
           settings.isOnlineMode,
           !settings.firebaseUserId.isEmpty {
            let userId = settings.firebaseUserId
            Task {
                try? await syncService.syncTransaction(transaction, userId: userId)
                try? await syncService.syncEnvelope(envelope, userId: userId)
            }
        }
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

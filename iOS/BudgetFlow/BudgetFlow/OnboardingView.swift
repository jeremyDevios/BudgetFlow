import SwiftUI
import SwiftData
import FirebaseAuth

private struct PageFlipModifier: ViewModifier {
    let angle: Double
    let anchor: UnitPoint

    func body(content: Content) -> some View {
        content
            .rotation3DEffect(.degrees(angle), axis: (0, 1, 0), anchor: anchor, perspective: 0.5)
            .opacity(abs(angle) > 70 ? 0 : 1)
    }
}

extension AnyTransition {
    static func pageFlip(forward: Bool) -> AnyTransition {
        .asymmetric(
            insertion: .modifier(
                active: PageFlipModifier(angle: forward ? 90 : -90,
                                         anchor: forward ? .trailing : .leading),
                identity: PageFlipModifier(angle: 0, anchor: .center)
            ),
            removal: .modifier(
                active: PageFlipModifier(angle: forward ? -90 : 90,
                                         anchor: forward ? .leading : .trailing),
                identity: PageFlipModifier(angle: 0, anchor: .center)
            )
        )
    }
}


struct OnboardingView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(SyncService.self) private var syncService
    @Environment(FirebaseManager.self) private var firebaseManager
    @AppStorage("isOnboarded") private var isOnboarded = false
    @Binding var settings: UserSettings
    
    @State private var step: Int = 0 
    @State private var previousStep: Int = 0
    // 0: Welcome, 1: Storage mode, 2: Basics, 3: Envelopes
    
    // Data State
    @State private var monthlyIncome: Double?
    @State private var fixedCosts: Double?
    @State private var monthlySavings: Double?
    
    // Custom Envelopes State
    @State private var tempEnvelopes: [TempEnvelope] = []
    @State private var isOnlineMode: Bool = false
    @State private var showAuthSheet: Bool = false
    @State private var firebaseUser: FirebaseAuth.User? = nil
    @State private var isFinishing: Bool = false
    @State private var showCompletionBurst = false
    
    // Transitions
    @Namespace private var animation
    
    var isMovingForward: Bool {
        step > previousStep
    }
    
    var body: some View {
        ZStack {
            Color.appBackground.ignoresSafeArea()
                .onTapGesture {
                    hideKeyboard()
                }
            
            VStack {
                if step == 0 {
                    WelcomeView(onStart: {
                        withAnimation {
                            previousStep = step
                            step = 1
                        }
                    })
                    .id(0)
                    .transition(.pageFlip(forward: isMovingForward))
                } else if step == 1 {
                    StorageModeView(
                        onBack: {
                            withAnimation {
                                previousStep = step
                                step = 0
                            }
                        },
                        onOffline: {
                            isOnlineMode = false
                            if tempEnvelopes.isEmpty { initDefaultEnvelopes() }
                            withAnimation {
                                previousStep = step
                                step = 2
                            }
                        },
                        onOnline: {
                            isOnlineMode = true
                            showAuthSheet = true
                        }
                    )
                    .id(1)
                    .transition(.pageFlip(forward: isMovingForward))
                } else if step == 2 {
                    StepBasicsView(
                        income: $monthlyIncome,
                        fixedCosts: $fixedCosts,
                        savings: $monthlySavings,
                        onBack: {
                            withAnimation {
                                previousStep = step
                                step = 1
                            }
                        },
                        onContinue: {
                            if tempEnvelopes.isEmpty { initDefaultEnvelopes() }
                            withAnimation {
                                previousStep = step
                                step = 3
                            }
                        }
                    )
                    .id(2)
                    .transition(.pageFlip(forward: isMovingForward))
                } else if step == 3 {
                    StepEnvelopesView(
                        income: monthlyIncome ?? 0,
                        fixedCosts: fixedCosts ?? 0,
                        savings: monthlySavings ?? 0,
                        envelopes: $tempEnvelopes,
                        onBack: {
                            withAnimation {
                                previousStep = step
                                step = 2
                            }
                        },
                        onFinish: {
                            Task { await finishOnboarding() }
                        }
                    )
                        .id(3)
                        .transition(.pageFlip(forward: isMovingForward))
                }
            }

            // Completion celebration overlay
            if showCompletionBurst {
                ZStack {
                    Color.appBackground.opacity(0.85)
                        .ignoresSafeArea()
                        .transition(.opacity)

                    VStack(spacing: 24) {
                        ZStack {
                            // Burst rings (3 expanding circles)
                            ForEach(0..<3) { i in
                                Circle()
                                    .stroke(Color.appGreen.opacity(showCompletionBurst ? 0 : 0.6), lineWidth: 2)
                                    .scaleEffect(showCompletionBurst ? CGFloat(2.0 + Double(i) * 0.5) : 0.5)
                                    .animation(
                                        .easeOut(duration: 0.8).delay(Double(i) * 0.12),
                                        value: showCompletionBurst
                                    )
                            }

                            // Checkmark circle
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 80))
                                .foregroundStyle(Color.appGreen)
                                .scaleEffect(showCompletionBurst ? 1.0 : 0.3)
                                .opacity(showCompletionBurst ? 1.0 : 0)
                                .animation(.bouncy(duration: 0.5).delay(0.1), value: showCompletionBurst)
                        }
                        .frame(width: 120, height: 120)

                        VStack(spacing: 8) {
                            Text("Budget configuré !")
                                .font(.title2.bold())
                                .foregroundStyle(Color.appText)
                                .opacity(showCompletionBurst ? 1 : 0)
                                .offset(y: showCompletionBurst ? 0 : 20)
                                .animation(.smooth(duration: 0.4).delay(0.3), value: showCompletionBurst)

                            Text("Votre espace est prêt")
                                .font(.subheadline)
                                .foregroundStyle(Color.appSecondaryText)
                                .opacity(showCompletionBurst ? 1 : 0)
                                .offset(y: showCompletionBurst ? 0 : 15)
                                .animation(.smooth(duration: 0.4).delay(0.45), value: showCompletionBurst)
                        }
                    }
                }
                .transition(.opacity)
                .zIndex(10)
            }
        }
        .sheet(isPresented: $showAuthSheet) {
            AuthView(
                onSuccess: { user in
                    firebaseUser = user
                    showAuthSheet = false
                    Task {
                        let hasData = await syncService.checkDataExists(for: user.uid)
                        if hasData {
                            try? await syncService.loadFromFirestore(userId: user.uid, into: modelContext)
                            settings.isOnlineMode = true
                            settings.firebaseUserId = user.uid
                            settings.isOnboarded = true
                            isOnboarded = true
                        } else {
                            if tempEnvelopes.isEmpty { initDefaultEnvelopes() }
                            withAnimation {
                                previousStep = 1
                                step = 2
                            }
                        }
                    }
                },
                onDismiss: { showAuthSheet = false }
            )
            .environment(firebaseManager)
            .environment(syncService)
        }
        .animation(.easeInOut(duration: 0.45), value: step)
    }
    
    private func initDefaultEnvelopes() {
        tempEnvelopes = [
            TempEnvelope(name: "Courses", icon: "cart", color: "Blue", amount: 300),
            TempEnvelope(name: "Essence", icon: "fuelpump", color: "Orange", amount: 150),
            TempEnvelope(name: "Loisirs", icon: "gamecontroller", color: "Green", amount: 100)
        ]
    }

    private func finishOnboarding() async {
        isFinishing = true

        // Save settings
        settings.monthlyIncome = monthlyIncome ?? 0
        settings.fixedCosts = fixedCosts ?? 0
        settings.monthlySavings = monthlySavings ?? 0
        settings.isOnlineMode = isOnlineMode

        // Save envelopes to SwiftData
        try? modelContext.delete(model: Envelope.self)

        var createdEnvelopes: [Envelope] = []
        for (index, env) in tempEnvelopes.enumerated() {
            let colorHex = Color.fromString(env.color).toHex() ?? "0000FF"
            let newEnv = Envelope(
                name: env.name,
                icon: env.icon,
                color: colorHex,
                budget: env.amount,
                order: index
            )
            modelContext.insert(newEnv)
            createdEnvelopes.append(newEnv)
        }

        // If online mode, save to Firestore
        if isOnlineMode, let user = firebaseUser {
            settings.firebaseUserId = user.uid
            try? await syncService.saveToFirestore(settings: settings, envelopes: createdEnvelopes, userId: user.uid)
        }

        isFinishing = false
        // Show celebration, then transition to app
        withAnimation(.easeIn(duration: 0.2)) {
            showCompletionBurst = true
        }
        try? await Task.sleep(nanoseconds: 1_500_000_000) // 1.5s
        isOnboarded = true
    }
}

// Helper struct for temporary envelope editing
struct TempEnvelope: Identifiable, Equatable {
    let id = UUID()
    var name: String
    var icon: String
    var color: String
    var amount: Double
}

// MARK: - Custom Envelope Editor Sheet
struct EnvelopeEditorSheet: View {
    @Binding var envelope: TempEnvelope
    var isNew: Bool = false
    var availableBudget: Double = 0
    var onSave: (TempEnvelope) -> Void
    var onCancel: () -> Void
    
    // Local state for editing
    @State private var editedName: String = ""
    @State private var editedAmountText: String = ""
    @State private var editedIcon: String = "cart"
    @State private var editedColor: String = "Blue"
    
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
            Color.appBackground.opacity(0.8).ignoresSafeArea()
                .onTapGesture {
                    // Optional: dismiss on background tap? Maybe not for modal
                }
            
            VStack(alignment: .leading, spacing: 20) {
                Text(isNew ? "Ajout d'enveloppe" : "Modifier l'enveloppe")
                    .font(.title2)
                    .bold()
                    .foregroundColor(.appText)
                
                // Name
                VStack(alignment: .leading, spacing: 8) {
                    Text("Nom").font(.caption).foregroundColor(.gray)
                    TextField("Type", text: $editedName)
                        .padding()
                        .background(Color.appBackground)
                        .cornerRadius(8)
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.appBorder, lineWidth: 1))
                        .foregroundColor(.appText)
                }
                
                // Amount
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("Budget Mensuel").font(.caption).foregroundColor(.gray)
                        Spacer()
                        // Available budget indicator
                        HStack(spacing: 4) {
                            Text("Disponible :")
                                .font(.caption)
                                .foregroundColor(.gray)
                            Text((availableBudget - (convertToDouble(editedAmountText) ?? 0)), format: .currency(code: "EUR"))
                                .font(.caption.bold())
                                .foregroundColor(
                                    (convertToDouble(editedAmountText) ?? 0) > availableBudget
                                        ? .red
                                        : .appGreen
                                )
                        }
                    }
                    HStack {
                        TextField("0", text: $editedAmountText)
                            .keyboardType(.decimalPad)
                            .foregroundColor(.appText)
                        Text("€").foregroundColor(.gray)
                    }
                    .padding()
                    .background(Color.appBackground)
                    .cornerRadius(8)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(
                                (convertToDouble(editedAmountText) ?? 0) > availableBudget
                                    ? Color.orange
                                    : Color.appBorder,
                                lineWidth: 1
                            )
                    )

                    // Over-budget warning pill
                    if (convertToDouble(editedAmountText) ?? 0) > availableBudget {
                        HStack(spacing: 8) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .font(.caption)
                                .foregroundColor(.orange)
                            Text("Dépasse le budget disponible (\(availableBudget, specifier: "%.0f") € max)")
                                .font(.caption)
                                .foregroundColor(.orange)
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(Color.orange.opacity(0.12))
                        .cornerRadius(8)
                        .transition(.opacity.combined(with: .move(edge: .top)))
                    }
                }
                .animation(.easeInOut(duration: 0.2), value: (convertToDouble(editedAmountText) ?? 0) > availableBudget)
                
                // Icon Picker
                VStack(alignment: .leading, spacing: 8) {
                    Text("Icône").font(.caption).foregroundColor(.gray)
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 5), spacing: 10) {
                        ForEach(availableIcons, id: \.self) { icon in
                            Image(systemName: icon)
                                .foregroundColor(editedIcon == icon ? .black : .gray)
                                .padding(10)
                                .background(editedIcon == icon ? Color.appAccent : Color.appSurface)
                                .cornerRadius(8)
                                .onTapGesture {
                                    editedIcon = icon
                                }
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
                                        Circle()
                                            .strokeBorder(Color.white, lineWidth: editedColor == name ? 4 : 0)
                                    )
                                    .onTapGesture {
                                        editedColor = name
                                    }
                            }
                        }
                    }
                }
                
                Spacer().frame(height: 10)
                
                // Buttons
                HStack(spacing: 15) {
                    Button(action: onCancel) {
                        Text("Annuler")
                            .fontWeight(.bold)
                            .foregroundColor(.appText)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.appText.opacity(0.1))
                            .cornerRadius(12)
                    }
                    
                    Button(action: {
                        var newEnv = envelope
                        newEnv.name = editedName
                        newEnv.amount = convertToDouble(editedAmountText) ?? 0
                        newEnv.icon = editedIcon
                        newEnv.color = editedColor
                        onSave(newEnv)
                    }) {
                        Text("Sauvegarder")
                            .fontWeight(.bold)
                            .foregroundColor(isSaveDisabled ? Color.appSecondaryText : Color.black)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(isSaveDisabled ? Color.appSurface : Color.appAccent)
                            .cornerRadius(12)
                    }
                    .disabled(isSaveDisabled)
                }
            }
            .padding(24)
            .background(Color.appSurface) // Background similar to image
            .cornerRadius(20)
            .padding(.horizontal, 20)
        }
        .onAppear {
            editedName = envelope.name
            if envelope.amount > 0 {
                editedAmountText = String(format: "%.0f", envelope.amount)
            } else {
                editedAmountText = ""
            }
            editedIcon = envelope.icon
            editedColor = envelope.color
        }
    }
}


// MARK: - Step 0: Welcome
struct WelcomeView: View {
    var onStart: () -> Void
    @State private var animate = false
    
    var body: some View {
        ZStack {
            FloatingIconsBackground()

            VStack {
                Spacer()
                
                VStack(spacing: 0) {
                    Text("Maîtrisez votre")
                        .foregroundColor(.appText)
                    Text("Budget")
                        .foregroundColor(.appAccent)
                }
                .font(.system(size: 42, weight: .black))
                .multilineTextAlignment(.center)
                .shadow(color: .appAccent.opacity(0.3), radius: 20, x: 0, y: 10)
                .opacity(animate ? 1 : 0)
                .offset(y: animate ? 0 : 20)
                .animation(.smooth(duration: 0.5).delay(0.2), value: animate)

                
                Text("La méthode des enveloppes, revisitée. Calculez le montant idéal de vos enveloppes selon vos revenus, charges et objectifs d'épargne. Un budget sur-mesure pour maîtriser vos dépenses et réaliser vos rêves.")
                    .font(.body)
                    .multilineTextAlignment(.center)
                    .foregroundColor(.gray)
                    .padding(.horizontal, 30)
                    .padding(.top, 20)
                    .opacity(animate ? 1 : 0)
                    .offset(y: animate ? 0 : 16)
                    .animation(.smooth(duration: 0.5).delay(0.4), value: animate)
                
                Spacer()
                
                PrimaryButton(title: "Commencer", icon: "arrow.right", action: onStart)
                    .padding(.horizontal, 40)
                    .padding(.bottom, 50)
                    .opacity(animate ? 1 : 0)
                    .offset(y: animate ? 0 : 24)
                    .animation(.smooth(duration: 0.5).delay(0.6), value: animate)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .onAppear {
            animate = false
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                withAnimation { animate = true }
            }
        }
    }
}

// MARK: - Step 1: Basics
// Helper function to convert string to Double, handling commas
func convertToDouble(_ string: String) -> Double? {
    let normalized = string.replacingOccurrences(of: ",", with: ".")
    return Double(normalized)
}

struct StepBasicsView: View {
    @Binding var income: Double?
    @Binding var fixedCosts: Double?
    @Binding var savings: Double?
    var onBack: () -> Void
    var onContinue: () -> Void
    
    @State private var incomeString = ""
    @State private var costsString = ""
    @State private var savingsString = ""
    
    var capacity: Double {
        let i = convertToDouble(incomeString) ?? income ?? 0
        let f = convertToDouble(costsString) ?? fixedCosts ?? 0
        let s = convertToDouble(savingsString) ?? savings ?? 0
        return max(0, i - f - s)
    }

    var isContinueDisabled: Bool {
        (convertToDouble(incomeString) ?? 0) <= 0 ||
        costsString.isEmpty ||
        savingsString.isEmpty
    }
    
    var body: some View {
        VStack(spacing: 0) {
            Spacer().frame(height: 20)
            
            ScrollView {
                VStack(alignment: .leading, spacing: 25) {
                    Text("Commençons par les bases")
                        .font(.largeTitle)
                        .bold()
                        .foregroundColor(.appText)
                        .padding(.top, 20)
                    
                    Text("Pour établir votre budget, nous avons besoin de connaître vos flux mensuels fixes.")
                        .foregroundColor(.gray)
                    
                    // Capacity Card
                    VStack(alignment: .leading, spacing: 5) {
                        Text("Capacité pour vos enveloppes :")
                            .foregroundColor(.appGreen)
                            .font(.subheadline)
                        Text(capacity, format: .currency(code: "EUR"))
                            .font(.system(size: 34, weight: .bold))
                            .foregroundColor(.appGreen)
                    }
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.appSurface)
                    .cornerRadius(12)
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.appGreen, lineWidth: 1))
                    
                    // Inputs
                    Group {
                        CustomInput(title: "Salaire Mensuel Net", icon: "wallet.pass", text: $incomeString, placeholder: "2500")
                        CustomInput(
                            title: "Charges Incompressibles",
                            icon: "building.columns",
                            text: $costsString,
                            placeholder: "1200",
                            infoText: "Charges récurrentes automatiques prélevées chaque mois : loyer, remboursements de prêt... Ces montants sont déduits avant le calcul de vos enveloppes et ne doivent pas y figurer."
                        )
                        CustomInput(
                            title: "Objectif d'Épargne",
                            icon: "briefcase",
                            text: $savingsString,
                            placeholder: "300",
                            infoText: "Montant fixe mis de côté chaque mois pour l'épargne ou l'investissement. Déduit automatiquement avant le calcul du budget disponible pour vos enveloppes."
                        )
                    }
                }
                .padding(.horizontal)
            }
            .onTapGesture { hideKeyboard() }
            
            BottomActionBar(
                backTitle: "Retour",
                mainTitle: "Continuer",
                mainIcon: "arrow.right",
                isMainDisabled: isContinueDisabled,
                onBack: onBack,
                onMain: {
                    income = convertToDouble(incomeString)
                    fixedCosts = convertToDouble(costsString)
                    savings = convertToDouble(savingsString)
                    onContinue()
                }
            )
        }
        .onAppear {
            if let i = income, i > 0 { incomeString = String(format: "%.0f", i) }
            if let f = fixedCosts, f > 0 { costsString = String(format: "%.0f", f) }
            if let s = savings, s > 0 { savingsString = String(format: "%.0f", s) }
        }
    }
}

struct CustomInput: View {
    let title: String
    let icon: String
    @Binding var text: String
    let placeholder: String
    var infoText: String? = nil

    @FocusState private var isFocused: Bool
    @State private var glowPulse = false
    @State private var showInfo = false

    private var trimmedText: String {
        text.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var isEmpty: Bool {
        trimmedText.isEmpty
    }

    private var borderColor: Color {
        if isFocused {
            return .appAccent
        }
        if isEmpty {
            return .appAccent.opacity(glowPulse ? 0.75 : 0.2)
        }
        return .appGreen.opacity(0.6)
    }

    private var borderWidth: CGFloat {
        isFocused ? 2 : 1
    }

    private var glowColor: Color {
        if isFocused {
            return .appAccent.opacity(0.4)
        }
        if isEmpty {
            return .appAccent.opacity(glowPulse ? 0.28 : 0.0)
        }
        return .clear
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(.appAccent)
                Text(title)
                    .font(.subheadline)
                    .foregroundColor(.appText)

                Spacer()

                if infoText != nil {
                    Button(action: {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            showInfo.toggle()
                        }
                    }) {
                        Image(systemName: "info.circle")
                            .font(.callout)
                            .foregroundColor(.appAccent.opacity(0.8))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Informations")
                }
            }

            HStack {
                Text("€")
                    .foregroundColor(.gray)
                TextField(placeholder, text: $text)
                    .keyboardType(.decimalPad)
                    .foregroundColor(.appText)
                    .font(.title3)
                    .focused($isFocused)
            }
            .padding()
            .background(Color.appSurface)
            .cornerRadius(12)
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(borderColor, lineWidth: borderWidth))
            .shadow(color: glowColor, radius: 8)

            if showInfo, let info = infoText {
                HStack(alignment: .top, spacing: 6) {
                    Image(systemName: "info.circle.fill")
                        .foregroundColor(.appAccent.opacity(0.7))
                        .font(.caption)
                        .padding(.top, 1)
                    Text(info)
                        .font(.caption)
                        .foregroundColor(.gray)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.horizontal, 6)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 1.4).repeatForever(autoreverses: true)) {
                glowPulse = true
            }
        }
    }
}

// MARK: - Step 3: Envelopes
struct StepEnvelopesView: View {
    let income: Double
    let fixedCosts: Double
    let savings: Double
    @Binding var envelopes: [TempEnvelope]
    var onBack: () -> Void
    var onFinish: () -> Void
    
    @State private var showingAddSheet = false 
    // We will use this boolean to either trigger a "New" blank sheet OR edit a selected one?
    // User wants popup logic for editing.
    // Let's use a selectedEnvelope state.
    @State private var selectedEnvelopeId: UUID? = nil
    @State private var isNewEnvelope: Bool = false
    
    var totalBudget: Double { max(0, income - fixedCosts - savings) }
    var allocated: Double { envelopes.reduce(0) { $0 + $1.amount } }
    var remaining: Double { totalBudget - allocated }
    
    var isOverBudget: Bool { remaining < 0 }
    
    var body: some View {
        ZStack {
            VStack(spacing: 0) {
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Vos Enveloppes").font(.largeTitle).bold().foregroundColor(.appText)
                            Text("Définissez vos budgets pour les dépenses du quotidien (courses, sorties...).")
                                .foregroundColor(.gray)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .padding(.top, 20)
                        .padding(.horizontal)

                        HStack {
                            Text(isOverBudget ? "Dépassement :" : "Reste à attribuer :")
                                .foregroundColor(.appText).fontWeight(.medium)
                            Spacer()
                            Text(abs(remaining), format: .currency(code: "EUR"))
                                .font(.title2).bold()
                                .foregroundColor(isOverBudget ? .white : .appGreen)
                        }
                        .padding()
                        .background(isOverBudget ? Color.red.opacity(0.8) : Color.appGreen.opacity(0.1))
                        .cornerRadius(12)
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(isOverBudget ? Color.red : Color.appGreen, lineWidth: 1))
                        .padding(.horizontal)
                        
                        VStack(spacing: 12) {
                            ForEach($envelopes) { $env in
                                OnboardingEnvelopeRow(
                                    env: $env, 
                                    onTap: {
                                        selectedEnvelopeId = env.id
                                        isNewEnvelope = false
                                    },
                                    onDelete: {
                                        withAnimation {
                                            envelopes.removeAll { $0.id == env.id }
                                        }
                                    }
                                )
                            }
                            
                            Button(action: { 
                                // Create new empty env and select it
                                let new = TempEnvelope(name: "", icon: "pencil", color: "Blue", amount: 0)
                                envelopes.append(new)
                                selectedEnvelopeId = new.id
                                isNewEnvelope = true
                            }) {
                                HStack {
                                    Image(systemName: "plus")
                                    Text("Créer une enveloppe")
                                }
                                .foregroundColor(.gray)
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(
                                    RoundedRectangle(cornerRadius: 12)
                                        .stroke(style: StrokeStyle(lineWidth: 1, dash: [5]))
                                        .foregroundColor(.gray.opacity(0.5))
                                )
                            }
                            .padding(.top, 8)
                        }
                        .padding(.horizontal)
                        .padding(.bottom, 120)
                    }
                }
                .scrollIndicators(.visible)
                .onTapGesture { hideKeyboard() }
                
                BottomActionBar(
                    backTitle: "Retour",
                    mainTitle: "Terminer",
                    mainIcon: "checkmark.circle",
                    isMainDisabled: remaining < 0,
                    onBack: onBack,
                    onMain: onFinish
                )
            }
            
            // Custom Modal
            if let selectedId = selectedEnvelopeId,
               let index = envelopes.firstIndex(where: { $0.id == selectedId }) {
                
                EnvelopeEditorSheet(
                    envelope: $envelopes[index],
                    isNew: isNewEnvelope,
                    availableBudget: remaining + envelopes[index].amount,
                    onSave: { newEnv in
                        envelopes[index] = newEnv
                        selectedEnvelopeId = nil
                        isNewEnvelope = false
                    },
                    onCancel: {
                        if isNewEnvelope {
                            withAnimation {
                                envelopes.removeAll { $0.id == selectedEnvelopeId }
                            }
                        }
                        selectedEnvelopeId = nil
                        isNewEnvelope = false
                    }
                )
            }
        }
    }
}

struct OnboardingEnvelopeRow: View {
    @Binding var env: TempEnvelope
    var onTap: () -> Void
    var onDelete: () -> Void
    
    @State private var amountText: String = ""
    @State private var offset: CGFloat = 0
    @State private var isSwiping: Bool = false
    
    private let deleteThreshold: CGFloat = -80
    
    var body: some View {
        ZStack(alignment: .trailing) {
            // Delete Background (visible when swiping left)
            HStack {
                Spacer()
                Text("Supprimer")
                    .font(.headline)
                    .foregroundColor(.appText)
                    .padding(.horizontal, 20)
            }
            .frame(maxWidth: .infinity)
            .background(Color.red)
            .cornerRadius(16)
            
            // Main Content
            HStack {
                // Icon + Text Section (Tappable for Edit)
                Button(action: onTap) {
                    HStack {
                        EnvelopeIconView(icon: env.icon, colorString: env.color, size: 48)
                        
                        VStack(alignment: .leading, spacing: 2) {
                            Text(env.name)
                                .font(.headline)
                                .fontWeight(.bold)
                                .foregroundColor(.appText)
                            Text("Budget mensuel")
                                .font(.caption)
                                .foregroundColor(.gray)
                        }
                    }
                }
                
                Spacer()
                
                // Amount Input Pill (Direct Edit)
                HStack(spacing: 4) {
                    Text("€").foregroundColor(.gray).font(.caption)
                    
                    TextField("Amount", text: $amountText)
                        .keyboardType(.decimalPad)
                        .multilineTextAlignment(.trailing)
                        .foregroundColor(.appText)
                        .font(.headline)
                        .frame(width: 50)
                        .onChange(of: amountText) { oldValue, newValue in
                            if let value = convertToDouble(newValue) {
                                env.amount = value
                            } else if newValue.isEmpty {
                                env.amount = 0
                            }
                        }
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Color.appBackground.opacity(0.5))
                .cornerRadius(8)
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.appBorder, lineWidth: 1))
                
                // Delete Button
                Button(action: {
                    withAnimation {
                        onDelete()
                    }
                }) {
                    Image(systemName: "trash")
                        .foregroundColor(.red)
                        .font(.system(size: 16))
                        .padding(8)
                }
            }
            .padding(16)
            .background(Color.appSurface)
            .cornerRadius(16)
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.appBorder, lineWidth: 1))
            .offset(x: offset)
            .gesture(
                DragGesture()
                    .onChanged { gesture in
                        let horizontalAmount = gesture.translation.width
                        let verticalAmount = gesture.translation.height
                        
                        // Only process horizontal swipes (left swipe)
                        // If vertical movement is greater than horizontal, ignore (allow scroll)
                        if abs(horizontalAmount) > abs(verticalAmount) && horizontalAmount < 0 {
                            offset = horizontalAmount
                            isSwiping = true
                        }
                    }
                    .onEnded { gesture in
                        let horizontalAmount = gesture.translation.width
                        let verticalAmount = gesture.translation.height
                        
                        // Only process if it was a horizontal swipe
                        if abs(horizontalAmount) > abs(verticalAmount) {
                            withAnimation(.spring()) {
                                // If swiped past threshold, delete
                                if offset < deleteThreshold {
                                    offset = -400 // Slide completely off screen
                                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                                        onDelete()
                                    }
                                } else {
                                    // Otherwise, snap back
                                    offset = 0
                                }
                            }
                        } else {
                            // Reset if it was a vertical swipe
                            withAnimation(.spring()) {
                                offset = 0
                            }
                        }
                        isSwiping = false
                    }
            )
        }
        .onAppear {
            amountText = env.amount > 0 ? String(format: "%.0f", env.amount) : ""
        }
        .onChange(of: env.amount) { oldValue, newValue in
            // Update the text field when the amount changes from outside (like from popup)
            if !isSwiping {
                amountText = newValue > 0 ? String(format: "%.0f", newValue) : ""
            }
        }
    }
}

// MARK: - Reusable Components
struct BottomActionBar: View {
    let backTitle: String
    let mainTitle: String
    let mainIcon: String
    var isMainDisabled: Bool = false
    let onBack: () -> Void
    let onMain: () -> Void
    
    var body: some View {
        HStack(spacing: 12) {
            Button(action: onBack) {
                Text(backTitle)
                    .font(.headline)
                    .fontWeight(.bold)
                    .foregroundColor(.appSecondaryText)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.appSurface)
                    .cornerRadius(12)
            }
            .frame(width: UIScreen.main.bounds.width * 0.3)
            
            Button(action: onMain) {
                HStack {
                    Text(mainTitle)
                    Image(systemName: mainIcon)
                }
                .font(.headline)
                .fontWeight(.bold)
                .foregroundColor(isMainDisabled ? Color.appSecondaryText : Color.black)
                .frame(maxWidth: .infinity)
                .padding()
                .background(isMainDisabled ? Color.appSurface : Color.appAccent)
                .cornerRadius(12)
            }
            .disabled(isMainDisabled)
        }
        .padding(20)
        .background(Color.appBackground)
    }
}


// MARK: - Background Effects
struct ExpensePill: View {
    let icon: String
    let name: String
    let amount: String
    let color: Color
    
    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .padding(6)
                .background(color.opacity(0.2))
                .foregroundColor(color)
                .clipShape(Circle())
            
            VStack(alignment: .leading, spacing: 2) {
                Text(name)
                    .font(.caption2)
                    .fontWeight(.bold)
                    .foregroundColor(.gray)
                    .textCase(.uppercase)
                Text(amount)
                    .font(.caption).fontWeight(.bold).foregroundColor(.appText)
            }
        }
        .padding(8)
        .padding(.trailing, 8)
        .background(Color.appSurface)
        .cornerRadius(30)
        .shadow(color: .black.opacity(0.2), radius: 5, x: 0, y: 2)
        .overlay(RoundedRectangle(cornerRadius: 30).stroke(Color.appBorder, lineWidth: 1))
    }
}

struct FloatingIconsBackground: View {
    @State private var animate = false
    
    let items: [(String, String, String, Color, CGFloat, CGFloat, CGFloat)] = [
        ("pawprint.fill", "VÉTÉRINAIRE", "-49€", .purple, -100, -280, 1.0),
        ("cart.fill", "COURSES", "-120€", .blue, 20, -340, 0.9),
        ("fork.knife", "MACDO", "-18€", .yellow, 130, -200, 1.1),
        ("cup.and.saucer.fill", "CAFÉ", "-4.50€", .green, 100, 200, 1.0),
        ("fuelpump.fill", "ESSENCE", "-60€", .orange, -120, 150, 0.9),
    ]
    
    var body: some View {
        ZStack {
            ForEach(0..<items.count, id: \.self) { i in
                ExpensePill(
                    icon: items[i].0,
                    name: items[i].1,
                    amount: items[i].2,
                    color: items[i].3
                )
                .scaleEffect(items[i].6)
                .blur(radius: 1.2)
                .offset(x: items[i].4, y: items[i].5)
                .offset(y: animate ? -15 : 15)
                .animation(
                    Animation.easeInOut(duration: Double.random(in: 3...5))
                        .repeatForever(autoreverses: true)
                        .delay(Double.random(in: 0...2)),
                    value: animate
                )
            }
        }
        .onAppear { animate = true }
    }
}

#Preview {
    let config = ModelConfiguration(isStoredInMemoryOnly: true)
    let container = try! ModelContainer(for: UserSettings.self, Envelope.self, configurations: config)
    let settings = UserSettings()
    return OnboardingView(settings: .constant(settings))
            .modelContainer(container)
            .previewDevice(PreviewDevice(rawValue: "iPhone 17"))
}

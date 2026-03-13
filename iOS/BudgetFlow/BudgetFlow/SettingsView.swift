import SwiftUI
import SwiftData
import UserNotifications
import UIKit

struct SettingsView: View {
    @Bindable var settings: UserSettings
    @Environment(\.dismiss) private var dismiss
    @Environment(SyncService.self) private var syncService
    @Query(sort: \Envelope.order) private var envelopes: [Envelope]

    @State private var incomeText: String = ""
    @State private var fixedCostsText: String = ""
    @State private var savingsText: String = ""
    @Environment(FirebaseManager.self) private var firebaseManager
    @Environment(\.modelContext) private var modelContext
    @AppStorage("isOnboarded") private var isOnboarded: Bool = false
    @State private var showSignOutAlert = false
    @State private var signOutError: String? = nil
    @State private var showSignOutError = false

    @Query private var allTransactions: [Transaction]
    @AppStorage("notificationsEnabled") private var notificationsEnabled = false
    @AppStorage("notificationHour") private var notificationHour: Int = 21
    @AppStorage("notificationMinute") private var notificationMinute: Int = 0
    @AppStorage("notificationDaysRaw") private var notificationDaysRaw: String = "2,3,4,5,6"
    @State private var showNotifPermissionDeniedAlert = false

    private var totalEnvelopes: Double {
        envelopes.reduce(0) { $0 + $1.budget }
    }

    private var equilibre: Double {
        let income = convertToDouble(incomeText) ?? settings.monthlyIncome
        let fixed = convertToDouble(fixedCostsText) ?? settings.fixedCosts
        let savings = convertToDouble(savingsText) ?? settings.monthlySavings
        return income - fixed - savings - totalEnvelopes
    }

    private var notificationDays: Set<Int> {
        Set(notificationDaysRaw.split(separator: ",").compactMap { Int($0) })
    }

    private func setNotificationDays(_ newValue: Set<Int>) {
        notificationDaysRaw = newValue.sorted().map(String.init).joined(separator: ",")
    }

    private var notificationTimeBinding: Binding<Date> {
        Binding(
            get: {
                var c = DateComponents()
                c.hour = notificationHour
                c.minute = notificationMinute
                return Calendar.current.date(from: c) ?? Date()
            },
            set: { date in
                let c = Calendar.current.dateComponents([.hour, .minute], from: date)
                notificationHour = c.hour ?? 21
                notificationMinute = c.minute ?? 0
                rescheduleIfEnabled()
            }
        )
    }

    private var todayStats: (total: Double, count: Int) {
        let today = Calendar.current.startOfDay(for: Date())
        let filtered = allTransactions.filter {
            Calendar.current.startOfDay(for: $0.date) == today
        }
        return (filtered.reduce(0) { $0 + $1.amount }, filtered.count)
    }

    private let weekDayConfig: [(label: String, weekday: Int)] = [
        ("L", 2), ("M", 3), ("M", 4), ("J", 5), ("V", 6), ("S", 7), ("D", 1)
    ]

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
                                    .foregroundColor(.appAccent)
                                Text("Budget Global")
                                    .font(.headline)
                                    .foregroundColor(.appText)
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
                        .overlay(RoundedRectangle(cornerRadius: 20).stroke(Color.appBorder, lineWidth: 1))

                        // --- Summary Card ---
                        VStack(spacing: 0) {
                            summaryRow(
                                label: "Total Enveloppes",
                                value: totalEnvelopes,
                                color: .appAccent
                            )
                            Divider()
                                .overlay(Color.appBorder)
                                .padding(.horizontal, 4)
                            summaryRow(
                                label: "Épargne visée",
                                value: convertToDouble(savingsText) ?? settings.monthlySavings,
                                color: .appGreen
                            )
                            Divider()
                                .overlay(Color.appBorder)
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
                        .overlay(RoundedRectangle(cornerRadius: 20).stroke(Color.appBorder, lineWidth: 1))

                        // --- Navigation to Envelopes ---
                        NavigationLink(destination: ManageEnvelopesView()) {
                            HStack {
                                Image(systemName: "tray.2.fill")
                                    .foregroundColor(.appAccent)
                                Text("Mes Enveloppes")
                                    .foregroundColor(.appText)
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .foregroundColor(.secondary)
                                    .font(.caption)
                            }
                            .padding()
                            .background(Color.appSurface)
                            .clipShape(RoundedRectangle(cornerRadius: 16))
                            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.appBorder, lineWidth: 1))
                        }

                        // Section Notifications
                        VStack(alignment: .leading, spacing: 16) {
                            HStack(spacing: 8) {
                                Image(systemName: "bell.fill")
                                    .foregroundColor(.appAccent)
                                Text("Notifications")
                                    .font(.headline)
                                    .foregroundColor(.appText)
                            }

                            Toggle(isOn: Binding(
                                get: { notificationsEnabled },
                                set: { handleNotificationsToggle($0) }
                            )) {
                                Text("Rappels de saisie")
                                    .foregroundColor(.appText)
                                    .font(.subheadline)
                            }
                            .tint(.appAccent)

                            if notificationsEnabled {
                                Divider().overlay(Color.appBorder)

                                DatePicker(
                                    "Heure",
                                    selection: notificationTimeBinding,
                                    displayedComponents: .hourAndMinute
                                )
                                .datePickerStyle(.compact)
                                .foregroundColor(.appText)

                                Divider().overlay(Color.appBorder)

                                VStack(alignment: .leading, spacing: 8) {
                                    Text("Jours")
                                        .font(.subheadline)
                                        .foregroundColor(.appText)

                                    HStack(spacing: 8) {
                                        ForEach(weekDayConfig, id: \.weekday) { config in
                                            let isSelected = notificationDays.contains(config.weekday)
                                            Button(config.label) {
                                                var days = notificationDays
                                                if isSelected { days.remove(config.weekday) }
                                                else { days.insert(config.weekday) }
                                                setNotificationDays(days)
                                                rescheduleIfEnabled()
                                            }
                                            .frame(width: 36, height: 36)
                                            .background(isSelected ? Color.appAccent : Color.appSecondaryText.opacity(0.15))
                                            .foregroundColor(isSelected ? .black : Color.appText)
                                            .clipShape(Circle())
                                            .font(.caption.bold())
                                        }
                                    }
                                }
                            }
                        }
                        .padding()
                        .background(Color.appSurface)
                        .clipShape(RoundedRectangle(cornerRadius: 20))
                        .overlay(RoundedRectangle(cornerRadius: 20).stroke(Color.appBorder, lineWidth: 1))
                        .alert("Notifications désactivées", isPresented: $showNotifPermissionDeniedAlert) {
                            Button("Ouvrir Réglages") {
                                if let url = URL(string: UIApplication.openSettingsURLString) {
                                    UIApplication.shared.open(url)
                                }
                            }
                            Button("Annuler", role: .cancel) {}
                        } message: {
                            Text("BudgetFlow n'a pas la permission d'envoyer des notifications. Activez-les dans Réglages > Notifications.")
                        }

                        if settings.isOnlineMode {
                            Button(role: .destructive) {
                                showSignOutAlert = true
                            } label: {
                                HStack {
                                    Spacer()
                                    Image(systemName: "rectangle.portrait.and.arrow.right")
                                    Text("Se déconnecter")
                                        .fontWeight(.semibold)
                                    Spacer()
                                }
                                .foregroundColor(.red)
                                .padding()
                                .background(Color.appSurface)
                                .clipShape(RoundedRectangle(cornerRadius: 16))
                                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.red.opacity(0.3), lineWidth: 1))
                            }
                            .alert("Se déconnecter ?", isPresented: $showSignOutAlert) {
                                Button("Se déconnecter", role: .destructive) { performSignOut() }
                                Button("Annuler", role: .cancel) {}
                            } message: {
                                Text("Toutes les données locales seront supprimées. Vos données restent disponibles sur Firestore.")
                            }
                            .alert("Erreur", isPresented: $showSignOutError) {
                                Button("OK", role: .cancel) {}
                            } message: {
                                Text(signOutError ?? "Une erreur est survenue.")
                            }
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
                .foregroundColor(.appText)
                .font(.subheadline)
            Spacer()
            Text(value, format: .currency(code: "EUR"))
                .font(.subheadline.bold())
                .foregroundColor(color)
        }
        .padding(.vertical, 10)
        .padding(.horizontal)
    }

    private func loadStrings() {
        incomeText = settings.monthlyIncome > 0 ? String(format: "%.0f", settings.monthlyIncome) : ""
        fixedCostsText = settings.fixedCosts > 0 ? String(format: "%.0f", settings.fixedCosts) : ""
        savingsText = settings.monthlySavings > 0 ? String(format: "%.0f", settings.monthlySavings) : ""
    }

    private func syncToSettings() {
        if let val = convertToDouble(incomeText) { settings.monthlyIncome = val }
        if let val = convertToDouble(fixedCostsText) { settings.fixedCosts = val }
        if let val = convertToDouble(savingsText) { settings.monthlySavings = val }
        
        // Sync to Firestore if online mode
        if settings.isOnlineMode, !settings.firebaseUserId.isEmpty {
            let userId = settings.firebaseUserId
            let s = settings
            Task { await syncService.syncSettings(s, userId: userId) }
        }
    }

    private func performSignOut() {
        do {
            try firebaseManager.signOut()
            // Supprime les Envelopes un par un — la règle cascade supprime automatiquement leurs Transactions associées
            let envelopes = try modelContext.fetch(FetchDescriptor<Envelope>())
            for envelope in envelopes {
                modelContext.delete(envelope)
            }
            // Supprime les éventuelles Transactions orphelines (sans envelope)
            let orphanTransactions = try modelContext.fetch(FetchDescriptor<Transaction>())
            for transaction in orphanTransactions {
                modelContext.delete(transaction)
            }
            // Supprime les UserSettings
            let allSettings = try modelContext.fetch(FetchDescriptor<UserSettings>())
            for setting in allSettings {
                modelContext.delete(setting)
            }
            try modelContext.save()
            NotificationService.shared.cancelAllNotifications()
            isOnboarded = false
        } catch {
            signOutError = error.localizedDescription
            showSignOutError = true
        }
    }

    private func handleNotificationsToggle(_ enabled: Bool) {
        notificationsEnabled = enabled
        if enabled {
            Task {
                let status = await NotificationService.shared.currentAuthorizationStatus()
                switch status {
                case .notDetermined:
                    let granted = await NotificationService.shared.requestPermission()
                    await MainActor.run {
                        if granted { rescheduleIfEnabled() }
                        else { notificationsEnabled = false }
                    }
                case .authorized, .provisional, .ephemeral:
                    rescheduleIfEnabled()
                case .denied:
                    notificationsEnabled = false
                    showNotifPermissionDeniedAlert = true
                @unknown default:
                    notificationsEnabled = false
                }
            }
        } else {
            NotificationService.shared.cancelAllNotifications()
        }
    }

    private func rescheduleIfEnabled() {
        guard notificationsEnabled else { return }
        let days = notificationDays
        guard !days.isEmpty else { return }
        let stats = todayStats
        NotificationService.shared.scheduleWeeklyNotifications(
            days: days,
            hour: notificationHour,
            minute: notificationMinute,
            todayExpenses: stats.total,
            todayCount: stats.count,
            currency: settings.currency
        )
    }
}

#Preview {
    let config = ModelConfiguration(isStoredInMemoryOnly: true)
    let container = try! ModelContainer(for: UserSettings.self, Envelope.self, configurations: config)
    let settings = UserSettings(monthlyIncome: 3000, fixedCosts: 1200, monthlySavings: 300)
    container.mainContext.insert(settings)
    return SettingsView(settings: settings)
        .modelContainer(container)
        .environment(SyncService())
        .preferredColorScheme(.dark)
}

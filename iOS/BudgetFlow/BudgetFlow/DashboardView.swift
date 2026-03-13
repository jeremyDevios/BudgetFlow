import SwiftUI
import SwiftData

struct DashboardView: View {
    @Environment(SyncService.self) private var syncService
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Envelope.order) private var envelopes: [Envelope]
    @Query private var userSettings: [UserSettings]

    @State private var selectedMonth = Date()
    @State private var showingAddTransaction = false
    @State private var selectedEnvelopeForTransaction: Envelope? = nil
    @State private var showingSettings = false
    @State private var isRefreshing = false

    var settings: UserSettings? { userSettings.first }

    var monthRange: (start: Date, end: Date) {
        (Calendar.current.startOfMonth(for: selectedMonth),
         Calendar.current.endOfMonth(for: selectedMonth))
    }

    var spentPerEnvelope: [UUID: Double] {
        Dictionary(uniqueKeysWithValues: envelopes.map {
            ($0.id, monthlySpent(for: $0, in: monthRange))
        })
    }

    var totalSpentThisMonth: Double { spentPerEnvelope.values.reduce(0, +) }

    var availablePlanned: Double {
        guard let s = settings else { return 0 }
        return s.monthlyIncome - s.fixedCosts - s.monthlySavings
    }

    var currentMonthBalance: Double { availablePlanned - totalSpentThisMonth }

    var globalProgress: Double {
        availablePlanned > 0 ? totalSpentThisMonth / availablePlanned : 0
    }

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            // Dark gradient background
            LinearGradient(
                colors: [Color.appSurface, Color.appBackground],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            ScrollView {
                VStack(spacing: 20) {
                    if isRefreshing {
                        HStack(spacing: 8) {
                            ProgressView()
                            Text("Actualisation...")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .animation(.easeInOut, value: isRefreshing)
                    }

                    BalanceSummaryCard(
                        currentMonthBalance: currentMonthBalance,
                        availablePlanned: availablePlanned,
                        totalSpentThisMonth: totalSpentThisMonth,
                        globalProgress: globalProgress,
                        envelopes: envelopes,
                        spentPerEnvelope: spentPerEnvelope
                    )

                    EnvelopeGridSection(
                        envelopes: envelopes,
                        spentPerEnvelope: spentPerEnvelope,
                        monthRange: monthRange,
                        onAddTransaction: { envelope in
                            selectedEnvelopeForTransaction = envelope
                            showingAddTransaction = true
                        }
                    )
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 100)
            }
            .scrollIndicators(.hidden)
            .refreshable {
                guard let settings,
                      settings.isOnlineMode,
                      !settings.firebaseUserId.isEmpty else { return }
                isRefreshing = true
                defer { isRefreshing = false }
                try? await syncService.loadFromFirestore(
                    userId: settings.firebaseUserId,
                    into: modelContext
                )
            }

            // FAB
            Button {
                selectedEnvelopeForTransaction = nil
                showingAddTransaction = true
            } label: {
                Image(systemName: "plus")
                    .font(.title2.bold())
                    .foregroundStyle(.black)
                    .frame(width: 56, height: 56)
                        .background(Color.appAccent)
                    .clipShape(Circle())
                        .shadow(color: Color.appAccent.opacity(0.4), radius: 12, y: 4)
            }
            .padding(.trailing, 20)
            .padding(.bottom, 20)
                    .accessibilityLabel("Ajouter une transaction")
            .sensoryFeedback(.impact, trigger: showingAddTransaction)
        }
        .toolbar {
            ToolbarItem(placement: .principal) {
                MonthSelectorPill(selectedMonth: $selectedMonth)
            }
            ToolbarItemGroup(placement: .topBarTrailing) {
                Button {
                    showingSettings = true
                } label: {
                    Image(systemName: "gearshape")
                        .foregroundStyle(.secondary)
                }
                .accessibilityLabel("Paramètres")
            }
        }
        .toolbarBackground(.ultraThinMaterial, for: .navigationBar)
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(for: Envelope.self) { envelope in
            EnvelopeDetailView(envelope: envelope, selectedMonth: selectedMonth)
        }
        .sheet(isPresented: $showingAddTransaction) {
            AddTransactionView(
                envelopes: envelopes,
                preselectedEnvelope: selectedEnvelopeForTransaction
            )
        }
        .sheet(isPresented: $showingSettings) {
            if let s = settings {
                SettingsView(settings: s)
            }
        }
    }
}

// MARK: - Month Selector Pill

private struct MonthSelectorPill: View {
    @Binding var selectedMonth: Date

    var body: some View {
        HStack(spacing: 12) {
            Button { changeMonth(-1) } label: {
                Image(systemName: "chevron.left")
                    .font(.subheadline.bold())
                    .foregroundStyle(.primary)
            }
            .accessibilityLabel("Mois précédent")

            Text(selectedMonth, format: .dateTime.month(.wide).year())
                .font(.subheadline.bold())
                .frame(minWidth: 130)
                .textCase(.none)

            Button { changeMonth(1) } label: {
                Image(systemName: "chevron.right")
                    .font(.subheadline.bold())
                    .foregroundStyle(.primary)
            }
            .accessibilityLabel("Mois suivant")
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .background(.ultraThinMaterial, in: Capsule())
        .overlay(Capsule().stroke(.white.opacity(0.15), lineWidth: 1))
    }

    private func changeMonth(_ value: Int) {
        if let newDate = Calendar.current.date(byAdding: .month, value: value, to: selectedMonth) {
            selectedMonth = newDate
        }
    }
}

#Preview {
    NavigationStack {
        DashboardView()
    }
    .modelContainer(for: [UserSettings.self, Envelope.self, Transaction.self], inMemory: true)
    .environment(SyncService())
    .preferredColorScheme(.dark)
}

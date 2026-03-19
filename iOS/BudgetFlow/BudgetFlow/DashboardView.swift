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
    @State private var fabPulsing = false
    @State private var pendingToastEnvelope: Envelope? = nil
    @State private var pendingToastAmount: Double? = nil
    @State private var toastMessage: String? = nil
    @State private var showToast = false
    @State private var highlightedEnvelopeId: UUID? = nil

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
                        },
                        highlightedEnvelopeId: highlightedEnvelopeId
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
                    .scaleEffect(fabPulsing ? 1.06 : 1.0)
                    .shadow(color: Color.appAccent.opacity(fabPulsing ? 0.65 : 0.35), radius: fabPulsing ? 20 : 12, y: 4)
            }
            .onAppear {
                withAnimation(.easeInOut(duration: 1.8).repeatForever(autoreverses: true)) {
                    fabPulsing = true
                }
            }
            .padding(.trailing, 20)
            .padding(.bottom, 20)
            .accessibilityLabel("Ajouter une transaction")
            .sensoryFeedback(.impact, trigger: showingAddTransaction)

            // Toast notification pill
            if showToast, let msg = toastMessage {
                Text(msg)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(Color.appGreen, in: Capsule())
                    .shadow(color: Color.appGreen.opacity(0.4), radius: 12, y: 4)
                    .padding(.top, 8)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .zIndex(100)
                    .allowsHitTesting(false)
            }
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
        .sheet(isPresented: $showingAddTransaction, onDismiss: {
            guard let envelope = pendingToastEnvelope, let amount = pendingToastAmount else { return }
            let amountFormatted = amount.formatted(.currency(code: "EUR"))
            toastMessage = "✓ \(amountFormatted) ajoutés dans \(envelope.name)"
            highlightedEnvelopeId = envelope.id
            pendingToastEnvelope = nil
            pendingToastAmount = nil
            withAnimation(.spring(response: 0.4, dampingFraction: 0.7)) { showToast = true }
            DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
                withAnimation(.easeOut(duration: 0.4)) { showToast = false }
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 3.5) {
                highlightedEnvelopeId = nil
            }
        }) {
            AddTransactionView(
                envelopes: envelopes,
                preselectedEnvelope: selectedEnvelopeForTransaction,
                onTransactionSaved: { env, amt in
                    pendingToastEnvelope = env
                    pendingToastAmount = amt
                }
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
    @State private var isMovingForward = true

    private var monthDisplayText: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "fr_FR")
        formatter.dateFormat = "MMMM yyyy"
        let str = formatter.string(from: selectedMonth)
        return str.prefix(1).uppercased() + str.dropFirst()
    }

    var body: some View {
        HStack(spacing: 12) {
            Button { changeMonth(-1) } label: {
                Image(systemName: "chevron.left")
                    .font(.subheadline.bold())
                    .foregroundStyle(.primary)
            }
            .accessibilityLabel("Mois précédent")

            Text(monthDisplayText)
                .font(.subheadline.bold())
                .frame(minWidth: 130)
                .textCase(.none)
                .id(monthDisplayText)
                .transition(.asymmetric(
                    insertion: .move(edge: isMovingForward ? .trailing : .leading).combined(with: .opacity),
                    removal: .move(edge: isMovingForward ? .leading : .trailing).combined(with: .opacity)
                ))

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
        .clipped()
        .sensoryFeedback(.selection, trigger: selectedMonth)
    }

    private func changeMonth(_ value: Int) {
        if let newDate = Calendar.current.date(byAdding: .month, value: value, to: selectedMonth) {
            isMovingForward = value > 0
            withAnimation(.snappy(duration: 0.3)) {
                selectedMonth = newDate
            }
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

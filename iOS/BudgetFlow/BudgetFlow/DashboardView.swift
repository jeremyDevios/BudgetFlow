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
    @State private var searchQuery = ""
    @State private var searchBarAppeared = false
    @FocusState private var isSearchFocused: Bool

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

    fileprivate var allMonthlyTransactions: [DashboardSearchResult] {
        envelopes
            .flatMap { envelope in
                envelope.transactions
                    .filter { $0.date >= monthRange.start && $0.date <= monthRange.end }
                    .map { DashboardSearchResult(envelope: envelope, transaction: $0) }
            }
            .sorted { $0.transaction.date > $1.transaction.date }
    }

    var normalizedSearchQuery: String {
        searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var showSearchResults: Bool { !normalizedSearchQuery.isEmpty }

    fileprivate var filteredSearchResults: [DashboardSearchResult] {
        guard showSearchResults else { return [] }
        let query = normalizedSearchQuery.localizedLowercase
        return allMonthlyTransactions
            .filter { result in
                result.transaction.note.localizedLowercase.contains(query)
                || result.envelope.name.localizedLowercase.contains(query)
                || amountMatches(result.transaction.amount, query: searchQuery)
            }
            .prefix(6)
            .map { $0 }
    }

    private func amountMatches(_ amount: Double, query: String) -> Bool {
        let trimmed = query.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return false }
        // Match against integer part (e.g. "25" matches 25.50)
        let intStr = String(Int(amount))
        // Match against full decimal with dot (e.g. "25.5")
        let dotStr = String(format: "%.2f", amount)
        // Match against full decimal with comma (French style, "25,50")
        let commaStr = dotStr.replacingOccurrences(of: ".", with: ",")
        return intStr.contains(trimmed) || dotStr.contains(trimmed) || commaStr.contains(trimmed)
    }

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

                    DashboardSearchBar(
                        query: $searchQuery,
                        isFocused: $isSearchFocused
                    )
                    .opacity(searchBarAppeared ? 1 : 0)
                    .offset(y: searchBarAppeared ? 0 : 16)
                    .animation(.smooth(duration: 0.35), value: searchBarAppeared)

                    ZStack(alignment: .top) {
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

                        if showSearchResults {
                            DashboardSearchResultsOverlay(
                                results: filteredSearchResults,
                                query: normalizedSearchQuery
                            )
                            .transition(.move(edge: .top).combined(with: .opacity))
                        }
                    }
                    .animation(.spring(response: 0.35, dampingFraction: 0.75), value: showSearchResults)
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
            .onAppear {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                    withAnimation(.smooth(duration: 0.35)) { searchBarAppeared = true }
                }
            }
            .onDisappear {
                searchBarAppeared = false
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

fileprivate struct DashboardSearchResult: Identifiable {
    let envelope: Envelope
    let transaction: Transaction

    var id: UUID { transaction.id }
}

private struct DashboardSearchBar: View {
    @Binding var query: String
    @FocusState.Binding var isFocused: Bool

    private var isActive: Bool {
        isFocused || !query.isEmpty
    }

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(Color.appSecondaryText)

            TextField(
                "",
                text: $query,
                prompt: Text("Rechercher ce mois...")
                    .foregroundStyle(Color.appSecondaryText)
            )
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .focused($isFocused)
            .tint(Color.appYellow)

            if !query.isEmpty {
                Button {
                    query = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(Color.appSecondaryText)
                }
                .buttonStyle(.plain)
                .sensoryFeedback(.selection, trigger: query)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(Color.appSurface, in: Capsule())
        .overlay(
            Capsule()
                .stroke(isActive ? Color.appYellow : Color.appBorder, lineWidth: 1)
        )
        .animation(.spring(response: 0.3, dampingFraction: 0.75), value: query)
        .animation(.spring(response: 0.3, dampingFraction: 0.75), value: isFocused)
    }
}

private struct DashboardSearchResultsOverlay: View {
    let results: [DashboardSearchResult]
    let query: String

    var body: some View {
        VStack(spacing: 8) {
            if results.isEmpty {
                Text("Aucun résultat")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 24)
            } else {
                ForEach(Array(results.enumerated()), id: \.element.id) { index, result in
                    NavigationLink(value: result.envelope) {
                        DashboardSearchResultRow(result: result)
                    }
                    .buttonStyle(DashboardSearchResultPressStyle())
                    .opacity(1)
                    .offset(y: 0)
                    .animation(.smooth(duration: 0.35).delay(Double(index) * 0.05), value: query)
                }
            }
        }
        .padding(10)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(Color.appBorder, lineWidth: 1)
        )
        .padding(.top, 2)
    }
}

private struct DashboardSearchResultRow: View {
    let result: DashboardSearchResult

    var body: some View {
        HStack(spacing: 10) {
            Circle()
                .fill(Color.fromString(result.envelope.color))
                .frame(width: 10, height: 10)

            VStack(alignment: .leading, spacing: 2) {
                Text(result.transaction.note.isEmpty ? "Dépense sans note" : result.transaction.note)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Color.appText)
                    .lineLimit(1)

                Text(result.envelope.name)
                    .font(.caption)
                    .foregroundStyle(Color.appSecondaryText)
                    .lineLimit(1)
            }

            Spacer()

            Text("-\(result.transaction.amount.formatted(.currency(code: "EUR")))")
                .font(.subheadline.bold())
                .foregroundStyle(.red)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Color.appSurface.opacity(0.8), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

private struct DashboardSearchResultPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(.spring(response: 0.22, dampingFraction: 0.7), value: configuration.isPressed)
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

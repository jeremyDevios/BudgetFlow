import XCTest
import SwiftData
@testable import BudgetFlow

// MARK: - Helpers

private func makeOfflineContainer() throws -> ModelContainer {
    let schema = Schema([Envelope.self, Transaction.self, UserSettings.self])
    let config = ModelConfiguration(isStoredInMemoryOnly: true)
    return try ModelContainer(for: schema, configurations: config)
}

// MARK: - Offline Onboarding Flow Tests

@MainActor
final class OfflineOnboardingFlowTests: XCTestCase {

    var container: ModelContainer!
    var context: ModelContext!

    override func setUp() async throws {
        try await super.setUp()
        container = try makeOfflineContainer()
        context = container.mainContext
    }

    override func tearDown() async throws {
        context = nil
        container = nil
        try await super.tearDown()
    }

    func test_offlineOnboarding_createsUserSettings() throws {
        // Simulate finishOnboarding creating UserSettings
        let settings = UserSettings()
        settings.monthlyIncome = 3000
        settings.fixedCosts = 800
        settings.monthlySavings = 300
        settings.isOnlineMode = false
        settings.isOnboarded = true
        context.insert(settings)
        try context.save()

        let fetched = try context.fetch(FetchDescriptor<UserSettings>())
        XCTAssertEqual(fetched.count, 1)
        XCTAssertEqual(fetched[0].monthlyIncome, 3000, accuracy: 0.001)
        XCTAssertFalse(fetched[0].isOnlineMode)
        XCTAssertTrue(fetched[0].isOnboarded)
    }

    func test_offlineOnboarding_createsDefaultEnvelopes() throws {
        // Simulate the default envelopes created during offline onboarding
        let defaultEnvelopes = [
            Envelope(name: "Courses", icon: "cart", color: "0000FF", budget: 300, order: 0),
            Envelope(name: "Essence", icon: "fuelpump", color: "FF6600", budget: 150, order: 1),
            Envelope(name: "Loisirs", icon: "gamecontroller", color: "00AA00", budget: 100, order: 2)
        ]
        for env in defaultEnvelopes {
            context.insert(env)
        }
        try context.save()

        let fetched = try context.fetch(FetchDescriptor<Envelope>(sortBy: [SortDescriptor(\.order)]))
        XCTAssertEqual(fetched.count, 3)
        XCTAssertEqual(fetched[0].name, "Courses")
        XCTAssertEqual(fetched[1].name, "Essence")
        XCTAssertEqual(fetched[2].name, "Loisirs")
    }

    func test_offlineOnboarding_envelopeBudgetsAreCorrect() throws {
        let envelope = Envelope(name: "Courses", icon: "cart", color: "blue", budget: 350, order: 0)
        context.insert(envelope)
        try context.save()

        let fetched = try context.fetch(FetchDescriptor<Envelope>())
        XCTAssertEqual(fetched[0].budget, 350, accuracy: 0.001)
    }

    func test_offlineOnboarding_isOnlineModeIsFalse() throws {
        let settings = UserSettings()
        settings.isOnlineMode = false
        settings.firebaseUserId = ""
        context.insert(settings)
        try context.save()

        let fetched = try context.fetch(FetchDescriptor<UserSettings>())
        XCTAssertFalse(fetched[0].isOnlineMode)
        XCTAssertTrue(fetched[0].firebaseUserId.isEmpty)
    }

    func test_offlineOnboarding_totalBudgetMatchesSum() throws {
        let envelopes = [
            Envelope(name: "Courses", icon: "cart", color: "blue", budget: 300, order: 0),
            Envelope(name: "Loisirs", icon: "gamecontroller", color: "green", budget: 100, order: 1),
            Envelope(name: "Restaurant", icon: "fork.knife", color: "orange", budget: 200, order: 2)
        ]
        for env in envelopes { context.insert(env) }
        try context.save()

        let fetched = try context.fetch(FetchDescriptor<Envelope>())
        let totalBudget = fetched.reduce(0.0) { $0 + $1.budget }
        XCTAssertEqual(totalBudget, 600, accuracy: 0.001)
    }
}

// MARK: - Offline Budget Calculation Tests (SwiftData + BudgetCalculator)

@MainActor
final class OfflineBudgetCalculationTests: XCTestCase {

    var container: ModelContainer!
    var context: ModelContext!

    override func setUp() async throws {
        try await super.setUp()
        container = try makeOfflineContainer()
        context = container.mainContext
    }

    override func tearDown() async throws {
        context = nil
        container = nil
        try await super.tearDown()
    }

    private func makeDate(year: Int, month: Int, day: Int) -> Date {
        var comps = DateComponents()
        comps.year = year
        comps.month = month
        comps.day = day
        comps.hour = 12
        return Calendar.current.date(from: comps) ?? Date()
    }

    func test_offlineCalculation_monthlySpentFromRealSwiftData() throws {
        let envelope = Envelope(name: "Courses", icon: "cart", color: "blue", budget: 300, order: 0)
        context.insert(envelope)

        let t1 = Transaction(amount: 50.0, note: "Bio", date: makeDate(year: 2026, month: 3, day: 5))
        let t2 = Transaction(amount: 30.0, note: "Lidl", date: makeDate(year: 2026, month: 3, day: 15))
        t1.envelope = envelope
        t2.envelope = envelope
        context.insert(t1)
        context.insert(t2)
        try context.save()

        let fetched = try context.fetch(FetchDescriptor<Envelope>())
        guard let env = fetched.first else { XCTFail(); return }

        var cal = Calendar.current
        cal.timeZone = TimeZone(identifier: "UTC")!
        let start = cal.date(from: DateComponents(year: 2026, month: 3, day: 1))!
        let end = cal.date(from: DateComponents(year: 2026, month: 3, day: 31, hour: 23, minute: 59, second: 59))!

        let spent = monthlySpent(for: env, in: (start: start, end: end))
        XCTAssertEqual(spent, 80.0, accuracy: 0.001)
    }

    func test_offlineCalculation_budgetCalculatorWithRealSwiftDataAmounts() throws {
        let settings = UserSettings()
        settings.monthlyIncome = 3000
        settings.fixedCosts = 800
        settings.monthlySavings = 300
        context.insert(settings)

        let envelope = Envelope(name: "Loisirs", icon: "gamecontroller", color: "green", budget: 200, order: 0)
        context.insert(envelope)
        let t = Transaction(amount: 75.0, note: "Cinema", date: makeDate(year: 2026, month: 3, day: 10))
        t.envelope = envelope
        context.insert(t)
        try context.save()

        let fetchedSettings = try context.fetch(FetchDescriptor<UserSettings>()).first!
        let calc = BudgetCalculator(
            monthlyIncome: fetchedSettings.monthlyIncome,
            fixedCosts: fetchedSettings.fixedCosts,
            monthlySavings: fetchedSettings.monthlySavings
        )
        XCTAssertEqual(calc.availablePlanned, 1900, accuracy: 0.001)
        XCTAssertEqual(calc.currentMonthBalance(totalSpent: 75.0), 1825, accuracy: 0.001)
    }

    func test_offlineCalculation_globalProgress_notOverspent() throws {
        let calc = BudgetCalculator(monthlyIncome: 3000, fixedCosts: 800, monthlySavings: 300)
        // availablePlanned = 1900
        let progress = calc.globalProgress(totalSpent: 950)
        XCTAssertEqual(progress, 0.5, accuracy: 0.001)
        XCTAssertLessThan(progress, 1.0)
    }

    func test_offlineCalculation_globalProgress_overspent() throws {
        let calc = BudgetCalculator(monthlyIncome: 3000, fixedCosts: 800, monthlySavings: 300)
        // availablePlanned = 1900
        let progress = calc.globalProgress(totalSpent: 2000)
        XCTAssertGreaterThan(progress, 1.0, "globalProgress should exceed 1.0 when overspent")
    }

    func test_offlineCalculation_multipleEnvelopes_spentPerEnvelope() throws {
        let envA = Envelope(name: "Courses", icon: "cart", color: "blue", budget: 300, order: 0)
        let envB = Envelope(name: "Loisirs", icon: "gamecontroller", color: "green", budget: 100, order: 1)
        context.insert(envA)
        context.insert(envB)

        let tA = Transaction(amount: 120.0, note: "Carrefour", date: makeDate(year: 2026, month: 3, day: 5))
        let tB = Transaction(amount: 40.0, note: "Cinema", date: makeDate(year: 2026, month: 3, day: 8))
        tA.envelope = envA
        tB.envelope = envB
        context.insert(tA)
        context.insert(tB)
        try context.save()

        let fetchedA = try context.fetch(FetchDescriptor<Envelope>()).first(where: { $0.name == "Courses" })!
        let fetchedB = try context.fetch(FetchDescriptor<Envelope>()).first(where: { $0.name == "Loisirs" })!

        let calc = BudgetCalculator(monthlyIncome: 3000, fixedCosts: 0, monthlySavings: 0)
        let mar = Calendar.current.date(from: DateComponents(year: 2026, month: 3, day: 1))!
        let end = Calendar.current.date(from: DateComponents(year: 2026, month: 3, day: 31, hour: 23, minute: 59))!

        let result = calc.spentPerEnvelope(
            envelopes: [
                (id: fetchedA.id, transactions: fetchedA.transactions.map { (amount: $0.amount, date: $0.date) }),
                (id: fetchedB.id, transactions: fetchedB.transactions.map { (amount: $0.amount, date: $0.date) })
            ],
            in: (start: mar, end: end)
        )
        XCTAssertEqual(result[fetchedA.id] ?? 0, 120.0, accuracy: 0.001)
        XCTAssertEqual(result[fetchedB.id] ?? 0, 40.0, accuracy: 0.001)
    }
}

// MARK: - Offline Edge Case Tests

@MainActor
final class OfflineEdgeCaseTests: XCTestCase {

    var container: ModelContainer!
    var context: ModelContext!

    override func setUp() async throws {
        try await super.setUp()
        container = try makeOfflineContainer()
        context = container.mainContext
    }

    override func tearDown() async throws {
        context = nil
        container = nil
        try await super.tearDown()
    }

    func test_offline_zeroIncome_availablePlannedIsNegative() {
        let calc = BudgetCalculator(monthlyIncome: 0, fixedCosts: 500, monthlySavings: 200)
        XCTAssertEqual(calc.availablePlanned, -700, accuracy: 0.001)
    }

    func test_offline_deleteEnvelope_deletesAssociatedTransactions() throws {
        let envelope = Envelope(name: "Test", icon: "tray", color: "blue", budget: 100, order: 0)
        context.insert(envelope)
        let t = Transaction(amount: 25.0, note: "Test", date: Date())
        t.envelope = envelope
        context.insert(t)
        try context.save()

        context.delete(envelope)
        try context.save()

        let transactions = try context.fetch(FetchDescriptor<Transaction>())
        XCTAssertEqual(transactions.count, 0, "Deleting envelope should cascade-delete transactions")
    }

    func test_offline_emptyEnvelope_noTransactions_spentIsZero() throws {
        let envelope = Envelope(name: "Empty", icon: "tray", color: "gray", budget: 500, order: 0)
        context.insert(envelope)
        try context.save()

        let fetched = try context.fetch(FetchDescriptor<Envelope>()).first!
        let start = Calendar.current.date(from: DateComponents(year: 2026, month: 3, day: 1))!
        let end = Calendar.current.date(from: DateComponents(year: 2026, month: 3, day: 31))!
        let spent = monthlySpent(for: fetched, in: (start: start, end: end))
        XCTAssertEqual(spent, 0.0, accuracy: 0.001)
    }

    func test_offline_userSettings_defaultCurrency_isEUR() throws {
        let settings = UserSettings()
        context.insert(settings)
        try context.save()

        let fetched = try context.fetch(FetchDescriptor<UserSettings>()).first!
        XCTAssertEqual(fetched.currency, "EUR")
    }

    func test_offline_largeTransactionAmount_handledCorrectly() throws {
        let envelope = Envelope(name: "BigPurchase", icon: "cart", color: "blue", budget: 100_000, order: 0)
        context.insert(envelope)
        let t = Transaction(amount: 99_999.99, note: "Big expense", date: Date())
        t.envelope = envelope
        context.insert(t)
        try context.save()

        let fetched = try context.fetch(FetchDescriptor<Transaction>()).first!
        XCTAssertEqual(fetched.amount, 99_999.99, accuracy: 0.01)
    }
}

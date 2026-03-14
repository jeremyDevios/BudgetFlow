import XCTest
import SwiftData
@testable import BudgetFlow

// MARK: - Shared Helper

private func makeInMemoryContainer() throws -> ModelContainer {
    try ModelContainer(
        for: Envelope.self, Transaction.self, UserSettings.self,
        configurations: ModelConfiguration(isStoredInMemoryOnly: true)
    )
}

private func makeDate(year: Int, month: Int, day: Int) -> Date {
    var comps = DateComponents()
    comps.year = year; comps.month = month; comps.day = day
    return Calendar.current.date(from: comps)!
}

// MARK: - Envelope CRUD Tests

@MainActor
final class EnvelopeCRUDTests: XCTestCase {

    var container: ModelContainer!
    var context: ModelContext!

    override func setUp() async throws {
        container = try makeInMemoryContainer()
        context = ModelContext(container)
    }

    override func tearDown() async throws {
        context = nil
        container = nil
    }

    func test_createEnvelope_persistsAllFields() throws {
        let envelope = Envelope(name: "Courses", icon: "cart", color: "bg-green-500", budget: 300, order: 0)
        context.insert(envelope)
        try context.save()

        let fetched = try context.fetch(FetchDescriptor<Envelope>())
        XCTAssertEqual(fetched.count, 1)
        XCTAssertEqual(fetched[0].name, "Courses")
        XCTAssertEqual(fetched[0].icon, "cart")
        XCTAssertEqual(fetched[0].color, "bg-green-500")
        XCTAssertEqual(fetched[0].budget, 300, accuracy: 0.001)
        XCTAssertEqual(fetched[0].order, 0)
        XCTAssertEqual(fetched[0].spent, 0, accuracy: 0.001)
    }

    func test_updateEnvelope_name() throws {
        let envelope = Envelope(name: "Loisirs", icon: "gamecontroller", color: "bg-blue-500", budget: 200, order: 1)
        context.insert(envelope)
        try context.save()

        envelope.name = "Entertainment"
        try context.save()

        let fetched = try context.fetch(FetchDescriptor<Envelope>())
        XCTAssertEqual(fetched[0].name, "Entertainment")
    }

    func test_updateEnvelope_budget() throws {
        let envelope = Envelope(name: "Essence", icon: "fuelpump", color: "bg-orange-500", budget: 150, order: 2)
        context.insert(envelope)
        try context.save()

        envelope.budget = 200
        try context.save()

        let fetched = try context.fetch(FetchDescriptor<Envelope>())
        XCTAssertEqual(fetched[0].budget, 200, accuracy: 0.001)
    }

    func test_deleteEnvelope_removesFromContext() throws {
        let envelope = Envelope(name: "Test", icon: "tray", color: "bg-red-500", budget: 100, order: 0)
        context.insert(envelope)
        try context.save()

        context.delete(envelope)
        try context.save()

        let fetched = try context.fetch(FetchDescriptor<Envelope>())
        XCTAssertEqual(fetched.count, 0)
    }

    func test_multipleEnvelopes_sortedByOrder() throws {
        let e1 = Envelope(name: "C", icon: "tray", color: "blue", budget: 100, order: 2)
        let e2 = Envelope(name: "A", icon: "tray", color: "blue", budget: 100, order: 0)
        let e3 = Envelope(name: "B", icon: "tray", color: "blue", budget: 100, order: 1)
        context.insert(e1); context.insert(e2); context.insert(e3)
        try context.save()

        let descriptor = FetchDescriptor<Envelope>(sortBy: [SortDescriptor(\.order)])
        let fetched = try context.fetch(descriptor)
        XCTAssertEqual(fetched.map(\.name), ["A", "B", "C"])
    }

    func test_updateEnvelope_order() throws {
        let envelope = Envelope(name: "Test", icon: "tray", color: "blue", budget: 50, order: 3)
        context.insert(envelope)
        try context.save()

        envelope.order = 0
        try context.save()

        let fetched = try context.fetch(FetchDescriptor<Envelope>())
        XCTAssertEqual(fetched[0].order, 0)
    }

    func test_envelope_firestoreId_isPersisted() throws {
        let envelope = Envelope(name: "Cloud", icon: "icloud", color: "blue", budget: 100, order: 0, firestoreId: "abc123")
        context.insert(envelope)
        try context.save()

        let fetched = try context.fetch(FetchDescriptor<Envelope>())
        XCTAssertEqual(fetched[0].firestoreId, "abc123")
    }
}

// MARK: - Transaction CRUD Tests

@MainActor
final class TransactionCRUDTests: XCTestCase {

    var container: ModelContainer!
    var context: ModelContext!

    override func setUp() async throws {
        container = try makeInMemoryContainer()
        context = ModelContext(container)
    }

    override func tearDown() async throws {
        context = nil
        container = nil
    }

    func test_createTransaction_persistsAllFields() throws {
        let date = makeDate(year: 2026, month: 3, day: 10)
        let tx = Transaction(amount: 45.50, note: "Supermarché", date: date)
        context.insert(tx)
        try context.save()

        let fetched = try context.fetch(FetchDescriptor<Transaction>())
        XCTAssertEqual(fetched.count, 1)
        XCTAssertEqual(fetched[0].amount, 45.50, accuracy: 0.001)
        XCTAssertEqual(fetched[0].note, "Supermarché")
    }

    func test_updateTransaction_amount() throws {
        let tx = Transaction(amount: 20.0, note: "Café", date: Date())
        context.insert(tx)
        try context.save()

        tx.amount = 35.0
        try context.save()

        let fetched = try context.fetch(FetchDescriptor<Transaction>())
        XCTAssertEqual(fetched[0].amount, 35.0, accuracy: 0.001)
    }

    func test_updateTransaction_note() throws {
        let tx = Transaction(amount: 10.0, note: "Old note", date: Date())
        context.insert(tx)
        try context.save()

        tx.note = "New note"
        try context.save()

        let fetched = try context.fetch(FetchDescriptor<Transaction>())
        XCTAssertEqual(fetched[0].note, "New note")
    }

    func test_deleteTransaction_removesFromContext() throws {
        let tx = Transaction(amount: 55.0, note: "Delete me", date: Date())
        context.insert(tx)
        try context.save()

        context.delete(tx)
        try context.save()

        let fetched = try context.fetch(FetchDescriptor<Transaction>())
        XCTAssertEqual(fetched.count, 0)
    }

    func test_transaction_linkedToEnvelope() throws {
        let envelope = Envelope(name: "Loisirs", icon: "gamecontroller", color: "blue", budget: 200, order: 0)
        context.insert(envelope)
        try context.save()

        let tx = Transaction(amount: 25.0, note: "Cinema", date: Date(), envelope: envelope)
        context.insert(tx)
        try context.save()

        let fetchedTx = try context.fetch(FetchDescriptor<Transaction>())
        XCTAssertNotNil(fetchedTx[0].envelope)
        XCTAssertEqual(fetchedTx[0].envelope?.name, "Loisirs")
    }

    func test_transaction_emptyNote_persists() throws {
        let tx = Transaction(amount: 5.0, note: "", date: Date())
        context.insert(tx)
        try context.save()

        let fetched = try context.fetch(FetchDescriptor<Transaction>())
        XCTAssertEqual(fetched[0].note, "")
    }
}

// MARK: - Cascade Delete Tests

@MainActor
final class CascadeDeleteTests: XCTestCase {

    var container: ModelContainer!
    var context: ModelContext!

    override func setUp() async throws {
        container = try makeInMemoryContainer()
        context = ModelContext(container)
    }

    override func tearDown() async throws {
        context = nil
        container = nil
    }

    func test_deleteEnvelope_cascadesTransactions() throws {
        let envelope = Envelope(name: "Courses", icon: "cart", color: "green", budget: 300, order: 0)
        context.insert(envelope)

        let tx1 = Transaction(amount: 20.0, note: "Pain", date: Date(), envelope: envelope)
        let tx2 = Transaction(amount: 15.0, note: "Lait", date: Date(), envelope: envelope)
        let tx3 = Transaction(amount: 8.0, note: "Fromage", date: Date(), envelope: envelope)
        context.insert(tx1); context.insert(tx2); context.insert(tx3)
        try context.save()

        // Verify setup
        let txBefore = try context.fetch(FetchDescriptor<Transaction>())
        XCTAssertEqual(txBefore.count, 3)

        // Delete envelope — cascade should delete its transactions
        context.delete(envelope)
        try context.save()

        let envelopesAfter = try context.fetch(FetchDescriptor<Envelope>())
        XCTAssertEqual(envelopesAfter.count, 0)

        let txAfter = try context.fetch(FetchDescriptor<Transaction>())
        XCTAssertEqual(txAfter.count, 0, "Cascade delete should remove all linked transactions")
    }

    func test_deleteEnvelope_doesNotAffectOtherEnvelopeTransactions() throws {
        let envA = Envelope(name: "Courses", icon: "cart", color: "green", budget: 300, order: 0)
        let envB = Envelope(name: "Loisirs", icon: "gamecontroller", color: "blue", budget: 200, order: 1)
        context.insert(envA); context.insert(envB)

        let txA = Transaction(amount: 50.0, note: "A-tx", date: Date(), envelope: envA)
        let txB = Transaction(amount: 30.0, note: "B-tx", date: Date(), envelope: envB)
        context.insert(txA); context.insert(txB)
        try context.save()

        context.delete(envA)
        try context.save()

        let remainingTx = try context.fetch(FetchDescriptor<Transaction>())
        XCTAssertEqual(remainingTx.count, 1)
        XCTAssertEqual(remainingTx[0].note, "B-tx")
    }

    func test_deleteTransaction_doesNotDeleteParentEnvelope() throws {
        let envelope = Envelope(name: "Essence", icon: "fuelpump", color: "orange", budget: 150, order: 0)
        context.insert(envelope)
        let tx = Transaction(amount: 60.0, note: "Plein", date: Date(), envelope: envelope)
        context.insert(tx)
        try context.save()

        context.delete(tx)
        try context.save()

        let envelopes = try context.fetch(FetchDescriptor<Envelope>())
        XCTAssertEqual(envelopes.count, 1, "Deleting transaction should not delete parent envelope")
    }
}

// MARK: - UserSettings CRUD Tests

@MainActor
final class UserSettingsCRUDTests: XCTestCase {

    var container: ModelContainer!
    var context: ModelContext!

    override func setUp() async throws {
        container = try makeInMemoryContainer()
        context = ModelContext(container)
    }

    override func tearDown() async throws {
        context = nil
        container = nil
    }

    func test_createUserSettings_persistsDefaults() throws {
        let settings = UserSettings()
        context.insert(settings)
        try context.save()

        let fetched = try context.fetch(FetchDescriptor<UserSettings>())
        XCTAssertEqual(fetched.count, 1)
        XCTAssertEqual(fetched[0].monthlyIncome, 0, accuracy: 0.001)
        XCTAssertEqual(fetched[0].currency, "EUR")
        XCTAssertFalse(fetched[0].isOnboarded)
        XCTAssertFalse(fetched[0].isOnlineMode)
    }

    func test_updateUserSettings_income() throws {
        let settings = UserSettings(monthlyIncome: 2500)
        context.insert(settings)
        try context.save()

        settings.monthlyIncome = 3200
        try context.save()

        let fetched = try context.fetch(FetchDescriptor<UserSettings>())
        XCTAssertEqual(fetched[0].monthlyIncome, 3200, accuracy: 0.001)
    }

    func test_updateUserSettings_onboardedFlag() throws {
        let settings = UserSettings()
        context.insert(settings)
        try context.save()

        settings.isOnboarded = true
        try context.save()

        let fetched = try context.fetch(FetchDescriptor<UserSettings>())
        XCTAssertTrue(fetched[0].isOnboarded)
    }

    func test_updateUserSettings_onlineMode_withUserId() throws {
        let settings = UserSettings()
        context.insert(settings)
        try context.save()

        settings.isOnlineMode = true
        settings.firebaseUserId = "uid_abc123"
        try context.save()

        let fetched = try context.fetch(FetchDescriptor<UserSettings>())
        XCTAssertTrue(fetched[0].isOnlineMode)
        XCTAssertEqual(fetched[0].firebaseUserId, "uid_abc123")
    }
}

// MARK: - SwiftData Edge Case Tests

@MainActor
final class SwiftDataEdgeCaseTests: XCTestCase {

    var container: ModelContainer!
    var context: ModelContext!

    override func setUp() async throws {
        container = try makeInMemoryContainer()
        context = ModelContext(container)
    }

    override func tearDown() async throws {
        context = nil
        container = nil
    }

    func test_envelope_zeroBudget_persists() throws {
        let envelope = Envelope(name: "Zéro", icon: "tray", color: "gray", budget: 0, order: 0)
        context.insert(envelope)
        try context.save()

        let fetched = try context.fetch(FetchDescriptor<Envelope>())
        XCTAssertEqual(fetched[0].budget, 0, accuracy: 0.001)
        XCTAssertEqual(fetched[0].spent, 0, accuracy: 0.001)
    }

    func test_envelope_emptyName_persists() throws {
        let envelope = Envelope(name: "", icon: "tray", color: "gray", budget: 100, order: 0)
        context.insert(envelope)
        XCTAssertNoThrow(try context.save())
    }

    func test_transaction_veryLargeAmount_persists() throws {
        let tx = Transaction(amount: 1_000_000_000.0, note: "Large", date: Date())
        context.insert(tx)
        try context.save()

        let fetched = try context.fetch(FetchDescriptor<Transaction>())
        XCTAssertEqual(fetched[0].amount, 1_000_000_000.0, accuracy: 1.0)
    }

    func test_multipleUserSettings_canCoexist() throws {
        let s1 = UserSettings(monthlyIncome: 2000)
        let s2 = UserSettings(monthlyIncome: 3000)
        context.insert(s1); context.insert(s2)
        try context.save()

        // SwiftData has no uniqueness constraint by default
        let fetched = try context.fetch(FetchDescriptor<UserSettings>())
        XCTAssertEqual(fetched.count, 2)
    }

    func test_envelope_uuidsAreUnique() throws {
        let e1 = Envelope(name: "A", icon: "tray", color: "blue", budget: 100, order: 0)
        let e2 = Envelope(name: "B", icon: "tray", color: "blue", budget: 100, order: 1)
        XCTAssertNotEqual(e1.id, e2.id)
    }
}

// MARK: - SwiftData Monthly Spent Tests (integration with Extensions.swift)

@MainActor
final class SwiftDataMonthlySpentTests: XCTestCase {

    var container: ModelContainer!
    var context: ModelContext!

    override func setUp() async throws {
        container = try makeInMemoryContainer()
        context = ModelContext(container)
    }

    override func tearDown() async throws {
        context = nil
        container = nil
    }

    func test_monthlySpent_withRealSwiftDataObjects() throws {
        let calendar = Calendar.current
        let envelope = Envelope(name: "Courses", icon: "cart", color: "green", budget: 300, order: 0)
        context.insert(envelope)

        let marchStart = calendar.startOfMonth(for: makeDate(year: 2026, month: 3, day: 1))
        let tx1 = Transaction(amount: 45.0, note: "Supermarché", date: makeDate(year: 2026, month: 3, day: 5), envelope: envelope)
        let tx2 = Transaction(amount: 30.0, note: "Boulangerie", date: makeDate(year: 2026, month: 3, day: 20), envelope: envelope)
        context.insert(tx1); context.insert(tx2)
        try context.save()

        let range = (start: calendar.startOfMonth(for: marchStart),
                     end: calendar.endOfMonth(for: marchStart))

        let fetched = try context.fetch(FetchDescriptor<Envelope>())
        let total = monthlySpent(for: fetched[0], in: range)
        XCTAssertEqual(total, 75.0, accuracy: 0.001)
    }

    func test_monthlySpent_excludesOtherMonths() throws {
        let calendar = Calendar.current
        let envelope = Envelope(name: "Loisirs", icon: "gamecontroller", color: "blue", budget: 200, order: 0)
        context.insert(envelope)

        let tx1 = Transaction(amount: 100.0, note: "Février", date: makeDate(year: 2026, month: 2, day: 15), envelope: envelope)
        let tx2 = Transaction(amount: 50.0, note: "Mars", date: makeDate(year: 2026, month: 3, day: 10), envelope: envelope)
        let tx3 = Transaction(amount: 80.0, note: "Avril", date: makeDate(year: 2026, month: 4, day: 5), envelope: envelope)
        context.insert(tx1); context.insert(tx2); context.insert(tx3)
        try context.save()

        let marchRef = makeDate(year: 2026, month: 3, day: 1)
        let range = (start: calendar.startOfMonth(for: marchRef), end: calendar.endOfMonth(for: marchRef))

        let fetched = try context.fetch(FetchDescriptor<Envelope>())
        let total = monthlySpent(for: fetched[0], in: range)
        XCTAssertEqual(total, 50.0, accuracy: 0.001, "Only March transactions should be counted")
    }

    func test_monthlySpent_noTransactions_returnsZero() throws {
        let calendar = Calendar.current
        let envelope = Envelope(name: "Vide", icon: "tray", color: "gray", budget: 100, order: 0)
        context.insert(envelope)
        try context.save()

        let ref = makeDate(year: 2026, month: 3, day: 1)
        let range = (start: calendar.startOfMonth(for: ref), end: calendar.endOfMonth(for: ref))

        let fetched = try context.fetch(FetchDescriptor<Envelope>())
        let total = monthlySpent(for: fetched[0], in: range)
        XCTAssertEqual(total, 0.0, accuracy: 0.001)
    }

    func test_monthlySpent_multipleEnvelopes_areIndependent() throws {
        let calendar = Calendar.current
        let envA = Envelope(name: "A", icon: "tray", color: "blue", budget: 100, order: 0)
        let envB = Envelope(name: "B", icon: "tray", color: "red", budget: 100, order: 1)
        context.insert(envA); context.insert(envB)

        let marchDate = makeDate(year: 2026, month: 3, day: 10)
        context.insert(Transaction(amount: 70.0, note: "A-tx", date: marchDate, envelope: envA))
        context.insert(Transaction(amount: 40.0, note: "B-tx", date: marchDate, envelope: envB))
        try context.save()

        let ref = makeDate(year: 2026, month: 3, day: 1)
        let range = (start: calendar.startOfMonth(for: ref), end: calendar.endOfMonth(for: ref))

        let fetched = try context.fetch(FetchDescriptor<Envelope>(sortBy: [SortDescriptor(\.order)]))
        XCTAssertEqual(monthlySpent(for: fetched[0], in: range), 70.0, accuracy: 0.001)
        XCTAssertEqual(monthlySpent(for: fetched[1], in: range), 40.0, accuracy: 0.001)
    }
}

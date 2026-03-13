import XCTest
import SwiftUI
import SwiftData
@testable import BudgetFlow
import UserNotifications

// MARK: - Extensions Tests

final class ColorHexTests: XCTestCase {

    // MARK: Color(hex:) — 6-digit hex

    func test_colorFromHex_white() {
        let color = Color(hex: "FFFFFF")
        // White: RGB components should all be ~1.0
        let uic = UIColor(color)
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        uic.getRed(&r, green: &g, blue: &b, alpha: &a)
        XCTAssertEqual(r, 1.0, accuracy: 0.02)
        XCTAssertEqual(g, 1.0, accuracy: 0.02)
        XCTAssertEqual(b, 1.0, accuracy: 0.02)
    }

    func test_colorFromHex_black() {
        let color = Color(hex: "000000")
        let uic = UIColor(color)
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        uic.getRed(&r, green: &g, blue: &b, alpha: &a)
        XCTAssertEqual(r, 0.0, accuracy: 0.02)
        XCTAssertEqual(g, 0.0, accuracy: 0.02)
        XCTAssertEqual(b, 0.0, accuracy: 0.02)
    }

    func test_colorFromHex_amber() {
        // F59E0B — amber-500
        let color = Color(hex: "F59E0B")
        let uic = UIColor(color)
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        uic.getRed(&r, green: &g, blue: &b, alpha: &a)
        XCTAssertEqual(r, CGFloat(0xF5) / 255, accuracy: 0.02)
        XCTAssertEqual(g, CGFloat(0x9E) / 255, accuracy: 0.02)
        XCTAssertEqual(b, CGFloat(0x0B) / 255, accuracy: 0.02)
    }

    func test_colorFromHex_3digit() {
        // 3-digit hex: "FFF" should equal "FFFFFF"
        let color3 = Color(hex: "FFF")
        let color6 = Color(hex: "FFFFFF")
        let uic3 = UIColor(color3)
        let uic6 = UIColor(color6)
        var r3: CGFloat = 0, g3: CGFloat = 0, b3: CGFloat = 0, a3: CGFloat = 0
        var r6: CGFloat = 0, g6: CGFloat = 0, b6: CGFloat = 0, a6: CGFloat = 0
        uic3.getRed(&r3, green: &g3, blue: &b3, alpha: &a3)
        uic6.getRed(&r6, green: &g6, blue: &b6, alpha: &a6)
        XCTAssertEqual(r3, r6, accuracy: 0.02)
        XCTAssertEqual(g3, g6, accuracy: 0.02)
        XCTAssertEqual(b3, b6, accuracy: 0.02)
    }

    func test_colorFromHex_withHashPrefix() {
        // Should work even if hex has # prefix (trimmingCharacters handles it)
        let color = Color(hex: "#FF0000")
        let uic = UIColor(color)
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        uic.getRed(&r, green: &g, blue: &b, alpha: &a)
        XCTAssertEqual(r, 1.0, accuracy: 0.02)
        XCTAssertEqual(g, 0.0, accuracy: 0.02)
        XCTAssertEqual(b, 0.0, accuracy: 0.02)
    }

    func test_toHex_white() {
        let color = Color(hex: "FFFFFF")
        let hex = color.toHex()
        XCTAssertNotNil(hex)
        XCTAssertEqual(hex?.uppercased(), "FFFFFF")
    }

    func test_toHex_black() {
        let color = Color(hex: "000000")
        let hex = color.toHex()
        XCTAssertNotNil(hex)
        XCTAssertEqual(hex?.uppercased(), "000000")
    }

    func test_toHex_roundtrip() {
        let original = "F59E0B"
        let color = Color(hex: original)
        let result = color.toHex()
        XCTAssertNotNil(result)
        XCTAssertEqual(result?.uppercased(), original.uppercased())
    }

    func test_fromString_tailwindToken_usesTailwindMapping() {
        let mapped = Color.fromString("bg-amber-500")
        let expected = Color(hex: "F59E0B")

        let mappedUIC = UIColor(mapped)
        let expectedUIC = UIColor(expected)
        var mr: CGFloat = 0, mg: CGFloat = 0, mb: CGFloat = 0, ma: CGFloat = 0
        var er: CGFloat = 0, eg: CGFloat = 0, eb: CGFloat = 0, ea: CGFloat = 0
        mappedUIC.getRed(&mr, green: &mg, blue: &mb, alpha: &ma)
        expectedUIC.getRed(&er, green: &eg, blue: &eb, alpha: &ea)

        XCTAssertEqual(mr, er, accuracy: 0.02)
        XCTAssertEqual(mg, eg, accuracy: 0.02)
        XCTAssertEqual(mb, eb, accuracy: 0.02)
    }

    func test_fromString_unknownFallsBackToHex() {
        let color = Color.fromString("00FF00")
        let uic = UIColor(color)
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        uic.getRed(&r, green: &g, blue: &b, alpha: &a)
        XCTAssertEqual(r, 0.0, accuracy: 0.02)
        XCTAssertEqual(g, 1.0, accuracy: 0.02)
        XCTAssertEqual(b, 0.0, accuracy: 0.02)
    }
}

// MARK: - Calendar Month Extension Tests

final class CalendarMonthTests: XCTestCase {

    let calendar = Calendar.current

    func test_startOfMonth_firstDay() {
        // Date: 2026-03-13 → start should be 2026-03-01
        var comps = DateComponents()
        comps.year = 2026; comps.month = 3; comps.day = 13
        let date = calendar.date(from: comps)!
        let start = calendar.startOfMonth(for: date)
        let startComps = calendar.dateComponents([.year, .month, .day], from: start)
        XCTAssertEqual(startComps.year, 2026)
        XCTAssertEqual(startComps.month, 3)
        XCTAssertEqual(startComps.day, 1)
    }

    func test_startOfMonth_alreadyFirst() {
        var comps = DateComponents()
        comps.year = 2026; comps.month = 1; comps.day = 1
        let date = calendar.date(from: comps)!
        let start = calendar.startOfMonth(for: date)
        let startComps = calendar.dateComponents([.year, .month, .day], from: start)
        XCTAssertEqual(startComps.day, 1)
        XCTAssertEqual(startComps.month, 1)
    }

    func test_startOfMonth_endOfMonth() {
        var comps = DateComponents()
        comps.year = 2026; comps.month = 3; comps.day = 31
        let date = calendar.date(from: comps)!
        let start = calendar.startOfMonth(for: date)
        let startComps = calendar.dateComponents([.year, .month, .day], from: start)
        XCTAssertEqual(startComps.day, 1)
        XCTAssertEqual(startComps.month, 3)
    }

    func test_endOfMonth_march() {
        var comps = DateComponents()
        comps.year = 2026; comps.month = 3; comps.day = 13
        let date = calendar.date(from: comps)!
        let end = calendar.endOfMonth(for: date)
        let endComps = calendar.dateComponents([.year, .month, .day], from: end)
        XCTAssertEqual(endComps.month, 3)
        XCTAssertEqual(endComps.day, 31)
    }

    func test_endOfMonth_february_nonLeap() {
        var comps = DateComponents()
        comps.year = 2026; comps.month = 2; comps.day = 1
        let date = calendar.date(from: comps)!
        let end = calendar.endOfMonth(for: date)
        let endComps = calendar.dateComponents([.year, .month, .day], from: end)
        XCTAssertEqual(endComps.month, 2)
        XCTAssertEqual(endComps.day, 28)
    }

    func test_endOfMonth_february_leapYear() {
        var comps = DateComponents()
        comps.year = 2024; comps.month = 2; comps.day = 1
        let date = calendar.date(from: comps)!
        let end = calendar.endOfMonth(for: date)
        let endComps = calendar.dateComponents([.year, .month, .day], from: end)
        XCTAssertEqual(endComps.month, 2)
        XCTAssertEqual(endComps.day, 29)
    }

    func test_endOfMonth_december() {
        var comps = DateComponents()
        comps.year = 2026; comps.month = 12; comps.day = 1
        let date = calendar.date(from: comps)!
        let end = calendar.endOfMonth(for: date)
        let endComps = calendar.dateComponents([.year, .month, .day], from: end)
        XCTAssertEqual(endComps.month, 12)
        XCTAssertEqual(endComps.day, 31)
    }

    func test_startBeforeEnd() {
        var comps = DateComponents()
        comps.year = 2026; comps.month = 5; comps.day = 15
        let date = calendar.date(from: comps)!
        let start = calendar.startOfMonth(for: date)
        let end = calendar.endOfMonth(for: date)
        XCTAssertLessThan(start, end)
    }
}

// MARK: - monthlySpent Tests

final class MonthlySpentTests: XCTestCase {

    let calendar = Calendar.current

    private func makeDate(year: Int, month: Int, day: Int) -> Date {
        var comps = DateComponents()
        comps.year = year; comps.month = month; comps.day = day
        return Calendar.current.date(from: comps)!
    }

    private func makeEnvelope(transactions: [(amount: Double, date: Date)]) -> Envelope {
        let env = Envelope(name: "Test", icon: "cart", color: "bg-amber-500", budget: 500, order: 0)
        for tx in transactions {
            let t = Transaction(amount: tx.amount, note: "", date: tx.date, envelope: env)
            env.transactions.append(t)
        }
        return env
    }

    func test_monthlySpent_singleTransactionInRange() {
        let march13 = makeDate(year: 2026, month: 3, day: 13)
        let env = makeEnvelope(transactions: [(amount: 42.0, date: march13)])
        let range = (
            start: calendar.startOfMonth(for: march13),
            end: calendar.endOfMonth(for: march13)
        )
        XCTAssertEqual(monthlySpent(for: env, in: range), 42.0, accuracy: 0.01)
    }

    func test_monthlySpent_multipleTransactionsInRange() {
        let march1 = makeDate(year: 2026, month: 3, day: 1)
        let march31 = makeDate(year: 2026, month: 3, day: 31)
        let env = makeEnvelope(transactions: [
            (amount: 10.0, date: march1),
            (amount: 20.0, date: march31)
        ])
        let range = (
            start: calendar.startOfMonth(for: march1),
            end: calendar.endOfMonth(for: march1)
        )
        XCTAssertEqual(monthlySpent(for: env, in: range), 30.0, accuracy: 0.01)
    }

    func test_monthlySpent_noTransactions() {
        let march13 = makeDate(year: 2026, month: 3, day: 13)
        let env = makeEnvelope(transactions: [])
        let range = (
            start: calendar.startOfMonth(for: march13),
            end: calendar.endOfMonth(for: march13)
        )
        XCTAssertEqual(monthlySpent(for: env, in: range), 0.0, accuracy: 0.01)
    }

    func test_monthlySpent_transactionOutsideRange() {
        let march13 = makeDate(year: 2026, month: 3, day: 13)
        let feb15 = makeDate(year: 2026, month: 2, day: 15)
        let env = makeEnvelope(transactions: [(amount: 99.0, date: feb15)])
        let range = (
            start: calendar.startOfMonth(for: march13),
            end: calendar.endOfMonth(for: march13)
        )
        XCTAssertEqual(monthlySpent(for: env, in: range), 0.0, accuracy: 0.01)
    }

    func test_monthlySpent_transactionOnBoundaryStart() {
        var comps = DateComponents()
        comps.year = 2026; comps.month = 3; comps.day = 1
        let march1 = Calendar.current.date(from: comps)!
        let startOfMarch = Calendar.current.startOfMonth(for: march1)
        let env = makeEnvelope(transactions: [(amount: 5.0, date: startOfMarch)])
        let range = (start: startOfMarch, end: Calendar.current.endOfMonth(for: march1))
        XCTAssertEqual(monthlySpent(for: env, in: range), 5.0, accuracy: 0.01)
    }
}

// MARK: - Envelope Model Tests

final class EnvelopeModelTests: XCTestCase {

    func test_envelope_init_defaultValues() {
        let env = Envelope(name: "Courses", icon: "cart", color: "bg-green-500", budget: 300, order: 0)
        XCTAssertEqual(env.name, "Courses")
        XCTAssertEqual(env.icon, "cart")
        XCTAssertEqual(env.color, "bg-green-500")
        XCTAssertEqual(env.budget, 300)
        XCTAssertEqual(env.order, 0)
        XCTAssertEqual(env.spent, 0.0)
        XCTAssertEqual(env.firestoreId, "")
        XCTAssertTrue(env.transactions.isEmpty)
    }

    func test_envelope_init_customSpent() {
        let env = Envelope(name: "Loisirs", icon: "heart", color: "bg-pink-500", budget: 150, order: 1, spent: 45.0)
        XCTAssertEqual(env.spent, 45.0)
    }

    func test_envelope_init_customFirestoreId() {
        let env = Envelope(name: "Essence", icon: "fuel", color: "bg-orange-500", budget: 100, order: 2, firestoreId: "abc123")
        XCTAssertEqual(env.firestoreId, "abc123")
    }

    func test_envelope_uniqueIds() {
        let env1 = Envelope(name: "A", icon: "cart", color: "bg-blue-500", budget: 100, order: 0)
        let env2 = Envelope(name: "B", icon: "cart", color: "bg-blue-500", budget: 100, order: 1)
        XCTAssertNotEqual(env1.id, env2.id)
    }

    func test_envelope_budgetRemaining() {
        let env = Envelope(name: "Test", icon: "cart", color: "bg-blue-500", budget: 200, order: 0, spent: 50)
        let remaining = env.budget - env.spent
        XCTAssertEqual(remaining, 150.0, accuracy: 0.01)
    }
}

// MARK: - Transaction Model Tests

final class TransactionModelTests: XCTestCase {

    func test_transaction_init_basicFields() {
        let date = Date()
        let tx = Transaction(amount: 42.5, note: "Burger", date: date)
        XCTAssertEqual(tx.amount, 42.5)
        XCTAssertEqual(tx.note, "Burger")
        XCTAssertEqual(tx.date, date)
        XCTAssertEqual(tx.firestoreId, "")
        XCTAssertNil(tx.envelope)
    }

    func test_transaction_init_withEnvelope() {
        let env = Envelope(name: "Food", icon: "utensils", color: "bg-red-500", budget: 300, order: 0, firestoreId: "envId1")
        let tx = Transaction(amount: 15.0, note: "Pizza", date: Date(), envelope: env)
        XCTAssertEqual(tx.envelopeId, "envId1")
        XCTAssertEqual(tx.envelope?.name, "Food")
    }

    func test_transaction_init_emptyNote() {
        let tx = Transaction(amount: 10.0, note: "", date: Date())
        XCTAssertEqual(tx.note, "")
    }

    func test_transaction_uniqueIds() {
        let tx1 = Transaction(amount: 1.0, note: "", date: Date())
        let tx2 = Transaction(amount: 2.0, note: "", date: Date())
        XCTAssertNotEqual(tx1.id, tx2.id)
    }

    func test_transaction_init_withFirestoreId() {
        let tx = Transaction(amount: 5.0, note: "Test", date: Date(), firestoreId: "txFirestoreId")
        XCTAssertEqual(tx.firestoreId, "txFirestoreId")
    }
}

// MARK: - UserSettings Model Tests

final class UserSettingsModelTests: XCTestCase {

    func test_userSettings_defaultInit() {
        let s = UserSettings()
        XCTAssertEqual(s.monthlyIncome, 0)
        XCTAssertEqual(s.fixedCosts, 0)
        XCTAssertEqual(s.monthlySavings, 0)
        XCTAssertEqual(s.currency, "EUR")
        XCTAssertFalse(s.isOnboarded)
        XCTAssertFalse(s.isOnlineMode)
        XCTAssertEqual(s.firebaseUserId, "")
    }

    func test_userSettings_customInit() {
        let s = UserSettings(monthlyIncome: 3000, fixedCosts: 1200, monthlySavings: 300)
        XCTAssertEqual(s.monthlyIncome, 3000)
        XCTAssertEqual(s.fixedCosts, 1200)
        XCTAssertEqual(s.monthlySavings, 300)
    }

    func test_userSettings_availableBudget() {
        let s = UserSettings(monthlyIncome: 3000, fixedCosts: 1200, monthlySavings: 300)
        let available = s.monthlyIncome - s.fixedCosts - s.monthlySavings
        XCTAssertEqual(available, 1500, accuracy: 0.01)
    }

    func test_userSettings_onlineMode() {
        let s = UserSettings(isOnlineMode: true, firebaseUserId: "uid123")
        XCTAssertTrue(s.isOnlineMode)
        XCTAssertEqual(s.firebaseUserId, "uid123")
    }

    func test_userSettings_currency_defaultEUR() {
        let s = UserSettings()
        XCTAssertEqual(s.currency, "EUR")
    }
}

// MARK: - NotificationService Tests

final class NotificationServiceTests: XCTestCase {

    func test_shared_singleton() {
        let s1 = NotificationService.shared
        let s2 = NotificationService.shared
        XCTAssertTrue(s1 === s2)
    }

    func test_scheduleWeeklyNotifications_emptyDays_doesNotCrash() {
        // Empty days should call cancelAllNotifications and not schedule anything
        XCTAssertNoThrow(
            NotificationService.shared.scheduleWeeklyNotifications(
                days: [],
                hour: 19,
                minute: 0,
                todayExpenses: 0,
                todayCount: 0
            )
        )
    }

    func test_cancelAllNotifications_doesNotCrash() {
        XCTAssertNoThrow(NotificationService.shared.cancelAllNotifications())
    }

    func test_scheduleWeeklyNotifications_validDays_doesNotCrash() {
        XCTAssertNoThrow(
            NotificationService.shared.scheduleWeeklyNotifications(
                days: [2, 4, 6],
                hour: 20,
                minute: 30,
                todayExpenses: 42.5,
                todayCount: 3,
                currency: "EUR"
            )
        )
    }

    func test_scheduleAndCancel_doesNotCrash() {
        NotificationService.shared.scheduleWeeklyNotifications(
            days: [2, 3, 4, 5, 6],
            hour: 19,
            minute: 0,
            todayExpenses: 100,
            todayCount: 2
        )
        XCTAssertNoThrow(NotificationService.shared.cancelAllNotifications())
    }

    func test_requestPermission_isAsync() async {
        // This test verifies requestPermission returns a Bool without crashing.
        // In test environment, system will deny without user prompt.
        let result = await NotificationService.shared.requestPermission()
        XCTAssertTrue(result == true || result == false) // any Bool is valid
    }

    func test_currentAuthorizationStatus_returnsStatus() async {
        let status = await NotificationService.shared.currentAuthorizationStatus()
        // Any UNAuthorizationStatus is valid
        let validStatuses: [UNAuthorizationStatus] = [.notDetermined, .denied, .authorized, .provisional, .ephemeral]
        XCTAssertTrue(validStatuses.contains(status))
    }
}

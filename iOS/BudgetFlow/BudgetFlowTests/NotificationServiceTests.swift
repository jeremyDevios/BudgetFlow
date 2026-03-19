import XCTest
import UserNotifications
@testable import BudgetFlow

// MARK: - NotificationService Tests

final class NotificationServiceInstanceTests: XCTestCase {

    var sut: NotificationService!

    override func setUp() {
        super.setUp()
        sut = NotificationService()
    }

    override func tearDown() async throws {
        sut.cancelAllNotifications()
        sut = nil
        try await super.tearDown()
    }

    // MARK: - identifier(for:)

    func test_identifier_monday_hasCorrectFormat() {
        XCTAssertEqual(sut.identifier(for: 2), "budgetflow-weekly-2")
    }

    func test_identifier_sunday_hasCorrectFormat() {
        XCTAssertEqual(sut.identifier(for: 1), "budgetflow-weekly-1")
    }

    func test_identifier_saturday_hasCorrectFormat() {
        XCTAssertEqual(sut.identifier(for: 7), "budgetflow-weekly-7")
    }

    func test_identifier_allWeekdays_areUnique() {
        let ids = (1...7).map { sut.identifier(for: $0) }
        let uniqueIds = Set(ids)
        XCTAssertEqual(uniqueIds.count, 7, "All 7 identifiers must be unique")
    }

    func test_identifier_allWeekdays_haveCorrectPrefix() {
        for day in 1...7 {
            let id = sut.identifier(for: day)
            XCTAssertTrue(id.hasPrefix("budgetflow-weekly-"), "Identifier '\(id)' must start with 'budgetflow-weekly-'")
        }
    }

    func test_identifier_allWeekdays_haveCorrectSuffix() {
        for day in 1...7 {
            let id = sut.identifier(for: day)
            XCTAssertTrue(id.hasSuffix("\(day)"), "Identifier '\(id)' must end with the weekday number \(day)")
        }
    }

    // MARK: - scheduleWeeklyNotifications

    func test_scheduleEmptySet_doesNotCrash() {
        // Empty days set should just cancel all — must not crash
        sut.scheduleWeeklyNotifications(days: [], hour: 9, minute: 0, todayExpenses: 0, todayCount: 0)
        // If we get here, the call succeeded
        XCTAssertTrue(true)
    }

    func test_scheduleMultipleDays_doesNotCrash() {
        sut.scheduleWeeklyNotifications(days: [2, 4, 6], hour: 10, minute: 30, todayExpenses: 55.0, todayCount: 3)
        XCTAssertTrue(true)
    }

    func test_scheduleTodayExpenses_withCurrencyEUR_doesNotCrash() {
        // Exercises the branch where day == todayWeekday showing expense summary
        let todayWeekday = Calendar.current.component(.weekday, from: Date())
        sut.scheduleWeeklyNotifications(
            days: [todayWeekday],
            hour: 18,
            minute: 0,
            todayExpenses: 120.50,
            todayCount: 5,
            currency: "EUR"
        )
        XCTAssertTrue(true)
    }

    func test_scheduleTodayExpenses_withCurrencyUSD_doesNotCrash() {
        let todayWeekday = Calendar.current.component(.weekday, from: Date())
        sut.scheduleWeeklyNotifications(
            days: [todayWeekday],
            hour: 9,
            minute: 0,
            todayExpenses: 75.25,
            todayCount: 2,
            currency: "USD"
        )
        XCTAssertTrue(true)
    }

    func test_scheduleAllDays_doesNotCrash() {
        sut.scheduleWeeklyNotifications(
            days: Set(1...7),
            hour: 20,
            minute: 0,
            todayExpenses: 200.0,
            todayCount: 10
        )
        XCTAssertTrue(true)
    }

    // MARK: - cancelAllNotifications

    func test_cancelAll_doesNotCrash() {
        sut.cancelAllNotifications()
        XCTAssertTrue(true)
    }

    func test_cancelAllAfterSchedule_doesNotCrash() {
        sut.scheduleWeeklyNotifications(days: [2, 4], hour: 9, minute: 0, todayExpenses: 0, todayCount: 0)
        sut.cancelAllNotifications()
        XCTAssertTrue(true)
    }

    // MARK: - Async pending notification assertions

    func test_scheduleEmptySet_pendingCountIsZero() async {
        sut.scheduleWeeklyNotifications(days: [], hour: 9, minute: 0, todayExpenses: 0, todayCount: 0)
        // Allow a brief moment for the async remove to complete
        try? await Task.sleep(nanoseconds: 200_000_000)
        let pending = await UNUserNotificationCenter.current().pendingNotificationRequests()
        // After scheduling with empty set, no budgetflow requests should be pending
        let budgetflowPending = pending.filter { $0.identifier.hasPrefix("budgetflow-weekly-") }
        XCTAssertEqual(budgetflowPending.count, 0)
    }
}

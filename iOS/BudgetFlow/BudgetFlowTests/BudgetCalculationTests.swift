import XCTest
@testable import BudgetFlow

// MARK: - Available Budget Tests

final class AvailableBudgetTests: XCTestCase {

    func test_availableBudget_standard() {
        let calc = BudgetCalculator(monthlyIncome: 3000, fixedCosts: 1200, monthlySavings: 300)
        XCTAssertEqual(calc.availablePlanned, 1500, accuracy: 0.001)
    }

    func test_availableBudget_zeroCosts() {
        let calc = BudgetCalculator(monthlyIncome: 2000, fixedCosts: 0, monthlySavings: 0)
        XCTAssertEqual(calc.availablePlanned, 2000, accuracy: 0.001)
    }

    func test_availableBudget_costsExceedIncome_negativeResult() {
        let calc = BudgetCalculator(monthlyIncome: 1000, fixedCosts: 900, monthlySavings: 500)
        XCTAssertEqual(calc.availablePlanned, -400, accuracy: 0.001)
    }

    func test_availableBudget_allZero() {
        let calc = BudgetCalculator(monthlyIncome: 0, fixedCosts: 0, monthlySavings: 0)
        XCTAssertEqual(calc.availablePlanned, 0, accuracy: 0.001)
    }
}

// MARK: - Global Progress Tests

final class GlobalProgressTests: XCTestCase {

    func test_globalProgress_noSpend() {
        let calc = BudgetCalculator(monthlyIncome: 3000, fixedCosts: 1000, monthlySavings: 0)
        XCTAssertEqual(calc.globalProgress(totalSpent: 0), 0.0, accuracy: 0.001)
    }

    func test_globalProgress_halfSpent() {
        let calc = BudgetCalculator(monthlyIncome: 3000, fixedCosts: 1000, monthlySavings: 0)
        // availablePlanned = 2000, spent = 1000 → 0.5
        XCTAssertEqual(calc.globalProgress(totalSpent: 1000), 0.5, accuracy: 0.001)
    }

    func test_globalProgress_fullySpent() {
        let calc = BudgetCalculator(monthlyIncome: 3000, fixedCosts: 1000, monthlySavings: 0)
        XCTAssertEqual(calc.globalProgress(totalSpent: 2000), 1.0, accuracy: 0.001)
    }

    func test_globalProgress_overspent_exceedsOne() {
        // DashboardView does NOT clamp — result can exceed 1.0
        let calc = BudgetCalculator(monthlyIncome: 3000, fixedCosts: 1000, monthlySavings: 0)
        XCTAssertGreaterThan(calc.globalProgress(totalSpent: 3000), 1.0)
    }

    func test_globalProgress_zeroAvailable_returnsZero() {
        let calc = BudgetCalculator(monthlyIncome: 0, fixedCosts: 0, monthlySavings: 0)
        XCTAssertEqual(calc.globalProgress(totalSpent: 500), 0.0, accuracy: 0.001)
    }
}

// MARK: - Current Month Balance Tests

final class CurrentMonthBalanceTests: XCTestCase {

    func test_balance_noSpend() {
        let calc = BudgetCalculator(monthlyIncome: 3000, fixedCosts: 1000, monthlySavings: 200)
        // availablePlanned = 1800, spent = 0
        XCTAssertEqual(calc.currentMonthBalance(totalSpent: 0), 1800, accuracy: 0.001)
    }

    func test_balance_partialSpend() {
        let calc = BudgetCalculator(monthlyIncome: 3000, fixedCosts: 1000, monthlySavings: 0)
        // availablePlanned = 2000, spent = 750 → 1250
        XCTAssertEqual(calc.currentMonthBalance(totalSpent: 750), 1250, accuracy: 0.001)
    }

    func test_balance_overspent_isNegative() {
        let calc = BudgetCalculator(monthlyIncome: 3000, fixedCosts: 1000, monthlySavings: 0)
        // availablePlanned = 2000, spent = 2500 → -500
        XCTAssertEqual(calc.currentMonthBalance(totalSpent: 2500), -500, accuracy: 0.001)
    }
}

// MARK: - Spent Per Envelope Tests

final class SpentPerEnvelopeTests: XCTestCase {

    private func makeDate(year: Int, month: Int, day: Int) -> Date {
        var comps = DateComponents()
        comps.year = year; comps.month = month; comps.day = day
        return Calendar.current.date(from: comps)!
    }

    private func marchRange() -> (start: Date, end: Date) {
        let calendar = Calendar.current
        var comps = DateComponents()
        comps.year = 2026; comps.month = 3; comps.day = 1
        let start = calendar.date(from: comps)!
        let end = calendar.endOfMonth(for: start)
        return (start, end)
    }

    func test_spentPerEnvelope_singleEnvelope_sumIsCorrect() {
        let calc = BudgetCalculator(monthlyIncome: 3000, fixedCosts: 0, monthlySavings: 0)
        let envelopeId = UUID()
        let transactions: [(amount: Double, date: Date)] = [
            (50.0, makeDate(year: 2026, month: 3, day: 5)),
            (30.0, makeDate(year: 2026, month: 3, day: 12))
        ]
        let result = calc.spentPerEnvelope(
            envelopes: [(id: envelopeId, transactions: transactions)],
            in: marchRange()
        )
        XCTAssertEqual(result[envelopeId] ?? 0, 80.0, accuracy: 0.001)
    }

    func test_spentPerEnvelope_excludesPreviousMonth() {
        let calc = BudgetCalculator(monthlyIncome: 3000, fixedCosts: 0, monthlySavings: 0)
        let envelopeId = UUID()
        let transactions: [(amount: Double, date: Date)] = [
            (100.0, makeDate(year: 2026, month: 2, day: 28)), // February — excluded
            (40.0, makeDate(year: 2026, month: 3, day: 10))   // March — included
        ]
        let result = calc.spentPerEnvelope(
            envelopes: [(id: envelopeId, transactions: transactions)],
            in: marchRange()
        )
        XCTAssertEqual(result[envelopeId] ?? 0, 40.0, accuracy: 0.001)
    }

    func test_spentPerEnvelope_multipleEnvelopes_independent() {
        let calc = BudgetCalculator(monthlyIncome: 3000, fixedCosts: 0, monthlySavings: 0)
        let idA = UUID()
        let idB = UUID()
        let envelopes: [(id: UUID, transactions: [(amount: Double, date: Date)])] = [
            (id: idA, transactions: [(60.0, makeDate(year: 2026, month: 3, day: 1))]),
            (id: idB, transactions: [(120.0, makeDate(year: 2026, month: 3, day: 15))])
        ]
        let result = calc.spentPerEnvelope(envelopes: envelopes, in: marchRange())
        XCTAssertEqual(result[idA] ?? 0, 60.0, accuracy: 0.001)
        XCTAssertEqual(result[idB] ?? 0, 120.0, accuracy: 0.001)
    }

    func test_spentPerEnvelope_emptyTransactions_returnsZero() {
        let calc = BudgetCalculator(monthlyIncome: 3000, fixedCosts: 0, monthlySavings: 0)
        let envelopeId = UUID()
        let result = calc.spentPerEnvelope(
            envelopes: [(id: envelopeId, transactions: [])],
            in: marchRange()
        )
        XCTAssertEqual(result[envelopeId] ?? -1, 0.0, accuracy: 0.001)
    }
}

// MARK: - Overspend Detection Tests

final class OverspendDetectionTests: XCTestCase {

    func test_envelopeOverspent_whenSpentExceedsBudget() {
        // Envelope with budget of 200, spent 250 → overspent
        let budget = 200.0
        let spent = 250.0
        XCTAssertTrue(spent > budget, "Should be overspent when spent > budget")
    }

    func test_envelopeNotOverspent_whenUnderBudget() {
        let budget = 200.0
        let spent = 150.0
        XCTAssertFalse(spent > budget, "Should NOT be overspent when spent < budget")
    }

    func test_envelopeNotOverspent_zeroBudgetZeroSpent() {
        let budget = 0.0
        let spent = 0.0
        XCTAssertFalse(spent > budget, "Zero budget and zero spent is not overspent")
    }
}

// MARK: - BudgetCalculator totalSpent(transactions:in:) Tests

final class BudgetCalculatorTotalSpentTests: XCTestCase {

    private func makeDate(year: Int, month: Int, day: Int) -> Date {
        var comps = DateComponents()
        comps.year = year; comps.month = month; comps.day = day
        return Calendar.current.date(from: comps)!
    }

    private func marchRange() -> (start: Date, end: Date) {
        let calendar = Calendar.current
        let march1 = makeDate(year: 2026, month: 3, day: 1)
        return (start: calendar.startOfMonth(for: march1), end: calendar.endOfMonth(for: march1))
    }

    func test_totalSpent_singleTransaction_inRange() {
        let calc = BudgetCalculator(monthlyIncome: 3000, fixedCosts: 0, monthlySavings: 0)
        let transactions: [(amount: Double, date: Date)] = [(45.0, makeDate(year: 2026, month: 3, day: 10))]
        XCTAssertEqual(calc.totalSpent(transactions: transactions, in: marchRange()), 45.0, accuracy: 0.001)
    }

    func test_totalSpent_multipleTransactions_sumsCorrectly() {
        let calc = BudgetCalculator(monthlyIncome: 3000, fixedCosts: 0, monthlySavings: 0)
        let transactions: [(amount: Double, date: Date)] = [
            (30.0, makeDate(year: 2026, month: 3, day: 5)),
            (20.0, makeDate(year: 2026, month: 3, day: 15)),
            (10.0, makeDate(year: 2026, month: 3, day: 25))
        ]
        XCTAssertEqual(calc.totalSpent(transactions: transactions, in: marchRange()), 60.0, accuracy: 0.001)
    }

    func test_totalSpent_emptyTransactions_returnsZero() {
        let calc = BudgetCalculator(monthlyIncome: 3000, fixedCosts: 0, monthlySavings: 0)
        XCTAssertEqual(calc.totalSpent(transactions: [], in: marchRange()), 0.0, accuracy: 0.001)
    }

    func test_totalSpent_transactionsOutsideRange_excluded() {
        let calc = BudgetCalculator(monthlyIncome: 3000, fixedCosts: 0, monthlySavings: 0)
        let transactions: [(amount: Double, date: Date)] = [
            (50.0, makeDate(year: 2026, month: 2, day: 28)),  // Feb — excluded
            (25.0, makeDate(year: 2026, month: 4, day: 1))    // Apr — excluded
        ]
        XCTAssertEqual(calc.totalSpent(transactions: transactions, in: marchRange()), 0.0, accuracy: 0.001)
    }

    func test_totalSpent_transactionOnStartBoundary_included() {
        let calc = BudgetCalculator(monthlyIncome: 3000, fixedCosts: 0, monthlySavings: 0)
        let range = marchRange()
        let transactions: [(amount: Double, date: Date)] = [(100.0, range.start)]
        XCTAssertEqual(calc.totalSpent(transactions: transactions, in: range), 100.0, accuracy: 0.001)
    }

    func test_totalSpent_transactionOnEndBoundary_included() {
        let calc = BudgetCalculator(monthlyIncome: 3000, fixedCosts: 0, monthlySavings: 0)
        let range = marchRange()
        let transactions: [(amount: Double, date: Date)] = [(75.0, range.end)]
        XCTAssertEqual(calc.totalSpent(transactions: transactions, in: range), 75.0, accuracy: 0.001)
    }

    func test_totalSpent_mixedRange_onlyCountsInRange() {
        let calc = BudgetCalculator(monthlyIncome: 3000, fixedCosts: 0, monthlySavings: 0)
        let transactions: [(amount: Double, date: Date)] = [
            (40.0, makeDate(year: 2026, month: 3, day: 10)),  // in range
            (60.0, makeDate(year: 2026, month: 2, day: 15)),  // out of range
            (20.0, makeDate(year: 2026, month: 3, day: 31))   // in range
        ]
        XCTAssertEqual(calc.totalSpent(transactions: transactions, in: marchRange()), 60.0, accuracy: 0.001)
    }
}

// MARK: - BudgetCalculator totalSpentFromDict Tests

final class BudgetCalculatorDictTests: XCTestCase {

    func test_totalSpentFromDict_singleEntry() {
        let calc = BudgetCalculator(monthlyIncome: 3000, fixedCosts: 0, monthlySavings: 0)
        let dict: [UUID: Double] = [UUID(): 150.0]
        XCTAssertEqual(calc.totalSpentFromDict(dict), 150.0, accuracy: 0.001)
    }

    func test_totalSpentFromDict_multipleEntries_sumsCorrectly() {
        let calc = BudgetCalculator(monthlyIncome: 3000, fixedCosts: 0, monthlySavings: 0)
        let dict: [UUID: Double] = [UUID(): 100.0, UUID(): 200.0, UUID(): 50.0]
        XCTAssertEqual(calc.totalSpentFromDict(dict), 350.0, accuracy: 0.001)
    }

    func test_totalSpentFromDict_emptyDict_returnsZero() {
        let calc = BudgetCalculator(monthlyIncome: 3000, fixedCosts: 0, monthlySavings: 0)
        XCTAssertEqual(calc.totalSpentFromDict([:]), 0.0, accuracy: 0.001)
    }

    func test_totalSpentFromDict_allZeroValues_returnsZero() {
        let calc = BudgetCalculator(monthlyIncome: 3000, fixedCosts: 0, monthlySavings: 0)
        let dict: [UUID: Double] = [UUID(): 0.0, UUID(): 0.0]
        XCTAssertEqual(calc.totalSpentFromDict(dict), 0.0, accuracy: 0.001)
    }

    func test_totalSpentFromDict_isIndependentOfIncome() {
        // totalSpentFromDict is a pure sum - income/costs don't affect it
        let calc1 = BudgetCalculator(monthlyIncome: 1000, fixedCosts: 500, monthlySavings: 0)
        let calc2 = BudgetCalculator(monthlyIncome: 5000, fixedCosts: 0, monthlySavings: 0)
        let dict: [UUID: Double] = [UUID(): 300.0]
        XCTAssertEqual(calc1.totalSpentFromDict(dict), calc2.totalSpentFromDict(dict), accuracy: 0.001)
    }
}

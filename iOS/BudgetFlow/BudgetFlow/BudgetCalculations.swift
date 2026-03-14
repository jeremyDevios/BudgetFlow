import Foundation

// MARK: - BudgetCalculator
/// Pure value-type that replicates DashboardView's computed budget logic,
/// enabling unit testing without SwiftData or SwiftUI.
struct BudgetCalculator {
    let monthlyIncome: Double
    let fixedCosts: Double
    let monthlySavings: Double

    /// Income minus fixed costs and savings target.
    var availablePlanned: Double {
        monthlyIncome - fixedCosts - monthlySavings
    }

    /// Sum of transaction amounts that fall within the given date range.
    func totalSpent(transactions: [(amount: Double, date: Date)],
                    in range: (start: Date, end: Date)) -> Double {
        transactions
            .filter { $0.date >= range.start && $0.date <= range.end }
            .reduce(0) { $0 + $1.amount }
    }

    /// Per-envelope spending dictionary: envelopeId → total spent in range.
    func spentPerEnvelope(
        envelopes: [(id: UUID, transactions: [(amount: Double, date: Date)])],
        in range: (start: Date, end: Date)
    ) -> [UUID: Double] {
        var result: [UUID: Double] = [:]
        for envelope in envelopes {
            let spent = envelope.transactions
                .filter { $0.date >= range.start && $0.date <= range.end }
                .reduce(0) { $0 + $1.amount }
            result[envelope.id] = spent
        }
        return result
    }

    /// Sum of all values in a spentPerEnvelope dictionary.
    func totalSpentFromDict(_ dict: [UUID: Double]) -> Double {
        dict.values.reduce(0, +)
    }

    /// Budget balance = availablePlanned − totalSpent. Can be negative when over budget.
    func currentMonthBalance(totalSpent: Double) -> Double {
        availablePlanned - totalSpent
    }

    /// Proportion of budget spent (0.0 … unbounded; no clamping, matches DashboardView behavior).
    /// Returns 0 when availablePlanned ≤ 0 to avoid division by zero.
    func globalProgress(totalSpent: Double) -> Double {
        availablePlanned > 0 ? totalSpent / availablePlanned : 0
    }
}

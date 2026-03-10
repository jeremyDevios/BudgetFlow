import Foundation
import SwiftData

@Model
final class UserSettings {
    var monthlyIncome: Double = 0
    var fixedCosts: Double = 0
    var monthlySavings: Double = 0
    var currency: String = "EUR"
    @Attribute(originalName: "isOnboardingCompleted") var isOnboarded: Bool = false
    var isOnlineMode: Bool = false
    var firebaseUserId: String = ""
    var createdAt: Date = Date()
    var updatedAt: Date = Date()

    init(
        monthlyIncome: Double = 0,
        fixedCosts: Double = 0,
        monthlySavings: Double = 0,
        currency: String = "EUR",
        isOnboarded: Bool = false,
        isOnlineMode: Bool = false,
        firebaseUserId: String = "",
        createdAt: Date = Date(),
        updatedAt: Date = Date()
    ) {
        self.monthlyIncome = monthlyIncome
        self.fixedCosts = fixedCosts
        self.monthlySavings = monthlySavings
        self.currency = currency
        self.isOnboarded = isOnboarded
        self.isOnlineMode = isOnlineMode
        self.firebaseUserId = firebaseUserId
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

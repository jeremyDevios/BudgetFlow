import Foundation
import SwiftData

@Model
final class UserSettings {
    var monthlyIncome: Double
    var fixedCosts: Double
    var monthlySavings: Double
    var isOnboardingCompleted: Bool
    
    init(monthlyIncome: Double = 0, fixedCosts: Double = 0, monthlySavings: Double = 0, isOnboardingCompleted: Bool = false) {
        self.monthlyIncome = monthlyIncome
        self.fixedCosts = fixedCosts
        self.monthlySavings = monthlySavings
        self.isOnboardingCompleted = isOnboardingCompleted
    }
}

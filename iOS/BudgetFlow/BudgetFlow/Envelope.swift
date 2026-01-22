import Foundation
import SwiftData

@Model
final class Envelope {
    var id: UUID
    var name: String
    var icon: String
    var color: String
    var budget: Double
    var spent: Double
    var orderIndex: Int
    
    @Relationship(deleteRule: .cascade, inverse: \Transaction.envelope)
    var transactions: [Transaction] = []
    
    init(name: String, icon: String, color: String, budget: Double, orderIndex: Int, spent: Double = 0.0) {
        self.id = UUID()
        self.name = name
        self.icon = icon
        self.color = color
        self.budget = budget
        self.orderIndex = orderIndex
        self.spent = spent
    }
}

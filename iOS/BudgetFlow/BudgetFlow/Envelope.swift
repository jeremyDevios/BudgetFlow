import Foundation
import SwiftData

@Model
final class Envelope {
    var id: UUID
    var firestoreId: String = ""
    var name: String
    var icon: String
    var color: String
    var budget: Double
    var spent: Double
    @Attribute(originalName: "orderIndex") var order: Int
    var createdAt: Date = Date()

    @Relationship(deleteRule: .cascade, inverse: \Transaction.envelope)
    var transactions: [Transaction] = []

    init(
        name: String,
        icon: String,
        color: String,
        budget: Double,
        order: Int,
        spent: Double = 0.0,
        firestoreId: String = "",
        createdAt: Date = Date()
    ) {
        self.id = UUID()
        self.firestoreId = firestoreId
        self.name = name
        self.icon = icon
        self.color = color
        self.budget = budget
        self.order = order
        self.spent = spent
        self.createdAt = createdAt
    }
}

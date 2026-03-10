import Foundation
import SwiftData

@Model
final class Transaction {
    var id: UUID
    var firestoreId: String = ""
    var amount: Double
    @Attribute(originalName: "note") var note: String
    var envelopeId: String = ""
    var date: Date
    var createdAt: Date = Date()

    var envelope: Envelope?

    init(
        amount: Double,
        note: String,
        date: Date,
        envelope: Envelope? = nil,
        firestoreId: String = "",
        createdAt: Date = Date()
    ) {
        self.id = UUID()
        self.firestoreId = firestoreId
        self.amount = amount
        self.note = note
        self.envelopeId = envelope?.firestoreId ?? ""
        self.date = date
        self.envelope = envelope
        self.createdAt = createdAt
    }
}

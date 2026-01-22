import Foundation
import SwiftData

@Model
final class Transaction {
    var id: UUID
    var amount: Double
    var note: String
    var date: Date
    
    var envelope: Envelope?
    
    init(amount: Double, note: String, date: Date, envelope: Envelope? = nil) {
        self.id = UUID()
        self.amount = amount
        self.note = note
        self.date = date
        self.envelope = envelope
    }
}

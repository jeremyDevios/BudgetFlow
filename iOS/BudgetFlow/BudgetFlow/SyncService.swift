import FirebaseFirestore
import Foundation
import Observation
import SwiftData

private func parseDate(_ value: Any?) -> Date {
    if let str = value as? String {
        // Format web : "2026-03-10T15:30:00.000Z" (avec millisecondes)
        let formatterWithMs = ISO8601DateFormatter()
        formatterWithMs.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatterWithMs.date(from: str) { return date }
        // Fallback format sans millisecondes
        if let date = ISO8601DateFormatter().date(from: str) { return date }
    }
    if let ts = value as? Timestamp {
        return ts.dateValue()
    }
    return Date()
}

private func isoString(_ date: Date) -> String {
    ISO8601DateFormatter().string(from: date)
}

@Observable
class SyncService {
    var isSyncing: Bool = false
    private var listeners: [ListenerRegistration] = []

    private let db = Firestore.firestore()
    private let settingsDocumentId = "general"

    private func firestoreDouble(_ data: [String: Any], _ key: String, fallback: Double) -> Double {
        if let d = data[key] as? Double { return d }
        if let i = data[key] as? Int { return Double(i) }
        if let i = data[key] as? Int64 { return Double(i) }
        return fallback
    }

    func checkDataExists(for userId: String) async -> Bool {
        do {
            let userRef = db.collection("users").document(userId)

            // Vérification principale : document settings
            let settingsRef = userRef.collection("settings").document(settingsDocumentId)
            let settingsSnapshot = try await settingsRef.getDocument()
            if settingsSnapshot.exists, settingsSnapshot.data() != nil {
                return true
            }

            // Fallback : au moins une enveloppe existe
            let envelopesSnapshot = try await userRef.collection("envelopes").limit(to: 1).getDocuments()
            return !envelopesSnapshot.documents.isEmpty
        } catch {
#if DEBUG
            print("checkDataExists error: \(error)")
#endif
            return false
        }
    }

    @MainActor
    func loadFromFirestore(userId: String, into context: ModelContext) async throws {
        isSyncing = true
        defer { isSyncing = false }

        let userRef = db.collection("users").document(userId)
        let settingsRef = userRef.collection("settings").document(settingsDocumentId)
        let envelopesRef = userRef.collection("envelopes")
        let transactionsRef = userRef.collection("transactions")

        do {
            let settingsSnapshot = try await settingsRef.getDocument()
            let envelopeSnapshot = try await envelopesRef.getDocuments()
            let transactionSnapshot = try await transactionsRef.getDocuments()

            try? context.delete(model: Transaction.self)
            try? context.delete(model: Envelope.self)

            var envelopeByFirestoreId: [String: Envelope] = [:]

            for document in envelopeSnapshot.documents {
                let data = document.data()
                let name = data["name"] as? String ?? ""
                let icon = data["icon"] as? String ?? "tray"
                let color = data["color"] as? String ?? "blue"
                let budget = data["budget"] as? Double ?? 0
                let spent = data["spent"] as? Double ?? 0
                let order = data["order"] as? Int ?? data["orderIndex"] as? Int ?? 0

                let envelope = Envelope(
                    name: name,
                    icon: icon,
                    color: color,
                    budget: budget,
                    order: order,
                    spent: spent
                )

                envelope.firestoreId = document.documentID
                envelope.createdAt = parseDate(data["createdAt"])

                context.insert(envelope)
                envelopeByFirestoreId[document.documentID] = envelope
            }

            for document in transactionSnapshot.documents {
                let data = document.data()
                let amount = data["amount"] as? Double ?? 0
                let description = data["description"] as? String ?? data["note"] as? String ?? ""
                let envelopeId = data["envelopeId"] as? String

                let transaction = Transaction(
                    amount: amount,
                    note: description,
                    date: parseDate(data["date"])
                )

                transaction.firestoreId = document.documentID
                transaction.envelopeId = envelopeId ?? ""
                transaction.createdAt = parseDate(data["createdAt"])

                if let envelopeId, let envelope = envelopeByFirestoreId[envelopeId] {
                    transaction.envelope = envelope
                }

                context.insert(transaction)
            }

            if let settingsData = settingsSnapshot.data() {
                let descriptor = FetchDescriptor<UserSettings>()
                let existingSettings = try context.fetch(descriptor).first ?? UserSettings()
                if existingSettings.modelContext == nil {
                    context.insert(existingSettings)
                }

                existingSettings.monthlyIncome = firestoreDouble(settingsData, "monthlyIncome", fallback: existingSettings.monthlyIncome)
                existingSettings.fixedCosts = firestoreDouble(settingsData, "fixedCosts", fallback: existingSettings.fixedCosts)
                existingSettings.monthlySavings = firestoreDouble(settingsData, "monthlySavings", fallback: existingSettings.monthlySavings)
                existingSettings.currency = settingsData["currency"] as? String ?? existingSettings.currency
                existingSettings.isOnboarded = settingsData["isOnboarded"] as? Bool
                    ?? settingsData["isOnboardingCompleted"] as? Bool
                    ?? existingSettings.isOnboarded
            }

            try context.save()
        } catch {
#if DEBUG
            print("loadFromFirestore error: \(error)")
#endif
            throw error
        }
    }

    @MainActor
    func saveToFirestore(settings: UserSettings, envelopes: [Envelope], userId: String) async throws {
        isSyncing = true
        defer { isSyncing = false }

        let userRef = db.collection("users").document(userId)
        let settingsRef = userRef.collection("settings").document(settingsDocumentId)
        let envelopesRef = userRef.collection("envelopes")
        let transactionsRef = userRef.collection("transactions")

        var transactionById: [UUID: Transaction] = [:]
        for envelope in envelopes {
            for transaction in envelope.transactions {
                transactionById[transaction.id] = transaction
            }
        }

        let batch = db.batch()

        batch.setData([
            "monthlyIncome": settings.monthlyIncome,
            "fixedCosts": settings.fixedCosts,
            "monthlySavings": settings.monthlySavings,
            "isOnboarded": settings.isOnboarded,
            "currency": settings.currency,
            "updatedAt": isoString(Date())
        ], forDocument: settingsRef, merge: true)

        for envelope in envelopes {
            let envelopeRef: DocumentReference
            if envelope.firestoreId.isEmpty {
                envelopeRef = envelopesRef.document()
                envelope.firestoreId = envelopeRef.documentID
            } else {
                envelopeRef = envelopesRef.document(envelope.firestoreId)
            }

            batch.setData([
                "name": envelope.name,
                "icon": envelope.icon,
                "color": envelope.color,
                "budget": envelope.budget,
                "spent": envelope.spent,
                "order": envelope.order,
                "createdAt": isoString(envelope.createdAt)
            ], forDocument: envelopeRef, merge: true)
        }

        for transaction in transactionById.values {
            let transactionRef: DocumentReference
            if transaction.firestoreId.isEmpty {
                transactionRef = transactionsRef.document()
                transaction.firestoreId = transactionRef.documentID
            } else {
                transactionRef = transactionsRef.document(transaction.firestoreId)
            }

            batch.setData([
                "amount": transaction.amount,
                "description": transaction.note,
                "envelopeId": transaction.envelope?.firestoreId ?? "",
                "date": isoString(transaction.date),
                "createdAt": isoString(transaction.createdAt)
            ], forDocument: transactionRef, merge: true)
        }

        do {
            try await batch.commit()
        } catch {
#if DEBUG
            print("saveToFirestore error: \(error)")
#endif
            throw error
        }
    }

    func syncSettings(_ settings: UserSettings, userId: String) async {
        let settingsRef = db.collection("users").document(userId).collection("settings").document(settingsDocumentId)

        do {
            try await settingsRef.setData([
                "monthlyIncome": settings.monthlyIncome,
                "fixedCosts": settings.fixedCosts,
                "monthlySavings": settings.monthlySavings,
                "isOnboarded": settings.isOnboarded,
                "currency": settings.currency,
                "updatedAt": isoString(Date())
            ], merge: true)
        } catch {
#if DEBUG
            print("syncSettings error: \(error)")
#endif
        }
    }

    func syncEnvelope(_ envelope: Envelope, userId: String) async throws {
        let envelopesRef = db.collection("users")
            .document(userId)
            .collection("envelopes")

        do {
            if envelope.firestoreId.isEmpty {
                let ref = envelopesRef.document()
                envelope.firestoreId = ref.documentID

                try await ref.setData([
                    "name": envelope.name,
                    "icon": envelope.icon,
                    "color": envelope.color,
                    "budget": envelope.budget,
                    "spent": envelope.spent,
                    "order": envelope.order,
                    "createdAt": isoString(envelope.createdAt)
                ])
            } else {
                try await envelopesRef.document(envelope.firestoreId).setData([
                    "name": envelope.name,
                    "icon": envelope.icon,
                    "color": envelope.color,
                    "budget": envelope.budget,
                    "spent": envelope.spent,
                    "order": envelope.order
                ], merge: true)
            }
        } catch {
#if DEBUG
            print("syncEnvelope error: \(error)")
#endif
            throw error
        }
    }

    func syncTransaction(_ transaction: Transaction, userId: String) async {
        let transactionsRef = db.collection("users")
            .document(userId)
            .collection("transactions")

        do {
            if transaction.firestoreId.isEmpty {
                let ref = transactionsRef.document()
                transaction.firestoreId = ref.documentID

                try await ref.setData([
                    "amount": transaction.amount,
                    "description": transaction.note,
                    "envelopeId": transaction.envelope?.firestoreId ?? "",
                    "date": isoString(transaction.date),
                    "createdAt": isoString(transaction.createdAt)
                ])
            } else {
                try await transactionsRef.document(transaction.firestoreId).setData([
                    "amount": transaction.amount,
                    "description": transaction.note,
                    "envelopeId": transaction.envelope?.firestoreId ?? "",
                    "date": isoString(transaction.date)
                ], merge: true)
            }
        } catch {
#if DEBUG
            print("syncTransaction error: \(error)")
#endif
        }
    }

    func deleteEnvelope(firestoreId: String, userId: String) async {
        let userRef = db.collection("users").document(userId)
        let envelopeRef = userRef.collection("envelopes").document(firestoreId)

        do {
            try await envelopeRef.delete()

            let transactionsSnapshot = try await userRef
                .collection("transactions")
                .whereField("envelopeId", isEqualTo: firestoreId)
                .getDocuments()

            let batch = db.batch()
            for document in transactionsSnapshot.documents {
                batch.deleteDocument(document.reference)
            }
            try await batch.commit()
        } catch {
#if DEBUG
            print("deleteEnvelope error: \(error)")
#endif
        }
    }

    func deleteTransaction(firestoreId: String, userId: String) async {
        do {
            try await db.collection("users")
                .document(userId)
                .collection("transactions")
                .document(firestoreId)
                .delete()
        } catch {
#if DEBUG
            print("deleteTransaction error: \(error)")
#endif
        }
    }

    func removeListeners() {
        for listener in listeners {
            listener.remove()
        }
        listeners.removeAll()
    }
}

import XCTest
import SwiftData
@testable import BudgetFlow

// MARK: - In-Memory Container Helper

private func makeInMemoryContainer() throws -> ModelContainer {
    try ModelContainer(
        for: Envelope.self, Transaction.self, UserSettings.self,
        configurations: ModelConfiguration(isStoredInMemoryOnly: true)
    )
}

// MARK: - Mock SyncService

/// Simulates SyncService behavior for unit testing without Firestore.
@MainActor
final class MockSyncService: SyncServiceProtocol {
    var isSyncing: Bool = false

    // Configurable return values
    var checkDataExistsResult: Bool = false
    var shouldThrowOnLoad: Bool = false
    var shouldThrowOnSave: Bool = false
    var shouldThrowOnSyncEnvelope: Bool = false

    // Side effect injected into loadFromFirestore
    var loadSideEffect: ((String, ModelContext) -> Void)?

    // Call trackers
    var checkDataExistsCallCount: Int = 0
    var loadFromFirestoreCallCount: Int = 0
    var saveToFirestoreCallCount: Int = 0
    var savedSettings: UserSettings? = nil
    var savedEnvelopes: [Envelope] = []
    var syncedSettings: [UserSettings] = []
    var syncedEnvelopes: [Envelope] = []
    var syncedTransactions: [Transaction] = []
    var deletedEnvelopeIds: [String] = []
    var deletedTransactionIds: [String] = []
    var lastUserId: String? = nil

    func checkDataExists(for userId: String) async -> Bool {
        checkDataExistsCallCount += 1
        lastUserId = userId
        return checkDataExistsResult
    }

    func loadFromFirestore(userId: String, into context: ModelContext) async throws {
        isSyncing = true
        defer { isSyncing = false }
        loadFromFirestoreCallCount += 1
        lastUserId = userId
        if shouldThrowOnLoad {
            throw NSError(domain: "MockSyncError", code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Simulated network error"])
        }
        loadSideEffect?(userId, context)
    }

    func saveToFirestore(settings: UserSettings, envelopes: [Envelope], userId: String) async throws {
        isSyncing = true
        defer { isSyncing = false }
        saveToFirestoreCallCount += 1
        lastUserId = userId
        if shouldThrowOnSave {
            throw NSError(domain: "MockSyncError", code: 2,
                userInfo: [NSLocalizedDescriptionKey: "Simulated save error"])
        }
        savedSettings = settings
        savedEnvelopes = envelopes
    }

    func syncSettings(_ settings: UserSettings, userId: String) async {
        syncedSettings.append(settings)
        lastUserId = userId
    }

    func syncEnvelope(_ envelope: Envelope, userId: String) async throws {
        if shouldThrowOnSyncEnvelope {
            throw NSError(domain: "MockSyncError", code: 3,
                userInfo: [NSLocalizedDescriptionKey: "Simulated sync envelope error"])
        }
        syncedEnvelopes.append(envelope)
        lastUserId = userId
    }

    func syncTransaction(_ transaction: Transaction, userId: String) async {
        syncedTransactions.append(transaction)
        lastUserId = userId
    }

    func deleteEnvelope(firestoreId: String, userId: String) async {
        deletedEnvelopeIds.append(firestoreId)
        lastUserId = userId
    }

    func deleteTransaction(firestoreId: String, userId: String) async {
        deletedTransactionIds.append(firestoreId)
        lastUserId = userId
    }
}

// MARK: - checkDataExists Tests

@MainActor
final class CheckDataExistsTests: XCTestCase {

    var mockSync: MockSyncService!

    override func setUp() async throws {
        mockSync = MockSyncService()
    }

    func test_checkDataExists_returnsTrue_whenDataExists() async {
        mockSync.checkDataExistsResult = true
        let result = await mockSync.checkDataExists(for: "user123")
        XCTAssertTrue(result)
    }

    func test_checkDataExists_returnsFalse_whenNoData() async {
        mockSync.checkDataExistsResult = false
        let result = await mockSync.checkDataExists(for: "user456")
        XCTAssertFalse(result)
    }

    func test_checkDataExists_tracksCallCount() async {
        _ = await mockSync.checkDataExists(for: "userA")
        _ = await mockSync.checkDataExists(for: "userB")
        XCTAssertEqual(mockSync.checkDataExistsCallCount, 2)
    }

    func test_checkDataExists_recordsUserId() async {
        _ = await mockSync.checkDataExists(for: "userId_xyz")
        XCTAssertEqual(mockSync.lastUserId, "userId_xyz")
    }
}

// MARK: - loadFromFirestore Tests

@MainActor
final class LoadFromFirestoreTests: XCTestCase {

    var mockSync: MockSyncService!
    var container: ModelContainer!
    var context: ModelContext!

    override func setUp() async throws {
        mockSync = MockSyncService()
        container = try makeInMemoryContainer()
        context = ModelContext(container)
    }

    override func tearDown() async throws {
        context = nil
        container = nil
    }

    func test_loadFromFirestore_callsLoadMethod() async throws {
        try await mockSync.loadFromFirestore(userId: "user1", into: context)
        XCTAssertEqual(mockSync.loadFromFirestoreCallCount, 1)
    }

    func test_loadFromFirestore_sideEffect_populatesContext() async throws {
        // Side effect: insert 2 envelopes into the SwiftData context
        mockSync.loadSideEffect = { _, ctx in
            let e1 = Envelope(name: "Courses", icon: "cart", color: "green", budget: 300, order: 0)
            let e2 = Envelope(name: "Loisirs", icon: "gamecontroller", color: "blue", budget: 200, order: 1)
            ctx.insert(e1)
            ctx.insert(e2)
            try? ctx.save()
        }
        try await mockSync.loadFromFirestore(userId: "user1", into: context)

        let envelopes = try context.fetch(FetchDescriptor<Envelope>())
        XCTAssertEqual(envelopes.count, 2)
    }

    func test_loadFromFirestore_throwsOnNetworkError() async {
        mockSync.shouldThrowOnLoad = true
        do {
            try await mockSync.loadFromFirestore(userId: "user1", into: context)
            XCTFail("Expected error to be thrown")
        } catch {
            XCTAssertNotNil(error)
        }
    }

    func test_loadFromFirestore_isSyncingFalseAfterCompletion() async throws {
        try await mockSync.loadFromFirestore(userId: "user1", into: context)
        XCTAssertFalse(mockSync.isSyncing, "isSyncing must be false after completion")
    }

    func test_loadFromFirestore_isSyncingFalseAfterError() async {
        mockSync.shouldThrowOnLoad = true
        try? await mockSync.loadFromFirestore(userId: "user1", into: context)
        XCTAssertFalse(mockSync.isSyncing, "isSyncing must be false even after error (defer block)")
    }
}

// MARK: - saveToFirestore Tests

@MainActor
final class SaveToFirestoreTests: XCTestCase {

    var mockSync: MockSyncService!
    var container: ModelContainer!
    var context: ModelContext!

    override func setUp() async throws {
        mockSync = MockSyncService()
        container = try makeInMemoryContainer()
        context = ModelContext(container)
    }

    override func tearDown() async throws {
        context = nil
        container = nil
    }

    func test_saveToFirestore_capturesSettings() async throws {
        let settings = UserSettings(monthlyIncome: 3000, fixedCosts: 1000, monthlySavings: 300)
        let envelopes = [Envelope(name: "Courses", icon: "cart", color: "green", budget: 200, order: 0)]
        try await mockSync.saveToFirestore(settings: settings, envelopes: envelopes, userId: "user1")
        XCTAssertEqual(mockSync.savedSettings?.monthlyIncome, 3000)
        XCTAssertEqual(mockSync.savedEnvelopes.count, 1)
    }

    func test_saveToFirestore_throwsOnError() async {
        mockSync.shouldThrowOnSave = true
        let settings = UserSettings()
        do {
            try await mockSync.saveToFirestore(settings: settings, envelopes: [], userId: "user1")
            XCTFail("Expected error")
        } catch {
            XCTAssertNotNil(error)
        }
    }
}

// MARK: - syncSettings Tests

@MainActor
final class SyncSettingsTests: XCTestCase {

    var mockSync: MockSyncService!

    override func setUp() async throws {
        mockSync = MockSyncService()
    }

    func test_syncSettings_appendsToSyncedList() async {
        let settings = UserSettings(monthlyIncome: 2500)
        await mockSync.syncSettings(settings, userId: "user1")
        XCTAssertEqual(mockSync.syncedSettings.count, 1)
        XCTAssertEqual(mockSync.syncedSettings[0].monthlyIncome, 2500)
    }

    func test_syncSettings_recordsUserId() async {
        await mockSync.syncSettings(UserSettings(), userId: "user_abc")
        XCTAssertEqual(mockSync.lastUserId, "user_abc")
    }
}

// MARK: - syncEnvelope Tests

@MainActor
final class SyncEnvelopeTests: XCTestCase {

    var mockSync: MockSyncService!

    override func setUp() async throws {
        mockSync = MockSyncService()
    }

    func test_syncEnvelope_appendsToSyncedList() async throws {
        let env = Envelope(name: "Courses", icon: "cart", color: "green", budget: 300, order: 0)
        try await mockSync.syncEnvelope(env, userId: "user1")
        XCTAssertEqual(mockSync.syncedEnvelopes.count, 1)
    }

    func test_syncEnvelope_newEnvelope_emptyFirestoreId() async throws {
        let env = Envelope(name: "New", icon: "tray", color: "blue", budget: 100, order: 0)
        XCTAssertTrue(env.firestoreId.isEmpty)
        do {
            try await mockSync.syncEnvelope(env, userId: "user1")
        } catch {
            XCTFail("Expected no throw but got: \(error)")
        }
    }

    func test_syncEnvelope_existingEnvelope_withFirestoreId() async throws {
        let env = Envelope(name: "Existing", icon: "tray", color: "blue", budget: 100, order: 0, firestoreId: "firestore_abc")
        try await mockSync.syncEnvelope(env, userId: "user1")
        XCTAssertEqual(mockSync.syncedEnvelopes[0].firestoreId, "firestore_abc")
    }

    func test_syncEnvelope_throwsOnError() async {
        mockSync.shouldThrowOnSyncEnvelope = true
        let env = Envelope(name: "Error", icon: "tray", color: "red", budget: 0, order: 0)
        do {
            try await mockSync.syncEnvelope(env, userId: "user1")
            XCTFail("Expected error")
        } catch {
            XCTAssertNotNil(error)
        }
    }
}

// MARK: - deleteEnvelope & deleteTransaction Tests

@MainActor
final class DeleteSyncTests: XCTestCase {

    var mockSync: MockSyncService!

    override func setUp() async throws {
        mockSync = MockSyncService()
    }

    func test_deleteEnvelope_appendsFirestoreId() async {
        await mockSync.deleteEnvelope(firestoreId: "env_001", userId: "user1")
        XCTAssertEqual(mockSync.deletedEnvelopeIds, ["env_001"])
    }

    func test_deleteEnvelope_multipleDeletions_allTracked() async {
        await mockSync.deleteEnvelope(firestoreId: "env_A", userId: "u1")
        await mockSync.deleteEnvelope(firestoreId: "env_B", userId: "u1")
        XCTAssertEqual(mockSync.deletedEnvelopeIds.count, 2)
        XCTAssertTrue(mockSync.deletedEnvelopeIds.contains("env_A"))
        XCTAssertTrue(mockSync.deletedEnvelopeIds.contains("env_B"))
    }

    func test_deleteTransaction_appendsFirestoreId() async {
        await mockSync.deleteTransaction(firestoreId: "tx_001", userId: "user1")
        XCTAssertEqual(mockSync.deletedTransactionIds, ["tx_001"])
    }

    func test_deleteTransaction_doesNotAffectEnvelopeDeletions() async {
        await mockSync.deleteTransaction(firestoreId: "tx_123", userId: "user1")
        XCTAssertEqual(mockSync.deletedEnvelopeIds.count, 0, "Deleting transaction must not affect envelope deletions list")
    }
}

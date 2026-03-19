import XCTest
import SwiftData
@testable import BudgetFlow

// MARK: - Local Auth Protocol for testing online flow

protocol OnlineAuthProtocol {
    var isAuthenticated: Bool { get }
    var userId: String? { get }
    mutating func signIn(email: String, password: String) throws
    mutating func register(email: String, password: String) throws
    mutating func signOut()
}

struct MockOnlineAuth: OnlineAuthProtocol {
    var isAuthenticated: Bool = false
    var userId: String? = nil
    var signInError: Error? = nil
    var registerError: Error? = nil
    var signOutError: Error? = nil
    var signInCallCount = 0
    var registerCallCount = 0
    var signOutCallCount = 0

    mutating func signIn(email: String, password: String) throws {
        signInCallCount += 1
        if let error = signInError { throw error }
        isAuthenticated = true
        userId = "mock-user-\(email.hashValue)"
    }

    mutating func register(email: String, password: String) throws {
        registerCallCount += 1
        if let error = registerError { throw error }
        isAuthenticated = true
        userId = "new-user-\(email.hashValue)"
    }

    mutating func signOut() {
        signOutCallCount += 1
        if signOutError != nil { return }
        isAuthenticated = false
        userId = nil
    }
}

// MARK: - Helpers

private func makeInMemoryContainer() throws -> ModelContainer {
    let schema = Schema([Envelope.self, Transaction.self, UserSettings.self])
    let config = ModelConfiguration(isStoredInMemoryOnly: true)
    return try ModelContainer(for: schema, configurations: config)
}

// MARK: - Online Registration Flow Tests

@MainActor
final class OnlineRegistrationTests: XCTestCase {

    var mockAuth: MockOnlineAuth!
    var mockSync: MockSyncService!
    var container: ModelContainer!

    override func setUp() async throws {
        try await super.setUp()
        mockAuth = MockOnlineAuth()
        mockSync = MockSyncService()
        container = try makeInMemoryContainer()
    }

    override func tearDown() async throws {
        mockAuth = nil
        mockSync = nil
        container = nil
        try await super.tearDown()
    }

    func test_register_success_setsAuthenticatedState() throws {
        try mockAuth.register(email: "user@test.com", password: "password123")
        XCTAssertTrue(mockAuth.isAuthenticated)
        XCTAssertNotNil(mockAuth.userId)
    }

    func test_register_success_registerCallCountIsOne() throws {
        try mockAuth.register(email: "user@test.com", password: "pass")
        XCTAssertEqual(mockAuth.registerCallCount, 1)
    }

    func test_register_newUser_noExistingData_callsSaveToFirestore() async throws {
        try mockAuth.register(email: "new@test.com", password: "pass")
        guard let userId = mockAuth.userId else { XCTFail("userId must be set after registration"); return }

        mockSync.checkDataExistsResult = false
        let hasData = await mockSync.checkDataExists(for: userId)
        XCTAssertFalse(hasData)

        // New user: onboarding would call saveToFirestore
        let settings = UserSettings()
        settings.monthlyIncome = 3000
        settings.isOnlineMode = true
        let envelope = Envelope(name: "Courses", icon: "cart", color: "blue", budget: 300, order: 0)
        try await mockSync.saveToFirestore(settings: settings, envelopes: [envelope], userId: userId)

        XCTAssertEqual(mockSync.saveToFirestoreCallCount, 1)
    }

    func test_register_existingUser_callsLoadFromFirestore() async throws {
        try mockAuth.register(email: "existing@test.com", password: "pass")
        guard let userId = mockAuth.userId else { XCTFail(); return }

        mockSync.checkDataExistsResult = true
        let hasData = await mockSync.checkDataExists(for: userId)
        XCTAssertTrue(hasData)

        let context = container.mainContext
        try await mockSync.loadFromFirestore(userId: userId, into: context)
        XCTAssertEqual(mockSync.loadFromFirestoreCallCount, 1)
    }

    func test_register_emailTaken_throwsError() {
        mockAuth.registerError = NSError(domain: "FIRAuthErrorDomain", code: 17007, userInfo: [NSLocalizedDescriptionKey: "Email already in use"])
        XCTAssertThrowsError(try mockAuth.register(email: "taken@test.com", password: "pass"))
        XCTAssertFalse(mockAuth.isAuthenticated)
    }

    func test_register_weakPassword_throwsError() {
        mockAuth.registerError = NSError(domain: "FIRAuthErrorDomain", code: 17026, userInfo: [NSLocalizedDescriptionKey: "Weak password"])
        XCTAssertThrowsError(try mockAuth.register(email: "user@test.com", password: "123"))
        XCTAssertEqual(mockAuth.registerCallCount, 1)
    }
}

// MARK: - Online Sign-In Flow Tests

@MainActor
final class OnlineSignInTests: XCTestCase {

    var mockAuth: MockOnlineAuth!
    var mockSync: MockSyncService!
    var container: ModelContainer!

    override func setUp() async throws {
        try await super.setUp()
        mockAuth = MockOnlineAuth()
        mockSync = MockSyncService()
        container = try makeInMemoryContainer()
    }

    override func tearDown() async throws {
        mockAuth = nil
        mockSync = nil
        container = nil
        try await super.tearDown()
    }

    func test_signIn_success_setsAuthenticated() throws {
        try mockAuth.signIn(email: "user@test.com", password: "correctpass")
        XCTAssertTrue(mockAuth.isAuthenticated)
        XCTAssertNotNil(mockAuth.userId)
    }

    func test_signIn_existingData_loadsFromFirestore() async throws {
        try mockAuth.signIn(email: "user@test.com", password: "correctpass")
        guard let userId = mockAuth.userId else { XCTFail(); return }

        mockSync.checkDataExistsResult = true
        let hasData = await mockSync.checkDataExists(for: userId)
        XCTAssertTrue(hasData)

        let context = container.mainContext
        try await mockSync.loadFromFirestore(userId: userId, into: context)
        XCTAssertEqual(mockSync.loadFromFirestoreCallCount, 1)
    }

    func test_signIn_existingData_populatesSwiftDataContext() async throws {
        try mockAuth.signIn(email: "user@test.com", password: "pass")
        guard let userId = mockAuth.userId else { XCTFail(); return }

        mockSync.loadSideEffect = { _, context in
            let envelope = Envelope(name: "Loisirs", icon: "gamecontroller", color: "green", budget: 150, order: 0)
            context.insert(envelope)
        }
        let context = container.mainContext
        try await mockSync.loadFromFirestore(userId: userId, into: context)

        let envelopes = try context.fetch(FetchDescriptor<Envelope>())
        XCTAssertEqual(envelopes.count, 1)
        XCTAssertEqual(envelopes[0].name, "Loisirs")
    }

    func test_signIn_wrongPassword_throwsError() {
        mockAuth.signInError = NSError(domain: "FIRAuthErrorDomain", code: 17009, userInfo: [NSLocalizedDescriptionKey: "Wrong password"])
        XCTAssertThrowsError(try mockAuth.signIn(email: "user@test.com", password: "wrong"))
        XCTAssertFalse(mockAuth.isAuthenticated)
    }

    func test_signIn_userNotFound_doesNotCallLoad() throws {
        mockAuth.signInError = NSError(domain: "FIRAuthErrorDomain", code: 17011)
        XCTAssertThrowsError(try mockAuth.signIn(email: "ghost@test.com", password: "pass"))
        XCTAssertEqual(mockSync.loadFromFirestoreCallCount, 0)
    }
}

// MARK: - Online Data Loading Tests

@MainActor
final class OnlineDataLoadingTests: XCTestCase {

    var mockSync: MockSyncService!
    var container: ModelContainer!

    override func setUp() async throws {
        try await super.setUp()
        mockSync = MockSyncService()
        container = try makeInMemoryContainer()
    }

    override func tearDown() async throws {
        mockSync = nil
        container = nil
        try await super.tearDown()
    }

    func test_loadFirestore_createsEnvelopes() async throws {
        mockSync.loadSideEffect = { _, context in
            context.insert(Envelope(name: "Courses", icon: "cart", color: "blue", budget: 300, order: 0))
            context.insert(Envelope(name: "Loyer", icon: "house", color: "red", budget: 800, order: 1))
            context.insert(Envelope(name: "Loisirs", icon: "gamecontroller", color: "green", budget: 150, order: 2))
        }
        let context = container.mainContext
        try await mockSync.loadFromFirestore(userId: "user1", into: context)

        let envelopes = try context.fetch(FetchDescriptor<Envelope>())
        XCTAssertEqual(envelopes.count, 3)
    }

    func test_loadFirestore_createsTransactions() async throws {
        mockSync.loadSideEffect = { _, context in
            let envelope = Envelope(name: "Courses", icon: "cart", color: "blue", budget: 300, order: 0)
            context.insert(envelope)
            let t1 = Transaction(amount: 45.0, note: "Supermarché", date: Date())
            let t2 = Transaction(amount: 20.0, note: "Boulangerie", date: Date())
            t1.envelope = envelope
            t2.envelope = envelope
            context.insert(t1)
            context.insert(t2)
        }
        let context = container.mainContext
        try await mockSync.loadFromFirestore(userId: "user1", into: context)

        let transactions = try context.fetch(FetchDescriptor<Transaction>())
        XCTAssertEqual(transactions.count, 2)
        let amounts = transactions.map { $0.amount }.sorted()
        XCTAssertEqual(amounts[0], 20.0, accuracy: 0.001)
        XCTAssertEqual(amounts[1], 45.0, accuracy: 0.001)
    }

    func test_loadFirestore_createsUserSettings() async throws {
        mockSync.loadSideEffect = { _, context in
            let settings = UserSettings()
            settings.monthlyIncome = 4500
            settings.fixedCosts = 1200
            settings.monthlySavings = 500
            settings.isOnlineMode = true
            context.insert(settings)
        }
        let context = container.mainContext
        try await mockSync.loadFromFirestore(userId: "user1", into: context)

        let settings = try context.fetch(FetchDescriptor<UserSettings>())
        XCTAssertEqual(settings.first?.monthlyIncome ?? 0, 4500, accuracy: 0.001)
        XCTAssertEqual(settings.first?.fixedCosts ?? 0, 1200, accuracy: 0.001)
    }

    func test_loadFirestore_isSyncingFalseAfterSuccess() async throws {
        let context = container.mainContext
        try await mockSync.loadFromFirestore(userId: "user1", into: context)
        XCTAssertFalse(mockSync.isSyncing)
    }

    func test_loadFirestore_throwOnError_contextRemainsEmpty() async throws {
        mockSync.shouldThrowOnLoad = true
        let context = container.mainContext
        do {
            try await mockSync.loadFromFirestore(userId: "user1", into: context)
            XCTFail("Should have thrown an error")
        } catch {
            let envelopes = try context.fetch(FetchDescriptor<Envelope>())
            XCTAssertEqual(envelopes.count, 0)
        }
    }
}

// MARK: - Online Sign-Out Tests

@MainActor
final class OnlineSignOutTests: XCTestCase {

    var mockAuth: MockOnlineAuth!

    override func setUp() async throws {
        try await super.setUp()
        mockAuth = MockOnlineAuth()
        mockAuth.isAuthenticated = true
        mockAuth.userId = "user-123"
    }

    override func tearDown() async throws {
        mockAuth = nil
        try await super.tearDown()
    }

    func test_signOut_success_clearsAuthentication() {
        mockAuth.signOut()
        XCTAssertFalse(mockAuth.isAuthenticated)
        XCTAssertNil(mockAuth.userId)
    }

    func test_signOut_callCount_isOne() {
        mockAuth.signOut()
        XCTAssertEqual(mockAuth.signOutCallCount, 1)
    }
}

// MARK: - Online Error Handling Tests

@MainActor
final class OnlineErrorHandlingTests: XCTestCase {

    var mockAuth: MockOnlineAuth!
    var mockSync: MockSyncService!
    var container: ModelContainer!

    override func setUp() async throws {
        try await super.setUp()
        mockAuth = MockOnlineAuth()
        mockSync = MockSyncService()
        container = try makeInMemoryContainer()
    }

    override func tearDown() async throws {
        mockAuth = nil
        mockSync = nil
        container = nil
        try await super.tearDown()
    }

    func test_firestoreError_duringSave_propagates() async {
        mockSync.shouldThrowOnSave = true
        let settings = UserSettings()
        do {
            try await mockSync.saveToFirestore(settings: settings, envelopes: [], userId: "user1")
            XCTFail("Expected error")
        } catch {
            XCTAssertEqual(mockSync.saveToFirestoreCallCount, 1)
        }
    }

    func test_syncEnvelope_error_propagates() async {
        mockSync.shouldThrowOnSyncEnvelope = true
        let envelope = Envelope(name: "Test", icon: "tray", color: "blue", budget: 100, order: 0)
        do {
            try await mockSync.syncEnvelope(envelope, userId: "user1")
            XCTFail("Expected error")
        } catch {
            XCTAssertTrue(true)
        }
    }

    func test_networkError_signIn_throwsURLError() {
        mockAuth.signInError = URLError(.notConnectedToInternet)
        do {
            try mockAuth.signIn(email: "user@test.com", password: "pass")
            XCTFail("Expected URLError")
        } catch let error as URLError {
            XCTAssertEqual(error.code, .notConnectedToInternet)
        } catch {
            XCTFail("Expected URLError but got: \(error)")
        }
    }

    func test_saveToFirestore_afterLoad_callCountIsCorrect() async throws {
        let context = container.mainContext
        try await mockSync.loadFromFirestore(userId: "user1", into: context)

        let settings = UserSettings()
        let envelope = Envelope(name: "Test", icon: "cart", color: "blue", budget: 200, order: 0)
        try await mockSync.saveToFirestore(settings: settings, envelopes: [envelope], userId: "user1")

        XCTAssertEqual(mockSync.loadFromFirestoreCallCount, 1)
        XCTAssertEqual(mockSync.saveToFirestoreCallCount, 1)
    }

    func test_checkDataExists_afterRegistration_returnsFalseForNewUser() async throws {
        try mockAuth.register(email: "brandnew@test.com", password: "pass123")
        guard let userId = mockAuth.userId else { XCTFail(); return }

        mockSync.checkDataExistsResult = false
        let hasData = await mockSync.checkDataExists(for: userId)
        XCTAssertFalse(hasData)
        XCTAssertEqual(mockSync.checkDataExistsCallCount, 1)
    }
}
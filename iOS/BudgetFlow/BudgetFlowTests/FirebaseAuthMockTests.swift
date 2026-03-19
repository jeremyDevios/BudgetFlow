import XCTest
@testable import BudgetFlow

// MARK: - Testable Auth Protocol (richer interface for testing contracts)

/// Extended protocol for testing — covers state transitions and error propagation.
/// The production FirebaseAuthProtocol covers only the observable state.
protocol TestableFirebaseAuth: AnyObject {
    var isAuthenticated: Bool { get set }
    var isAuthLoaded: Bool { get set }

    func signIn(email: String, password: String) throws
    func register(email: String, password: String) throws
    func signInWithGoogle() throws
    func signOut() throws
}

// MARK: - Mock Implementation

/// Simulates Firebase auth behavior without a real network connection.
/// Configurable via properties before invoking test actions.
final class MockFirebaseAuth: TestableFirebaseAuth {
    var isAuthenticated: Bool = false
    var isAuthLoaded: Bool = false

    // Configurable errors — set before calling sign-in/register/signOut
    var signInError: Error? = nil
    var registerError: Error? = nil
    var signOutError: Error? = nil
    var googleSignInError: Error? = nil

    // Call trackers
    var signInCallCount: Int = 0
    var registerCallCount: Int = 0
    var signOutCallCount: Int = 0
    var googleSignInCallCount: Int = 0

    func signIn(email: String, password: String) throws {
        signInCallCount += 1
        if let error = signInError { throw error }
        isAuthenticated = true
        isAuthLoaded = true
    }

    func register(email: String, password: String) throws {
        registerCallCount += 1
        if let error = registerError { throw error }
        isAuthenticated = true
        isAuthLoaded = true
    }

    func signInWithGoogle() throws {
        googleSignInCallCount += 1
        if let error = googleSignInError { throw error }
        isAuthenticated = true
        isAuthLoaded = true
    }

    func signOut() throws {
        signOutCallCount += 1
        if let error = signOutError { throw error }
        isAuthenticated = false
    }
}

// MARK: - Helpers

private func makeAuthError(code: Int, description: String) -> NSError {
    NSError(
        domain: "FIRAuthErrorDomain",
        code: code,
        userInfo: [NSLocalizedDescriptionKey: description]
    )
}

// MARK: - Sign-In Tests

final class FirebaseSignInTests: XCTestCase {

    var mockAuth: MockFirebaseAuth!

    override func setUp() {
        mockAuth = MockFirebaseAuth()
    }

    func test_signIn_success_setsIsAuthenticated() throws {
        try mockAuth.signIn(email: "user@example.com", password: "password123")
        XCTAssertTrue(mockAuth.isAuthenticated)
    }

    func test_signIn_success_setsIsAuthLoaded() throws {
        try mockAuth.signIn(email: "user@example.com", password: "password123")
        XCTAssertTrue(mockAuth.isAuthLoaded)
    }

    func test_signIn_wrongPassword_throwsError() {
        // Error code 17009 = FIRAuthErrorCodeWrongPassword
        mockAuth.signInError = makeAuthError(code: 17009, description: "Le mot de passe est incorrect.")
        XCTAssertThrowsError(try mockAuth.signIn(email: "user@example.com", password: "wrong")) { error in
            let nsError = error as NSError
            XCTAssertEqual(nsError.code, 17009)
        }
        XCTAssertFalse(mockAuth.isAuthenticated, "isAuthenticated must remain false on error")
    }

    func test_signIn_userNotFound_throwsError() {
        // Error code 17011 = FIRAuthErrorCodeUserNotFound
        mockAuth.signInError = makeAuthError(code: 17011, description: "Aucun compte utilisateur trouvé.")
        XCTAssertThrowsError(try mockAuth.signIn(email: "unknown@example.com", password: "pass")) { error in
            let nsError = error as NSError
            XCTAssertEqual(nsError.code, 17011)
        }
    }

    func test_signIn_networkError_throwsError() {
        mockAuth.signInError = URLError(.notConnectedToInternet)
        XCTAssertThrowsError(try mockAuth.signIn(email: "user@example.com", password: "pass"))
        XCTAssertFalse(mockAuth.isAuthenticated)
    }

    func test_signIn_incrementsCallCount() throws {
        try mockAuth.signIn(email: "a@b.com", password: "pass")
        XCTAssertEqual(mockAuth.signInCallCount, 1)
    }
}

// MARK: - Register Tests

final class FirebaseRegisterTests: XCTestCase {

    var mockAuth: MockFirebaseAuth!

    override func setUp() {
        mockAuth = MockFirebaseAuth()
    }

    func test_register_success_setsIsAuthenticated() throws {
        try mockAuth.register(email: "new@example.com", password: "StrongPass1!")
        XCTAssertTrue(mockAuth.isAuthenticated)
    }

    func test_register_emailAlreadyInUse_throwsError() {
        // Error code 17007 = FIRAuthErrorCodeEmailAlreadyInUse
        mockAuth.registerError = makeAuthError(code: 17007, description: "L'email est déjà utilisé.")
        XCTAssertThrowsError(try mockAuth.register(email: "taken@example.com", password: "pass")) { error in
            let nsError = error as NSError
            XCTAssertEqual(nsError.code, 17007)
        }
        XCTAssertFalse(mockAuth.isAuthenticated)
    }

    func test_register_weakPassword_throwsError() {
        // Error code 17026 = FIRAuthErrorCodeWeakPassword
        mockAuth.registerError = makeAuthError(code: 17026, description: "Mot de passe trop faible.")
        XCTAssertThrowsError(try mockAuth.register(email: "user@example.com", password: "123"))
    }
}

// MARK: - Sign-Out Tests

final class FirebaseSignOutTests: XCTestCase {

    var mockAuth: MockFirebaseAuth!

    override func setUp() {
        mockAuth = MockFirebaseAuth()
    }

    func test_signOut_clearsIsAuthenticated() throws {
        // Sign in first
        try mockAuth.signIn(email: "user@example.com", password: "pass")
        XCTAssertTrue(mockAuth.isAuthenticated)

        // Sign out
        try mockAuth.signOut()
        XCTAssertFalse(mockAuth.isAuthenticated)
    }

    func test_signOut_whenAlreadySignedOut_noError() {
        XCTAssertFalse(mockAuth.isAuthenticated)
        XCTAssertNoThrow(try mockAuth.signOut())
        XCTAssertFalse(mockAuth.isAuthenticated)
    }
}

// MARK: - Google Sign-In Tests

final class FirebaseGoogleSignInTests: XCTestCase {

    var mockAuth: MockFirebaseAuth!

    override func setUp() {
        mockAuth = MockFirebaseAuth()
    }

    func test_googleSignIn_success_setsIsAuthenticated() throws {
        try mockAuth.signInWithGoogle()
        XCTAssertTrue(mockAuth.isAuthenticated)
        XCTAssertTrue(mockAuth.isAuthLoaded)
    }

    func test_googleSignIn_cancelled_throwsError() {
        mockAuth.googleSignInError = NSError(
            domain: "com.google.GIDSignIn",
            code: -5, // GIDSignInError.canceled
            userInfo: [NSLocalizedDescriptionKey: "Sign-in cancelled."]
        )
        XCTAssertThrowsError(try mockAuth.signInWithGoogle())
        XCTAssertFalse(mockAuth.isAuthenticated)
    }
}

// MARK: - Auth State Tests

final class FirebaseAuthStateTests: XCTestCase {

    var mockAuth: MockFirebaseAuth!

    override func setUp() {
        mockAuth = MockFirebaseAuth()
    }

    func test_isAuthenticated_falseByDefault() {
        XCTAssertFalse(mockAuth.isAuthenticated)
    }

    func test_isAuthLoaded_falseByDefault() {
        XCTAssertFalse(mockAuth.isAuthLoaded)
    }

    func test_isAuthenticated_trueAfterSuccessfulSignIn() throws {
        XCTAssertFalse(mockAuth.isAuthenticated)
        try mockAuth.signIn(email: "user@example.com", password: "pass")
        XCTAssertTrue(mockAuth.isAuthenticated)
    }
}

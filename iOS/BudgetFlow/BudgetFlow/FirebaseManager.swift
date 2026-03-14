import Foundation
import Observation
import FirebaseAuth
import GoogleSignIn
import GoogleSignInSwift
import UIKit

// MARK: - FirebaseAuth Protocol (for dependency injection & testing)
/// Represents the auth state observable by views and testable via mocks.
protocol FirebaseAuthProtocol: AnyObject {
    /// True when a Firebase user is authenticated.
    var isAuthenticated: Bool { get }
    /// True after the first auth-state listener callback fires (session restored or not).
    var isAuthLoaded: Bool { get }
}

@Observable
class FirebaseManager {
    var currentUser: FirebaseAuth.User? = nil
    var isAuthenticated: Bool { currentUser != nil }
    /// Devient true après le premier callback de l'auth state listener (session restaurée ou non)
    var isAuthLoaded: Bool = false

    private var authListenerHandle: AuthStateDidChangeListenerHandle?

    init() {
        authListenerHandle = Auth.auth().addStateDidChangeListener { [weak self] _, user in
            self?.currentUser = user
            self?.isAuthLoaded = true
        }
    }

    deinit {
        if let authListenerHandle {
            Auth.auth().removeStateDidChangeListener(authListenerHandle)
        }
    }

    func signIn(email: String, password: String) async throws -> FirebaseAuth.User {
        try await Auth.auth().signIn(withEmail: email, password: password).user
    }

    func register(email: String, password: String) async throws -> FirebaseAuth.User {
        try await Auth.auth().createUser(withEmail: email, password: password).user
    }

    func signInWithGoogle() async throws -> FirebaseAuth.User {
        guard let viewController = topViewController() else {
            throw NSError(domain: "FirebaseManager", code: 1, userInfo: [
                NSLocalizedDescriptionKey: "Unable to find a presenting view controller for Google Sign-In."
            ])
        }

        let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: viewController)
        guard
            let idToken = result.user.idToken?.tokenString,
            let accessToken = result.user.accessToken.tokenString as String?
        else {
            throw NSError(domain: "FirebaseManager", code: 2, userInfo: [
                NSLocalizedDescriptionKey: "Missing Google authentication tokens."
            ])
        }

        let credential = GoogleAuthProvider.credential(withIDToken: idToken, accessToken: accessToken)
        let authResult = try await Auth.auth().signIn(with: credential)
        return authResult.user
    }

    func signOut() throws {
        GIDSignIn.sharedInstance.signOut()
        try Auth.auth().signOut()
        currentUser = nil
    }

    private func topViewController() -> UIViewController? {
        let scenes = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }

        guard let windowScene = scenes.first else { return nil }

        let rootViewController = windowScene.windows
            .first(where: { $0.isKeyWindow })?
            .rootViewController

        var top = rootViewController
        while let presented = top?.presentedViewController {
            top = presented
        }

        return top
    }
}

// MARK: - Protocol Conformance
extension FirebaseManager: FirebaseAuthProtocol {}

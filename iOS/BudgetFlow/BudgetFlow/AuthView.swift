import SwiftUI
import FirebaseAuth

struct AuthView: View {
    @Environment(FirebaseManager.self) private var firebaseManager

    var onSuccess: (FirebaseAuth.User) -> Void
    var onDismiss: () -> Void

    @State private var email = ""
    @State private var password = ""
    @State private var isSignIn = true
    @State private var isLoading = false
    @State private var errorMessage = ""

    var body: some View {
        ZStack {
            Color.appBackground
                .ignoresSafeArea()

            VStack(spacing: 24) {
                HStack {
                    Spacer()
                    Button(action: onDismiss) {
                        Image(systemName: "xmark")
                            .font(.headline)
                            .foregroundStyle(.white)
                            .padding(10)
                            .background(Color.appSurface)
                            .clipShape(Circle())
                    }
                    .accessibilityLabel("Fermer")
                }

                Image(systemName: "lock.shield")
                    .font(.system(size: 48))
                    .foregroundStyle(Color.appYellow)

                Text(isSignIn ? "Se connecter" : "Creer un compte")
                    .font(.title)
                    .fontWeight(.bold)
                    .foregroundStyle(.white)

                VStack(alignment: .leading, spacing: 8) {
                    Text("Email")
                        .font(.caption)
                        .foregroundStyle(Color.appSecondaryText)

                    TextField("votre@email.com", text: $email)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.emailAddress)
                        .autocorrectionDisabled()
                        .foregroundStyle(.white)
                        .padding()
                        .background(Color.appSurface)
                        .cornerRadius(12)
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("Mot de passe")
                        .font(.caption)
                        .foregroundStyle(Color.appSecondaryText)

                    SecureField("••••••••", text: $password)
                        .foregroundStyle(.white)
                        .padding()
                        .background(Color.appSurface)
                        .cornerRadius(12)
                }

                if !errorMessage.isEmpty {
                    Text(errorMessage)
                        .font(.caption)
                        .foregroundStyle(.red)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                PrimaryButton(
                    title: isSignIn ? "Se connecter" : "Creer un compte",
                    icon: nil,
                    action: {
                        Task {
                            await performEmailAuth()
                        }
                    },
                    isDisabled: isLoading || email.isEmpty || password.isEmpty
                )

                HStack(spacing: 12) {
                    Rectangle()
                        .fill(Color.white.opacity(0.1))
                        .frame(height: 1)
                    Text("ou")
                        .font(.caption)
                        .foregroundStyle(Color.appSecondaryText)
                    Rectangle()
                        .fill(Color.white.opacity(0.1))
                        .frame(height: 1)
                }

                Button(action: {
                    Task {
                        await performGoogleSignIn()
                    }
                }) {
                    HStack(spacing: 12) {
                        Image(systemName: "globe")
                            .foregroundStyle(.white)
                        Text("Continuer avec Google")
                            .fontWeight(.semibold)
                            .foregroundStyle(.white)
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.appSurface)
                    .cornerRadius(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.white.opacity(0.2), lineWidth: 1)
                    )
                }
                .disabled(isLoading)

                Spacer()

                Button(action: {
                    isSignIn.toggle()
                    errorMessage = ""
                }) {
                    Text(isSignIn ? "Pas encore de compte ? S'inscrire" : "Deja un compte ? Se connecter")
                        .font(.footnote)
                        .foregroundStyle(Color.appYellow)
                }
                .disabled(isLoading)
            }
            .padding(24)

            if isLoading {
                Color.black.opacity(0.4)
                    .ignoresSafeArea()

                ProgressView()
                    .tint(Color.appYellow)
            }
        }
    }

    private func performEmailAuth() async {
        guard !email.isEmpty, !password.isEmpty else { return }

        await MainActor.run {
            isLoading = true
            errorMessage = ""
        }

        do {
            let user: FirebaseAuth.User
            if isSignIn {
                user = try await firebaseManager.signIn(email: email, password: password)
            } else {
                user = try await firebaseManager.register(email: email, password: password)
            }

            await MainActor.run {
                isLoading = false
                onSuccess(user)
            }
        } catch {
            await MainActor.run {
                errorMessage = error.localizedDescription
                isLoading = false
            }
        }
    }

    private func performGoogleSignIn() async {
        await MainActor.run {
            isLoading = true
            errorMessage = ""
        }

        do {
            let user = try await firebaseManager.signInWithGoogle()

            await MainActor.run {
                isLoading = false
                onSuccess(user)
            }
        } catch {
            await MainActor.run {
                errorMessage = error.localizedDescription
                isLoading = false
            }
        }
    }
}

#Preview {
    AuthView(
        onSuccess: { _ in },
        onDismiss: {}
    )
}
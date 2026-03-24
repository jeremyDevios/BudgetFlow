import SwiftUI
import FirebaseAuth

struct AuthView: View {
    @Environment(FirebaseManager.self) private var firebaseManager

    var onSuccess: (FirebaseAuth.User) -> Void
    var onDismiss: () -> Void

    @State private var isLoading = false
    @State private var errorMessage = ""

    var body: some View {
        ZStack {
            Color.appBackground
                .ignoresSafeArea()

            VStack(spacing: 32) {

                // Dismiss button
                HStack {
                    Spacer()
                    Button(action: onDismiss) {
                        Image(systemName: "xmark")
                            .font(.headline)
                            .foregroundStyle(Color.appSecondaryText)
                            .padding(10)
                            .background(Color.appSurface)
                            .clipShape(Circle())
                    }
                    .accessibilityLabel("Fermer")
                }

                Spacer()

                // Logo / Icon
                VStack(spacing: 16) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 24)
                            .fill(Color.appYellow.opacity(0.12))
                            .frame(width: 88, height: 88)
                        RoundedRectangle(cornerRadius: 24)
                            .stroke(Color.appYellow.opacity(0.25), lineWidth: 1)
                            .frame(width: 88, height: 88)
                        Image(systemName: "chart.pie.fill")
                            .font(.system(size: 40))
                            .foregroundStyle(Color.appYellow)
                    }

                    VStack(spacing: 6) {
                        Text("BudgetFlow")
                            .font(.largeTitle.bold())
                            .foregroundStyle(Color.appText)

                        Text("Gérez votre budget en toute simplicité")
                            .font(.subheadline)
                            .foregroundStyle(Color.appSecondaryText)
                            .multilineTextAlignment(.center)
                    }
                }

                Spacer()

                // Error message
                if !errorMessage.isEmpty {
                    HStack(spacing: 8) {
                        Image(systemName: "exclamationmark.circle.fill")
                            .foregroundStyle(.red)
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(.red)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .padding(12)
                    .background(Color.red.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(Color.red.opacity(0.3), lineWidth: 1)
                    )
                    .transition(.move(edge: .top).combined(with: .opacity))
                }

                // Google Sign-In Button
                Button(action: {
                    Task {
                        await performGoogleSignIn()
                    }
                }) {
                    HStack(spacing: 12) {
                        if isLoading {
                            ProgressView()
                                .tint(Color.appText)
                                .scaleEffect(0.9)
                        } else {
                            // Google "G" logo using SF Symbol approximation
                            Image(systemName: "globe")
                                .font(.system(size: 18, weight: .medium))
                                .foregroundStyle(Color.appText)
                        }
                        Text(isLoading ? "Connexion en cours..." : "Continuer avec Google")
                            .font(.body.weight(.semibold))
                            .foregroundStyle(Color.appText)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(Color.appSurface)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                    .overlay(
                        RoundedRectangle(cornerRadius: 14)
                            .stroke(Color.appBorder, lineWidth: 1)
                    )
                    .scaleEffect(isLoading ? 0.98 : 1.0)
                    .animation(.spring(response: 0.3, dampingFraction: 0.7), value: isLoading)
                }
                .disabled(isLoading)
                .accessibilityLabel("Se connecter avec Google")

                // Legal note
                Text("En vous connectant, vos données sont stockées de façon sécurisée via Firebase.")
                    .font(.caption2)
                    .foregroundStyle(Color.appSecondaryText)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 8)
                    .padding(.bottom, 8)
            }
            .padding(24)
            .animation(.spring(response: 0.35, dampingFraction: 0.75), value: errorMessage)

            // Loading overlay
            if isLoading {
                Color.black.opacity(0.35)
                    .ignoresSafeArea()
                    .allowsHitTesting(true)
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
                errorMessage = "Erreur de connexion Google. Veuillez réessayer."
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
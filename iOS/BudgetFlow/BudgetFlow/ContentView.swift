import SwiftUI
import SwiftData
import FirebaseAuth

struct ContentView: View {
    @Query private var userSettings: [UserSettings]
    @Environment(\.modelContext) private var modelContext
    @Environment(SyncService.self) private var syncService
    @Environment(FirebaseManager.self) private var firebaseManager
    @AppStorage("isOnboarded") private var isOnboarded = false

    /// Affiché pendant la vérification Firestore au démarrage
    @State private var isCheckingOnlineData = false

    var body: some View {
        ZStack {
            if isCheckingOnlineData {
                ZStack {
                    Color.appBackground.ignoresSafeArea()
                    ProgressView()
                        .tint(Color.appAccent)
                }
                .transition(.opacity)
            } else if isOnboarded {
                MainTabView()
                    .transition(.asymmetric(
                        insertion: .move(edge: .bottom).combined(with: .opacity),
                        removal: .opacity
                    ))
                    .task {
                        guard let settings = userSettings.first,
                              settings.isOnlineMode,
                              !settings.firebaseUserId.isEmpty else { return }
                        try? await syncService.loadFromFirestore(
                            userId: settings.firebaseUserId,
                            into: modelContext
                        )
                    }
            } else {
                OnboardingWrapper()
                    .transition(.asymmetric(
                        insertion: .move(edge: .bottom).combined(with: .opacity),
                        removal: .opacity
                    ))
            }
        }
        .animation(.smooth(duration: 0.5), value: isCheckingOnlineData)
        .animation(.smooth(duration: 0.55), value: isOnboarded)
        // Déclenché une seule fois quand Firebase a fini de restaurer sa session
        .onChange(of: firebaseManager.isAuthLoaded) { _, loaded in
            guard loaded, !isOnboarded, let user = firebaseManager.currentUser else { return }
            Task { await checkAndLoadFirestoreData(for: user.uid) }
        }
    }

    /// Vérifie si des données existent sur Firestore pour cet utilisateur.
    /// Si oui, les charge et passe directement au Dashboard sans onboarding.
    @MainActor
    private func checkAndLoadFirestoreData(for userId: String) async {
        isCheckingOnlineData = true
        defer { isCheckingOnlineData = false }

        guard await syncService.checkDataExists(for: userId) else { return }

        do {
            try await syncService.loadFromFirestore(userId: userId, into: modelContext)
            let descriptor = FetchDescriptor<UserSettings>()
            if let settings = try? modelContext.fetch(descriptor).first {
                settings.isOnlineMode = true
                settings.firebaseUserId = userId
                settings.isOnboarded = true
                try? modelContext.save()
            }
            isOnboarded = true
        } catch {
#if DEBUG
            print("ContentView: Firestore load error: \(error)")
#endif
        }
    }
}

struct OnboardingWrapper: View {
    @Environment(\.modelContext) private var modelContext
    @Query private var existingSettings: [UserSettings]
    @State private var tempSettings: UserSettings?

    var body: some View {
        if let settings = tempSettings {
            OnboardingView(settings: Binding(
                get: { settings },
                set: { tempSettings = $0 }
            ))
        } else {
            ProgressView()
                .onAppear {
                    if let first = existingSettings.first {
                        tempSettings = first
                    } else {
                        let newSettings = UserSettings()
                        modelContext.insert(newSettings)
                        tempSettings = newSettings
                    }
                }
        }
    }
}

#Preview {
    ContentView()
        .modelContainer(for: [UserSettings.self, Envelope.self, Transaction.self], inMemory: true)
        .environment(SyncService())
}


import SwiftUI
import SwiftData

struct ContentView: View {
    @Query private var userSettings: [UserSettings]
    @Environment(\.modelContext) private var modelContext
    @AppStorage("isOnboardingCompleted") private var isOnboardingCompleted = false

    var body: some View {
        Group {
            if isOnboardingCompleted {
                MainTabView()
            } else {
                OnboardingWrapper()
            }
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
}


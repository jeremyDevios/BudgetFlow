import SwiftUI
import SwiftData

struct ContentView: View {
    @Query private var userSettings: [UserSettings]
    @Environment(\.modelContext) private var modelContext
    
    // Check if onboarding is done either via @AppStorage or checking if settings exist
    // Using AppStorage for simple boolean flag is common for onboarding
    @AppStorage("isOnboardingCompleted") private var isOnboardingCompleted = false

    var body: some View {
        Group {
            if isOnboardingCompleted {
                // If settings exist, pass them, otherwise we might have an issue
                // But Onboarding should have created one. 
                DashboardView()
            } else {
                // Pass a binding to a new settings object or handle creation in Onboarding
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
                    // Check if we already have one
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


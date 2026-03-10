import SwiftUI
import SwiftData
import FirebaseCore

@main
struct BudgetFlowApp: App {
    @State private var firebaseManager: FirebaseManager
    @State private var syncService: SyncService

    init() {
        if FirebaseApp.app() == nil {
            guard
                let plistPath = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist"),
                let options = FirebaseOptions(contentsOfFile: plistPath)
            else {
                fatalError("Missing GoogleService-Info.plist in app bundle. Add it to the BudgetFlow target (Copy Bundle Resources).")
            }

            FirebaseApp.configure(options: options)
        }

        _firebaseManager = State(initialValue: FirebaseManager())
        _syncService = State(initialValue: SyncService())
    }

    var sharedModelContainer: ModelContainer = {
        let schema = Schema([
            UserSettings.self,
            Envelope.self,
            Transaction.self
        ])
        let modelConfiguration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)
        do {
            return try ModelContainer(for: schema, configurations: [modelConfiguration])
        } catch {
            fatalError("Could not create ModelContainer: \(error)")
        }
    }()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(firebaseManager)
                .environment(syncService)
        }
        .modelContainer(sharedModelContainer)
    }
}

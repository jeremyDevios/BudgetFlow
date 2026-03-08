import SwiftUI
import SwiftData

struct MainTabView: View {
    var body: some View {
        TabView {
            Tab("Budget", systemImage: "rectangle.3.group.fill") {
                NavigationStack {
                    DashboardView()
                }
            }

            Tab("Historique", systemImage: "list.bullet.rectangle") {
                NavigationStack {
                    HistoryView()
                }
            }

            Tab("Évolution", systemImage: "chart.line.uptrend.xyaxis") {
                NavigationStack {
                    EvolutionView()
                }
            }

            Tab("Cash Flow", systemImage: "arrow.left.arrow.right") {
                NavigationStack {
                    CashFlowView()
                }
            }
        }
        .preferredColorScheme(.dark)
        .tint(Color.appYellow)
    }
}

#Preview {
    MainTabView()
        .modelContainer(for: [UserSettings.self, Envelope.self, Transaction.self], inMemory: true)
}

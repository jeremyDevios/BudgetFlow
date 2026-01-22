import SwiftUI
import SwiftData

struct EnvelopeDetailView: View {
    @Bindable var envelope: Envelope
    @Environment(\.modelContext) private var modelContext
    
    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                // Header Area
                VStack(spacing: 15) {
                    Image(systemName: envelope.icon)
                        .font(.system(size: 50))
                        .foregroundColor(.white)
                        .padding(20)
                        .background(Color(hex: envelope.color))
                        .clipShape(Circle())
                        .shadow(radius: 5)
                    
                    VStack(spacing: 5) {
                        Text(envelope.name)
                            .font(.largeTitle)
                            .bold()
                        
                        Text("\(envelope.spent, format: .currency(code: "EUR"))")
                            .font(.title2)
                            .bold()
                            .foregroundColor(envelope.spent > envelope.budget ? .red : .primary)
                        + Text(" / \(envelope.budget, format: .currency(code: "EUR"))")
                            .foregroundColor(.secondary)
                    }
                    
                    ProgressView(value: envelope.spent, total: envelope.budget)
                        .tint(Color(hex: envelope.color))
                        .padding(.horizontal, 40)
                        .scaleEffect(x: 1, y: 2, anchor: .center)
                }
                .padding(.vertical, 30)
                
                // Transactions List
                VStack(alignment: .leading) {
                    Text("Historique")
                        .font(.headline)
                        .padding(.horizontal)
                        .padding(.bottom, 10)
                    
                    if envelope.transactions.isEmpty {
                        VStack {
                            Spacer()
                            Text("Aucune dépense pour ce mois")
                                .foregroundColor(.secondary)
                                .frame(maxWidth: .infinity)
                            Spacer()
                        }
                        .frame(height: 100)
                    } else {
                        // Group by date logic could go here, for now simple list
                        ForEach(envelope.transactions.sorted(by: { $0.date > $1.date })) { transaction in
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(transaction.note.isEmpty ? "Dépense" : transaction.note)
                                        .font(.body)
                                        .bold()
                                    Text(transaction.date, format: .dateTime.day().month().year())
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                                
                                Spacer()
                                
                                Text("- \(transaction.amount, format: .currency(code: "EUR"))")
                                    .font(.body)
                                    .bold()
                                    .foregroundColor(.red)
                            }
                            .padding()
                            .background(Color(UIColor.secondarySystemBackground))
                            .cornerRadius(12)
                            .padding(.horizontal)
                            .padding(.vertical, 4)
                        }
                        .onDelete(perform: deleteTransaction)
                    }
                }
            }
        }
        .navigationTitle(envelope.name)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                EditButton() // Or custom edit sheet
            }
        }
    }
    
    private func deleteTransaction(offsets: IndexSet) {
        let sortedTransactions = envelope.transactions.sorted(by: { $0.date > $1.date })
        for index in offsets {
            let transaction = sortedTransactions[index]
            envelope.spent -= transaction.amount
            modelContext.delete(transaction)
        }
    }
}

#Preview {
    let config = ModelConfiguration(isStoredInMemoryOnly: true)
    let container = try! ModelContainer(for: Envelope.self, configurations: config)
    let envelope = Envelope(name: "Courses", icon: "cart", color: "FF0000", budget: 500, orderIndex: 0)
    container.mainContext.insert(envelope)
    
    return EnvelopeDetailView(envelope: envelope)
        .modelContainer(container)
}

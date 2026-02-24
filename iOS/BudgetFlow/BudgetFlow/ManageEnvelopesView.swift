import SwiftUI
import SwiftData

struct ManageEnvelopesView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Envelope.orderIndex) private var envelopes: [Envelope]
    @State private var showingAddEnvelope = false
    
    var body: some View {
        List {
            ForEach(envelopes) { envelope in
                HStack {
                    EnvelopeIconView(icon: envelope.icon, colorString: envelope.color, size: 32)
                    Text(envelope.name)
                    Spacer()
                    Text(envelope.budget, format: .currency(code: "EUR"))
                }
            }
            .onMove(perform: moveEnvelopes)
            .onDelete(perform: deleteEnvelopes)
        }
        .navigationTitle("Mes Enveloppes")
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                EditButton()
            }
            ToolbarItem(placement: .primaryAction) {
                Button(action: { showingAddEnvelope = true }) {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showingAddEnvelope) {
            AddEnvelopeView()
        }
    }
    
    private func deleteEnvelopes(offsets: IndexSet) {
        withAnimation {
            for index in offsets {
                modelContext.delete(envelopes[index])
            }
        }
    }
    
    private func moveEnvelopes(from source: IndexSet, to destination: Int) {
        var revisedItems = envelopes
        revisedItems.move(fromOffsets: source, toOffset: destination)
        
        // Update orderIndex
        for (index, item) in revisedItems.enumerated() {
            item.orderIndex = index
        }
    }
}

#Preview {
    ManageEnvelopesView()
        .modelContainer(for: Envelope.self, inMemory: true)
}

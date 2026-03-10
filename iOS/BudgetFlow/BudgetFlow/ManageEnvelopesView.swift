import SwiftUI
import SwiftData

struct ManageEnvelopesView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(SyncService.self) private var syncService
    @Query(sort: \Envelope.order) private var envelopes: [Envelope]
    @Query private var userSettingsList: [UserSettings]
    @State private var showingAddEnvelope = false
    @State private var editingEnvelope: Envelope? = nil

    var body: some View {
        List {
            ForEach(envelopes) { envelope in
                HStack(spacing: 12) {
                    EnvelopeIconView(icon: envelope.icon, colorString: envelope.color, size: 36)

                    VStack(alignment: .leading, spacing: 2) {
                        Text(envelope.name)
                            .font(.body)
                        Text(envelope.budget, format: .currency(code: "EUR"))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    Spacer()

                    Button {
                        editingEnvelope = envelope
                    } label: {
                        Label("Modifier", systemImage: "pencil")
                            .font(.caption.bold())
                            .foregroundColor(.appYellow)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(Color.appYellow.opacity(0.15))
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
                .padding(.vertical, 4)
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
        .sheet(item: $editingEnvelope) { envelope in
            EnvelopeEditSheet(envelope: envelope)
        }
    }

    private func deleteEnvelopes(offsets: IndexSet) {
        let toDelete = offsets.map { envelopes[$0] }
        let idsToDelete = toDelete.map { $0.firestoreId }
        withAnimation {
            for envelope in toDelete {
                modelContext.delete(envelope)
            }
        }

        if let settings = userSettingsList.first,
           settings.isOnlineMode,
           !settings.firebaseUserId.isEmpty {
            let userId = settings.firebaseUserId
            Task {
                for id in idsToDelete where !id.isEmpty {
                    await syncService.deleteEnvelope(firestoreId: id, userId: userId)
                }
            }
        }
    }

    private func moveEnvelopes(from source: IndexSet, to destination: Int) {
        var revisedItems = envelopes
        revisedItems.move(fromOffsets: source, toOffset: destination)
        for (index, item) in revisedItems.enumerated() {
            item.order = index
        }

        if let settings = userSettingsList.first,
           settings.isOnlineMode,
           !settings.firebaseUserId.isEmpty {
            let userId = settings.firebaseUserId
            let changed = revisedItems
            Task {
                for envelope in changed {
                    try? await syncService.syncEnvelope(envelope, userId: userId)
                }
            }
        }
    }
}

#Preview {
    ManageEnvelopesView()
        .modelContainer(for: Envelope.self, inMemory: true)
}

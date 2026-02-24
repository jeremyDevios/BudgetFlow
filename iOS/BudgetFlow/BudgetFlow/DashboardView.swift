import SwiftUI
import SwiftData

struct DashboardView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Envelope.orderIndex) private var envelopes: [Envelope]
    @Query private var transactions: [Transaction]
    @Query private var userSettings: [UserSettings]
    
    @State private var showingAddTransaction = false
    @State private var showingSettings = false
    @State private var selectedMonth = Date()
    
    var settings: UserSettings? {
        userSettings.first
    }
    
    var totalBudget: Double {
        envelopes.reduce(0) { $0 + $1.budget }
    }
    
    var totalSpent: Double {
        envelopes.reduce(0) { $0 + ($1.spent) } // Verify if spent is updated correctly
    }
    
    var remainingAvailable: Double {
        guard let s = settings else { return 0 }
        return s.monthlyIncome - s.fixedCosts - s.monthlySavings - totalSpent
    }
    
    var progress: Double {
        guard settings != nil else { return 0 }
        _ = totalBudget // Or total available for envelopes
        // Logic: if budget is arbitrary, just sum of envelopes? 
        // In screenshots: "Reste Disponible 156.56 / 1000 prévus". 
        // It seems 1000 is the sum of envelopes budgets? Or remaining after fixed costs?
        // Let's assume user tracks envelope spending against envelope budgets.
        // But the big dashboard card might be Global "Left to Spend" based on (Income - Fixed - Savings) -> "Reste à vivre"
        
        // Let's stick to the screenshot: "Reste Disponible ... Sur 1000€ prévus".
        // 1000 seems to be the total of envelopes budgets.
        return totalBudget > 0 ? totalSpent / totalBudget : 0
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // Header Month Selector
                    HStack {
                        Button(action: { changeMonth(-1) }) {
                            Image(systemName: "chevron.left")
                        }
                        Text(selectedMonth, format: .dateTime.month(.wide).year())
                            .font(.headline)
                        Button(action: { changeMonth(1) }) {
                            Image(systemName: "chevron.right")
                        }
                        Spacer()
                        Button(action: { showingSettings = true }) {
                            Image(systemName: "gear")
                        }
                    }
                    .padding()
                    
                    // Main Card
                    VStack {
                        Text("RESTE DISPONIBLE")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        
                        Text(remainingAvailable, format: .currency(code: "EUR"))
                            .font(.system(size: 34, weight: .bold))
                            .foregroundStyle(self.progress > 1.0 ? Color(.systemRed) : Color(.systemOrange))
                        
                        Text("Sur \(totalBudget, format: .currency(code: "EUR")) prévus")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        
                        // Progress Bar
                        GeometryReader { geometry in
                            ZStack(alignment: .leading) {
                                Rectangle()
                                    .frame(width: geometry.size.width, height: 12)
                                    .opacity(0.3)
                                    .foregroundColor(.gray)
                                    .cornerRadius(6)
                                
                                Rectangle()
                                    .frame(width: min(CGFloat(self.progress) * geometry.size.width, geometry.size.width), height: 12)
                                    .foregroundColor(self.progress > 1.0 ? .red : .orange)
                                    .cornerRadius(6)
                            }
                        }
                        .frame(height: 12)
                        .padding(.top, 10)
                        
                        HStack {
                            Text("Dépenses : \(totalSpent, format: .currency(code: "EUR"))")
                            Spacer()
                            Text("\(Int(progress * 100))%")
                        }
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .padding(.top, 5)
                    }
                    .padding()
                    .background(Color(UIColor.secondarySystemBackground))
                    .cornerRadius(20)
                    .padding(.horizontal)
                    
                    // Envelopes List
                    VStack(alignment: .leading) {
                        Text("Mes Enveloppes")
                            .font(.headline)
                            .padding(.horizontal)
                        
                        ForEach(envelopes) { envelope in
                            NavigationLink(destination: EnvelopeDetailView(envelope: envelope)) {
                                EnvelopeRow(envelope: envelope)
                            }
                            .buttonStyle(PlainButtonStyle())
                        }
                    }
                }
            }
            .navigationTitle("")
            .toolbar {
                ToolbarItem(placement: .bottomBar) {
                    Button(action: { showingAddTransaction = true }) {
                        Image(systemName: "plus.circle.fill")
                            .resizable()
                            .frame(width: 50, height: 50)
                            .foregroundColor(.orange)
                    }
                }
            }
            .sheet(isPresented: $showingAddTransaction) {
                 AddTransactionView(envelopes: envelopes)
            }
            .sheet(isPresented: $showingSettings) {
                if let s = settings {
                    SettingsView(settings: s)
                }
            }
        }
    }
    
    func changeMonth(_ value: Int) {
        if let newDate = Calendar.current.date(byAdding: .month, value: value, to: selectedMonth) {
            selectedMonth = newDate
        }
    }
}

struct EnvelopeRow: View {
    @Bindable var envelope: Envelope
    
    var body: some View {
        HStack {
            EnvelopeIconView(icon: envelope.icon, colorString: envelope.color, size: 50)
            
            VStack(alignment: .leading) {
                Text(envelope.name)
                    .font(.headline)
                
                Text("\(envelope.spent, format: .currency(code: "EUR"))")
                    .font(.title3)
                    .bold()
                
                ProgressView(value: envelope.spent, total: envelope.budget)
                    .tint(Color.fromString(envelope.color))
            }
            Spacer()
            
            VStack(alignment: .trailing) {
                Image(systemName: "ellipsis")
                    .foregroundColor(.gray)
                Spacer()
                Text("sur \(envelope.budget, format: .currency(code: "EUR"))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        } // End HStack
        .padding()
        .background(Color(UIColor.secondarySystemBackground))
        .cornerRadius(15)
        .padding(.horizontal)
        .padding(.vertical, 4)
    }
}

#Preview {
    DashboardView()
        .modelContainer(for: [UserSettings.self, Envelope.self, Transaction.self], inMemory: true)
}

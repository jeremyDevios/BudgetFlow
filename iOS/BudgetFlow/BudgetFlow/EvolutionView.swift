import SwiftUI
import Charts
import SwiftData

struct MonthSummary: Identifiable {
    let month: Date
    let label: String
    let totalSpent: Double
    let remaining: Double

    var id: Date { month }
}

struct EvolutionView: View {
    @Query private var allTransactions: [Transaction]
    @Query private var userSettings: [UserSettings]

    private var settings: UserSettings? { userSettings.first }

    private var monthlyData: [MonthSummary] {
        guard let settings else { return [] }

        let available = settings.monthlyIncome - settings.fixedCosts - settings.monthlySavings
        let calendar = Calendar.current

        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "fr_FR")
        formatter.dateFormat = "MMM"

        let today = Date()
        let currentMonthStart = calendar.startOfMonth(for: today)

        return (0..<12)
            .compactMap { offset -> MonthSummary? in
                guard let monthStart = calendar.date(byAdding: .month, value: -offset, to: currentMonthStart) else {
                    return nil
                }

                let monthEnd = calendar.endOfMonth(for: monthStart)
                let totalSpent = allTransactions
                    .filter { $0.date >= monthStart && $0.date <= monthEnd }
                    .reduce(0) { partialResult, transaction in
                        partialResult + transaction.amount
                    }

                guard totalSpent > 0 || offset == 0 else { return nil }

                return MonthSummary(
                    month: monthStart,
                    label: formatter.string(from: monthStart),
                    totalSpent: totalSpent,
                    remaining: available - totalSpent
                )
            }
            .reversed()
    }

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(hex: "18181B"), Color(hex: "09090B")],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            if settings == nil {
                ProgressView()
            } else {
                ScrollView {
                    VStack(spacing: 24) {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Reste disponible")
                                .font(.headline)
                                .foregroundStyle(.white)

                            Chart(monthlyData) { summary in
                                AreaMark(
                                    x: .value("Mois", summary.month, unit: .month),
                                    y: .value("Reste", summary.remaining)
                                )
                                .foregroundStyle(
                                    LinearGradient(
                                        colors: [Color.appYellow.opacity(0.35), .clear],
                                        startPoint: .top,
                                        endPoint: .bottom
                                    )
                                )
                                .interpolationMethod(.catmullRom)

                                LineMark(
                                    x: .value("Mois", summary.month, unit: .month),
                                    y: .value("Reste", summary.remaining)
                                )
                                .foregroundStyle(Color.appYellow)
                                .lineStyle(StrokeStyle(lineWidth: 2.5, lineCap: .round))
                                .interpolationMethod(.catmullRom)

                                PointMark(
                                    x: .value("Mois", summary.month, unit: .month),
                                    y: .value("Reste", summary.remaining)
                                )
                                .foregroundStyle(summary.remaining >= 0 ? Color.appGreen : Color.red)
                                .symbolSize(40)

                                RuleMark(y: .value("Zéro", 0))
                                    .foregroundStyle(.white.opacity(0.2))
                                    .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 4]))
                            }
                            .chartXAxis {
                                AxisMarks(values: .stride(by: .month)) { _ in
                                    AxisValueLabel(format: .dateTime.month(.abbreviated), centered: true)
                                        .foregroundStyle(Color.secondary)
                                }
                            }
                            .chartYAxis {
                                AxisMarks { value in
                                    AxisValueLabel {
                                        if let amount = value.as(Double.self) {
                                            Text("\(Int(amount))€")
                                                .font(.caption2)
                                                .foregroundStyle(Color.secondary)
                                        }
                                    }
                                    AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5))
                                        .foregroundStyle(.white.opacity(0.08))
                                }
                            }
                            .chartPlotStyle { plot in
                                plot.background(Color.clear)
                            }
                            .frame(height: 220)
                        }
                        .padding(20)
                        .background {
                            ZStack {
                                RoundedRectangle(cornerRadius: 20)
                                    .fill(Color(hex: "1C1C1E"))
                                RoundedRectangle(cornerRadius: 20)
                                    .stroke(.white.opacity(0.08), lineWidth: 1)
                            }
                        }

                        VStack(alignment: .leading, spacing: 8) {
                            Text("Détails mensuels")
                                .font(.headline)
                                .foregroundStyle(.white)
                                .padding(.horizontal, 4)

                            ForEach(monthlyData.reversed()) { summary in
                                MonthSummaryRow(summary: summary)
                            }
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 16)
                    .padding(.bottom, 40)
                }
                .scrollIndicators(.hidden)
            }
        }
        .navigationTitle("Évolution")
        .navigationBarTitleDisplayMode(.large)
        .toolbarBackground(.ultraThinMaterial, for: .navigationBar)
    }
}

private struct MonthSummaryRow: View {
    let summary: MonthSummary

    var body: some View {
        HStack {
            Rectangle()
                .fill(summary.remaining >= 0 ? Color.appGreen : Color.red)
                .frame(width: 3, height: 32)
                .clipShape(Capsule())

            VStack(alignment: .leading, spacing: 2) {
                Text(summary.label)
                    .font(.subheadline.bold())
                    .foregroundStyle(.white)
                    .textCase(.uppercase)
            }
            .frame(width: 50, alignment: .leading)

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                Text("Dépenses")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Text(summary.totalSpent, format: .currency(code: "EUR"))
                    .font(.subheadline.bold())
                    .foregroundStyle(Color.appYellow)
            }

            Divider()
                .frame(height: 28)
                .padding(.horizontal, 8)

            VStack(alignment: .trailing, spacing: 2) {
                Text("Économie")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Text(summary.remaining, format: .currency(code: "EUR"))
                    .font(.subheadline.bold())
                    .foregroundStyle(summary.remaining >= 0 ? Color.appGreen : Color.red)
            }
        }
        .padding(12)
        .background {
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(hex: "1C1C1E"))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(.white.opacity(0.06), lineWidth: 1)
                )
        }
    }
}

#Preview {
    NavigationStack {
        EvolutionView()
    }
    .modelContainer(for: [UserSettings.self, Envelope.self, Transaction.self], inMemory: true)
    .preferredColorScheme(.dark)
}

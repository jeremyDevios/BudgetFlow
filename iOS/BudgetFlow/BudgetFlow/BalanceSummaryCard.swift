import SwiftUI

struct BalanceSummaryCard: View {
    @Environment(\.colorScheme) private var colorScheme
    let currentMonthBalance: Double
    let availablePlanned: Double
    let totalSpentThisMonth: Double
    let globalProgress: Double
    let envelopes: [Envelope]
    let spentPerEnvelope: [UUID: Double]

    var body: some View {
        ZStack(alignment: .topTrailing) {
            // Fond adaptatif
            RoundedRectangle(cornerRadius: 24)
                .fill(
                    colorScheme == .dark
                        ? LinearGradient(
                            colors: [Color(red: 0.08, green: 0.08, blue: 0.10), Color(red: 0.05, green: 0.05, blue: 0.06)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                        : LinearGradient(
                            colors: [Color(.systemGray5), Color(.systemGray6)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                )

            // Amber radial glow (meme dans les deux modes, legerement adapte)
            RadialGradient(
                colors: [
                    Color(red: 0.961, green: 0.620, blue: 0.043)
                        .opacity(colorScheme == .dark ? 0.35 : 0.25),
                    Color.clear
                ],
                center: .topTrailing,
                startRadius: 0,
                endRadius: 180
            )
            .clipShape(RoundedRectangle(cornerRadius: 24))

            // Pas de stroke border

            // Content
            VStack(spacing: 6) {
                Text("Reste disponible")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)
                    .tracking(1)

                Text(currentMonthBalance, format: .currency(code: "EUR"))
                    .font(.system(size: 40, weight: .bold, design: .rounded))
                    .foregroundStyle(currentMonthBalance < 0 ? Color(uiColor: .systemRed) : Color.appText)
                    .contentTransition(.numericText())

                Text("Sur \(Int(availablePlanned)) € prévus")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                // Global progress bar
                GlobalProgressBar(
                    progress: globalProgress,
                    totalSpent: totalSpentThisMonth
                )
                .padding(.top, 12)

                // Envelope segment bar
                if !envelopes.isEmpty && totalSpentThisMonth > 0 {
                    EnvelopeSegmentBar(
                        envelopes: envelopes,
                        spentPerEnvelope: spentPerEnvelope,
                        totalSpent: totalSpentThisMonth
                    )
                    .padding(.top, 4)
                }
            }
            .padding(20)
            .frame(maxWidth: .infinity)
        }
        .frame(maxWidth: .infinity)
        .clipShape(RoundedRectangle(cornerRadius: 24))
    }
}

// MARK: - Global Progress Bar

private struct GlobalProgressBar: View {
    @Environment(\.colorScheme) private var colorScheme
    let progress: Double
    let totalSpent: Double

    var barColor: LinearGradient {
        progress > 1.0
            ? LinearGradient(colors: [.red, Color(hex: "FF6B6B")], startPoint: .leading, endPoint: .trailing)
            : LinearGradient(colors: [Color(hex: "F59E0B"), Color(hex: "EA580C")], startPoint: .leading, endPoint: .trailing)
    }

    var body: some View {
        VStack(spacing: 4) {
            HStack {
                Text("Dépenses : \(totalSpent, format: .currency(code: "EUR"))")
                Spacer()
                Text("\(Int(min(progress * 100, 999)))%")
            }
            .font(.caption)
            .foregroundStyle(.secondary)

            Capsule()
                .fill(colorScheme == .dark ? Color.white.opacity(0.12) : Color.black.opacity(0.12))
                .frame(height: 10)
                .overlay(alignment: .leading) {
                    GeometryReader { geo in
                        Capsule()
                            .fill(barColor)
                            .frame(width: geo.size.width * min(progress, 1.0))
                            .animation(.easeOut(duration: 0.6), value: progress)
                    }
                }
        }
    }
}

// MARK: - Envelope Segment Bar

private struct EnvelopeSegmentBar: View {
    let envelopes: [Envelope]
    let spentPerEnvelope: [UUID: Double]
    let totalSpent: Double

    var body: some View {
        GeometryReader { geo in
            HStack(spacing: 2) {
                ForEach(envelopes) { env in
                    let spent = spentPerEnvelope[env.id, default: 0]
                    let proportion = totalSpent > 0 ? spent / totalSpent : 0
                    if proportion > 0 {
                        Capsule()
                            .fill(Color.fromString(env.color))
                            .frame(width: max(geo.size.width * proportion - 2, 4))
                    }
                }
            }
        }
        .frame(height: 6)
    }
}

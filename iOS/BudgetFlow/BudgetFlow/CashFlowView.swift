import SwiftUI
import SwiftData

private struct SankeyNode: Identifiable {
    let id = UUID()
    let label: String
    let amount: Double
    let color: Color
}

private struct SankeyLayoutEntry: Identifiable {
    let node: SankeyNode
    let y: CGFloat
    let height: CGFloat

    var id: UUID { node.id }
}

struct CashFlowView: View {
    @Query(sort: \Envelope.orderIndex) private var envelopes: [Envelope]
    @Query private var userSettings: [UserSettings]

    private var settings: UserSettings? { userSettings.first }

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(hex: "18181B"), Color(hex: "09090B")],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            if let settings, settings.monthlyIncome > 0 {
                ScrollView {
                    VStack(spacing: 24) {
                        SankeyDiagramView(settings: settings, envelopes: envelopes)
                            .frame(height: 420)
                            .padding(.horizontal, 16)
                            .padding(.top, 16)

                        let totalAllocated = settings.monthlySavings + settings.fixedCosts + envelopes.reduce(0) { $0 + $1.budget }
                        let unallocated = settings.monthlyIncome - totalAllocated

                        HStack(spacing: 12) {
                            SummaryCard(label: "Revenu Total", amount: settings.monthlyIncome, color: Color.appGreen)
                            SummaryCard(label: "Total Alloué", amount: totalAllocated, color: Color.appYellow)
                        }
                        .padding(.horizontal, 16)

                        if unallocated < 0 {
                            HStack {
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .foregroundStyle(.red)
                                (Text("Budget dépassé de ") + Text(abs(unallocated), format: .currency(code: "EUR")))
                                    .font(.subheadline.bold())
                                    .foregroundStyle(.red)
                            }
                            .padding()
                            .background {
                                RoundedRectangle(cornerRadius: 12)
                                    .fill(Color.red.opacity(0.12))
                                    .stroke(Color.red.opacity(0.4), lineWidth: 1)
                            }
                            .padding(.horizontal, 16)
                        }
                    }
                    .padding(.bottom, 40)
                }
                .scrollIndicators(.hidden)
            } else {
                ContentUnavailableView(
                    "Aucun revenu configuré",
                    systemImage: "arrow.left.arrow.right",
                    description: Text("Configurez votre revenu mensuel dans les paramètres.")
                )
            }
        }
        .navigationTitle("Cash Flow")
        .navigationBarTitleDisplayMode(.large)
        .toolbarBackground(.ultraThinMaterial, for: .navigationBar)
    }
}

private struct SankeyDiagramView: View {
    let settings: UserSettings
    let envelopes: [Envelope]

    private let padding: CGFloat = 16
    private let nodeWidth: CGFloat = 16
    private let nodeGap: CGFloat = 4

    private var rightNodes: [SankeyNode] {
        var nodes: [SankeyNode] = []

        if settings.monthlySavings > 0 {
            nodes.append(
                SankeyNode(
                    label: "Épargne",
                    amount: settings.monthlySavings,
                    color: Color(hex: "3B82F6")
                )
            )
        }

        if settings.fixedCosts > 0 {
            nodes.append(
                SankeyNode(
                    label: "Frais Fixes",
                    amount: settings.fixedCosts,
                    color: Color(hex: "EF4444")
                )
            )
        }

        for envelope in envelopes where envelope.budget > 0 {
            nodes.append(
                SankeyNode(
                    label: envelope.name,
                    amount: envelope.budget,
                    color: Color.fromString(envelope.color)
                )
            )
        }

        let totalAllocated = settings.monthlySavings + settings.fixedCosts + envelopes.reduce(0) { $0 + $1.budget }
        let remaining = settings.monthlyIncome - totalAllocated

        if remaining > 0 {
            nodes.append(
                SankeyNode(
                    label: "Reste",
                    amount: remaining,
                    color: Color(hex: "6B7280")
                )
            )
        }

        return nodes
    }

    var body: some View {
        GeometryReader { geometry in
            let leftFrame = leftNodeFrame(for: geometry.size)
            let rightX = geometry.size.width - padding - nodeWidth
            let entries = layoutEntries(for: geometry.size, nodes: rightNodes)

            Canvas { context, size in
                drawSankey(context: &context, leftFrame: leftFrame, rightX: rightX, entries: entries)
            }
            .background {
                RoundedRectangle(cornerRadius: 20)
                    .fill(Color(hex: "1C1C1E"))
                    .overlay(
                        RoundedRectangle(cornerRadius: 20)
                            .stroke(.white.opacity(0.08), lineWidth: 1)
                    )
            }
            .overlay {
                SankeyLabelsOverlay(
                    settings: settings,
                    leftFrame: leftFrame,
                    rightX: rightX,
                    entries: entries
                )
            }
        }
    }

    private func leftNodeFrame(for size: CGSize) -> CGRect {
        let leftHeight = size.height - padding * 2 - 40
        let leftY = padding + 20
        return CGRect(x: padding, y: leftY, width: nodeWidth, height: leftHeight)
    }

    private func layoutEntries(for size: CGSize, nodes: [SankeyNode]) -> [SankeyLayoutEntry] {
        let income = settings.monthlyIncome
        guard income > 0, !nodes.isEmpty else { return [] }

        let leftFrame = leftNodeFrame(for: size)
        let gapCount = max(nodes.count - 1, 0)
        let totalGapHeight = CGFloat(gapCount) * nodeGap
        let usableHeight = max(leftFrame.height - totalGapHeight, 0)

        var currentY = leftFrame.minY
        var entries: [SankeyLayoutEntry] = []

        for node in nodes {
            let proportion = node.amount / income
            let nodeHeight = max(usableHeight * proportion, 6)
            entries.append(SankeyLayoutEntry(node: node, y: currentY, height: nodeHeight))
            currentY += nodeHeight + nodeGap
        }

        return entries
    }

    private func drawSankey(
        context: inout GraphicsContext,
        leftFrame: CGRect,
        rightX: CGFloat,
        entries: [SankeyLayoutEntry]
    ) {
        guard settings.monthlyIncome > 0 else { return }

        var leftNodePath = Path()
        leftNodePath.addRoundedRect(in: leftFrame, cornerSize: CGSize(width: 4, height: 4))
        context.fill(leftNodePath, with: .color(Color.appGreen))

        var leftCurrentY = leftFrame.minY
        let leftFlowX = leftFrame.maxX
        let curveMidX = leftFlowX + (rightX - leftFlowX) * 0.5

        for entry in entries {
            let flowTopY = leftCurrentY
            let flowBottomY = leftCurrentY + entry.height
            let endTopY = entry.y
            let endBottomY = entry.y + entry.height

            var flowPath = Path()
            flowPath.move(to: CGPoint(x: leftFlowX, y: flowTopY))
            flowPath.addCurve(
                to: CGPoint(x: rightX, y: endTopY),
                control1: CGPoint(x: curveMidX, y: flowTopY),
                control2: CGPoint(x: curveMidX, y: endTopY)
            )
            flowPath.addLine(to: CGPoint(x: rightX, y: endBottomY))
            flowPath.addCurve(
                to: CGPoint(x: leftFlowX, y: flowBottomY),
                control1: CGPoint(x: curveMidX, y: endBottomY),
                control2: CGPoint(x: curveMidX, y: flowBottomY)
            )
            flowPath.closeSubpath()

            context.fill(flowPath, with: .color(entry.node.color.opacity(0.30)))

            var rightNodePath = Path()
            rightNodePath.addRoundedRect(
                in: CGRect(x: rightX, y: entry.y, width: nodeWidth, height: entry.height),
                cornerSize: CGSize(width: 4, height: 4)
            )
            context.fill(rightNodePath, with: .color(entry.node.color))

            leftCurrentY += entry.height
        }
    }
}

private struct SankeyLabelsOverlay: View {
    let settings: UserSettings
    let leftFrame: CGRect
    let rightX: CGFloat
    let entries: [SankeyLayoutEntry]

    var body: some View {
        ZStack(alignment: .topLeading) {
            VStack(alignment: .leading, spacing: 1) {
                Text("Revenu")
                    .font(.caption.bold())
                    .foregroundStyle(Color.appGreen)
                Text(settings.monthlyIncome, format: .currency(code: "EUR"))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            .position(
                x: leftFrame.maxX + 42,
                y: leftFrame.midY
            )

            ForEach(entries) { entry in
                VStack(alignment: .trailing, spacing: 1) {
                    Text(entry.node.label)
                        .font(.caption.bold())
                        .foregroundStyle(entry.node.color)
                    Text(entry.node.amount, format: .currency(code: "EUR"))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                .position(
                    x: rightX - 46,
                    y: entry.y + entry.height / 2
                )
            }
        }
    }
}

private struct SummaryCard: View {
    let label: String
    let amount: Double
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
                .tracking(0.5)

            Text(amount, format: .currency(code: "EUR"))
                .font(.title3.bold())
                .foregroundStyle(color)
        }
        .frame(maxWidth: .infinity)
        .padding(14)
        .background {
            RoundedRectangle(cornerRadius: 14)
                .fill(Color(hex: "1C1C1E"))
                .overlay(
                    RoundedRectangle(cornerRadius: 14)
                        .stroke(.white.opacity(0.08), lineWidth: 1)
                )
        }
    }
}

#Preview {
    NavigationStack {
        CashFlowView()
    }
    .modelContainer(for: [UserSettings.self, Envelope.self, Transaction.self], inMemory: true)
    .preferredColorScheme(.dark)
}

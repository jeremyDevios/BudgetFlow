import SwiftUI

enum StorageMode {
    case offline
    case online
}

struct StorageModeView: View {
    var onBack: () -> Void
    var onOffline: () -> Void
    var onOnline: () -> Void

    @State private var selectedMode: StorageMode? = nil

    var body: some View {
        ZStack {
            Color.appBackground
                .ignoresSafeArea()

            VStack(spacing: 24) {
                Spacer()

                VStack(spacing: 10) {
                    Image(systemName: "externaldrive.badge.icloud")
                        .font(.system(size: 58, weight: .semibold))
                        .foregroundStyle(Color.appYellow)

                    Text("Vos donnees")
                        .font(.system(size: 34, weight: .bold))
                        .foregroundStyle(Color.appText)

                    Text("ou les stocker ?")
                        .font(.system(size: 34, weight: .bold))
                        .foregroundStyle(Color.appYellow)

                    Text("Choisissez comment BudgetFlow stocke vos donnees.")
                        .font(.body)
                        .foregroundStyle(Color.appSecondaryText)
                        .multilineTextAlignment(.center)
                        .padding(.top, 4)
                }
                .padding(.horizontal, 24)

                Spacer()

                HStack(spacing: 12) {
                    modeCard(
                        mode: .offline,
                        icon: "iphone",
                        title: "Hors ligne",
                        subtitle: "Donnees stockees uniquement sur cet appareil."
                    )

                    modeCard(
                        mode: .online,
                        icon: "icloud",
                        title: "En ligne",
                        subtitle: "Synchronisez sur tous vos appareils avec Firebase."
                    )
                }
                .padding(.horizontal, 20)

                Spacer()

                BottomActionBar(
                    backTitle: "Retour",
                    mainTitle: "Continuer",
                    mainIcon: "arrow.right",
                    isMainDisabled: selectedMode == nil,
                    onBack: onBack,
                    onMain: continueAction
                )
            }
        }
    }

    private func continueAction() {
        switch selectedMode {
        case .offline:
            onOffline()
        case .online:
            onOnline()
        case .none:
            break
        }
    }

    @ViewBuilder
    private func modeCard(mode: StorageMode, icon: String, title: String, subtitle: String) -> some View {
        let isSelected = selectedMode == mode

        Button {
            withAnimation(.easeInOut(duration: 0.2)) {
                selectedMode = mode
            }
        } label: {
            VStack(alignment: .leading, spacing: 10) {
                Image(systemName: icon)
                    .font(.system(size: 26, weight: .semibold))
                    .foregroundStyle(Color.appYellow)

                Text(title)
                    .font(.headline)
                    .fontWeight(.bold)
                    .foregroundStyle(Color.appText)

                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(Color.appSecondaryText)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, minHeight: 150, alignment: .topLeading)
            .padding(16)
            .background(isSelected ? Color.appYellow.opacity(0.12) : Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(isSelected ? Color.appYellow : Color.appBorder, lineWidth: isSelected ? 2 : 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 16))
        }
        .buttonStyle(.plain)
    }
}

#Preview {
    StorageModeView(
        onBack: {},
        onOffline: {},
        onOnline: {}
    )
}
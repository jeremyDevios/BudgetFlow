import SwiftUI

extension Color {
    static let appYellow = Color(hex: "F59E0B") // Amber/Orange
    static let appBackground = Color.black
    static let appSurface = Color(hex: "1C1C1E") // Dark Gray
    static let appText = Color.white
    static let appSecondaryText = Color.gray
    static let appGreen = Color(hex: "10B981") // Emerald Green
}

struct PrimaryButton: View {
    let title: String
    let icon: String?
    let action: () -> Void
    var isDisabled: Bool = false
    
    var body: some View {
        Button(action: action) {
            HStack {
                Text(title)
                    .font(.headline)
                    .fontWeight(.bold)
                
                if let icon = icon {
                    Image(systemName: icon)
                        .bold()
                }
            }
            .foregroundColor(isDisabled ? .gray : .white) // Or black text on yellow? Image has white text on orange button usually, but checking image again... actually it looks like white text on orange button. Wait, typically yellow buttons have black text for contrast. Let's look at the image again. Ah, the image provided has White Text on Orange Button.
            .frame(maxWidth: .infinity)
            .padding()
            .background(isDisabled ? Color.gray.opacity(0.3) : Color.appYellow)
            .cornerRadius(12)
        }
        .disabled(isDisabled)
    }
}

struct AppTextField: View {
    let title: String
    let icon: String
    @Binding var value: Double?
    let subtitle: String?
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(.appYellow)
                Text(title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(.appText)
                
                if let subtitle = subtitle {
                     Text(subtitle)
                        .font(.caption)
                        .foregroundColor(.appSecondaryText)
                }
            }
            
            HStack {
                Text("€")
                    .foregroundColor(.appSecondaryText)
                    .padding(.leading)
                
                TextField("0", value: $value, format: .number)
                    .keyboardType(.decimalPad)
                    .foregroundColor(.appText)
                    .font(.title3)
                
                // Chevron up/down mimic (just visual or stepped)
                // The image shows up/down arrows, likely a Stepper or custom control. 
                // For now just standard text field with visual cue if needed
                Image(systemName: "arrow.up.arrow.down")
                    .foregroundColor(.gray)
                    .padding(.trailing)
            }
            .padding(.vertical, 12)
            .background(Color.appSurface)
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.white.opacity(0.1), lineWidth: 1)
            )
        }
    }
}

// Progress Bar Component
struct OnboardingProgressBar: View {
    var step: Int
    var totalSteps: Int
    
    var body: some View {
        HStack(spacing: 4) {
            ForEach(1...totalSteps, id: \.self) { index in
                Rectangle()
                    .fill(index <= step ? Color.appYellow : Color.gray.opacity(0.3))
                    .frame(height: 4)
                    .cornerRadius(2)
            }
        }
    }
}
// MARK: - Color Helper
extension Color {
    /// Converts a color name (like "Blue", "Orange") or hex string to a Color
    static func fromString(_ colorString: String) -> Color {
        // Check if it's a color name first
        switch colorString.lowercased() {
        case "blue": return .blue
        case "orange": return .orange
        case "green": return .green
        case "red": return .red
        case "purple": return .purple
        case "pink": return .pink
        case "indigo": return .indigo
        case "teal": return .teal
        case "brown": return .brown
        case "cyan": return .cyan
        case "yellow": return .yellow
        case "mint": return .mint
        case "gray", "grey": return .gray
        default:
            // If not a color name, try to parse as hex
            return Color(hex: colorString)
        }
    }
}

// MARK: - Envelope Icon Component
struct EnvelopeIconView: View {
    let icon: String
    let colorString: String
    let size: CGFloat
    
    init(icon: String, colorString: String, size: CGFloat = 48) {
        self.icon = icon
        self.colorString = colorString
        self.size = size
    }
    
    var body: some View {
        ZStack {
            Circle()
                .fill(Color.fromString(colorString))
                .frame(width: size, height: size)
            Image(systemName: icon)
                .foregroundColor(.white)
                .font(.system(size: size * 0.42)) // ~42% of circle size
        }
    }
}
import SwiftUI
import UIKit

extension Color {
    // Couleurs adaptatives Light/Dark
    static let appBackground = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.035, green: 0.035, blue: 0.043, alpha: 1) // #09090B
            : UIColor(red: 0.980, green: 0.980, blue: 0.973, alpha: 1) // #FAFAF9
    })

    static let appSurface = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.110, green: 0.110, blue: 0.118, alpha: 1) // #1C1C1E
            : UIColor(red: 1.0, green: 1.0, blue: 1.0, alpha: 1)       // #FFFFFF
    })

    static let appText = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor.white
            : UIColor(red: 0.094, green: 0.094, blue: 0.106, alpha: 1) // #18181B
    })

    static let appSecondaryText = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.631, green: 0.631, blue: 0.671, alpha: 1) // #A1A1AA
            : UIColor(red: 0.443, green: 0.443, blue: 0.482, alpha: 1) // #71717A
    })

    static let appBorder = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor.white.withAlphaComponent(0.08)
            : UIColor.black.withAlphaComponent(0.08)
    })

    static let appAccent = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.961, green: 0.620, blue: 0.043, alpha: 1) // #F59E0B amber
            : UIColor(red: 0.961, green: 0.620, blue: 0.043, alpha: 1) // #F59E0B amber
    })

    // Garde appYellow pour compatibilite avec le code existant (pointe vers appAccent)
    static let appYellow = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.961, green: 0.620, blue: 0.043, alpha: 1)
            : UIColor(red: 0.961, green: 0.620, blue: 0.043, alpha: 1)
    })

    static let appGreen = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.063, green: 0.725, blue: 0.506, alpha: 1) // #10B981
            : UIColor(red: 0.022, green: 0.588, blue: 0.412, alpha: 1) // #059669
    })

    static let lucideToSFSymbol: [String: String] = [
        "ShoppingCart":  "cart",
        "Fuel":          "fuelpump",
        "Utensils":      "fork.knife",
        "Plane":         "airplane",
        "Heart":         "heart",
        "Gamepad2":      "gamecontroller",
        "Bus":           "bus.fill",
        "Shirt":         "tshirt",
        "Music":         "music.note",
        "Coffee":        "cup.and.saucer",
        "Briefcase":     "briefcase",
        "GraduationCap": "graduationcap",
        "Baby":          "figure.and.child.holdinghands",
        "PawPrint":      "pawprint",
        "Gift":          "gift",
        "Smartphone":    "iphone",
        "Wifi":          "wifi",
        "Zap":           "bolt.fill",
        "Droplets":      "drop.fill",
        "Hammer":        "hammer",
        "Home":          "house",
        "Car":           "car",
        "Train":         "tram",
        "Bike":          "bicycle",
        "DollarSign":    "dollarsign.circle",
        "CreditCard":    "creditcard",
        "ShoppingBag":   "bag",
        "Package":       "shippingbox",
        "Star":          "star",
        "Sun":           "sun.max",
        "Moon":          "moon",
        "Cloud":         "cloud",
        "Camera":        "camera",
        "Book":          "book",
        "Pill":          "pill",
        "Dumbbell":      "dumbbell",
        "Pizza":         "fork.knife.circle",
        "Apple":         "applelogo"
    ]

    static let tailwindToHex: [String: String] = [
        "bg-amber-500":   "F59E0B",
        "bg-amber-400":   "FBBF24",
        "bg-blue-500":    "3B82F6",
        "bg-blue-600":    "2563EB",
        "bg-blue-400":    "60A5FA",
        "bg-green-500":   "22C55E",
        "bg-green-400":   "4ADE80",
        "bg-emerald-500": "10B981",
        "bg-emerald-400": "34D399",
        "bg-red-500":     "EF4444",
        "bg-red-400":     "F87171",
        "bg-rose-500":    "F43F5E",
        "bg-rose-400":    "FB7185",
        "bg-purple-500":  "A855F7",
        "bg-purple-600":  "9333EA",
        "bg-purple-400":  "C084FC",
        "bg-pink-500":    "EC4899",
        "bg-pink-400":    "F472B6",
        "bg-fuchsia-500": "D946EF",
        "bg-indigo-500":  "6366F1",
        "bg-indigo-600":  "4F46E5",
        "bg-indigo-400":  "818CF8",
        "bg-teal-500":    "14B8A6",
        "bg-teal-400":    "2DD4BF",
        "bg-cyan-500":    "06B6D4",
        "bg-cyan-400":    "22D3EE",
        "bg-sky-500":     "0EA5E9",
        "bg-sky-400":     "38BDF8",
        "bg-orange-500":  "F97316",
        "bg-orange-400":  "FB923C",
        "bg-yellow-500":  "EAB308",
        "bg-yellow-400":  "FACC15",
        "bg-lime-500":    "84CC16",
        "bg-zinc-500":    "71717A",
        "bg-gray-500":    "6B7280",
        "bg-slate-500":   "64748B",
        "bg-violet-500":  "8B5CF6"
    ]
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
            .background(isDisabled ? Color.gray.opacity(0.3) : Color.appAccent)
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
                    .foregroundColor(.appAccent)
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
                    .stroke(Color.appBorder, lineWidth: 1)
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
                    .fill(index <= step ? Color.appAccent : Color.gray.opacity(0.3))
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
        if let hex = tailwindToHex[colorString] {
            return Color(hex: hex)
        }

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
            Image(systemName: Color.lucideToSFSymbol[icon] ?? icon)
                .foregroundColor(.white)
                .font(.system(size: size * 0.42)) // ~42% of circle size
        }
    }
}
import XCTest
import SwiftUI
@testable import BudgetFlow

// MARK: - Color.fromString Tests

final class ColorFromStringTests: XCTestCase {

    private func colorComponents(_ color: Color) -> (r: CGFloat, g: CGFloat, b: CGFloat) {
        var r: CGFloat = 0; var g: CGFloat = 0; var b: CGFloat = 0; var a: CGFloat = 0
        UIColor(color).getRed(&r, green: &g, blue: &b, alpha: &a)
        return (r, g, b)
    }

    func test_fromString_tailwindAmber_matchesHex() {
        let c1 = Color.fromString("bg-amber-500")
        let c2 = Color(hex: "F59E0B")
        let (r1, g1, b1) = colorComponents(c1)
        let (r2, g2, b2) = colorComponents(c2)
        XCTAssertEqual(r1, r2, accuracy: 0.02)
        XCTAssertEqual(g1, g2, accuracy: 0.02)
        XCTAssertEqual(b1, b2, accuracy: 0.02)
    }

    func test_fromString_tailwindBlue_matchesHex() {
        let c1 = Color.fromString("bg-blue-500")
        let c2 = Color(hex: "3B82F6")
        let (r1, _, _) = colorComponents(c1)
        let (r2, _, _) = colorComponents(c2)
        XCTAssertEqual(r1, r2, accuracy: 0.02)
    }

    func test_fromString_tailwindRed_matchesHex() {
        let c1 = Color.fromString("bg-red-500")
        let c2 = Color(hex: "EF4444")
        let (r1, _, _) = colorComponents(c1)
        let (r2, _, _) = colorComponents(c2)
        XCTAssertEqual(r1, r2, accuracy: 0.02)
    }

    func test_fromString_namedBlue_hasBluishComponent() {
        let (_, _, b) = colorComponents(Color.fromString("blue"))
        XCTAssertGreaterThan(b, 0.3, "Named 'blue' should have a blue component")
    }

    func test_fromString_namedOrange_hasRedOrangeComponent() {
        let (r, _, _) = colorComponents(Color.fromString("orange"))
        XCTAssertGreaterThan(r, 0.7, "Named 'orange' should have strong red component")
    }

    func test_fromString_namedGreen_hasGreenDominant() {
        let (r, g, _) = colorComponents(Color.fromString("green"))
        XCTAssertGreaterThan(g, r, "Named 'green' should have green dominant")
    }

    func test_fromString_namedGrey_equalToGray() {
        let (r1, g1, b1) = colorComponents(Color.fromString("gray"))
        let (r2, g2, b2) = colorComponents(Color.fromString("grey"))
        XCTAssertEqual(r1, r2, accuracy: 0.02)
        XCTAssertEqual(g1, g2, accuracy: 0.02)
        XCTAssertEqual(b1, b2, accuracy: 0.02)
    }

    func test_fromString_namedBlue_caseInsensitive() {
        let (r1, _, b1) = colorComponents(Color.fromString("blue"))
        let (r2, _, b2) = colorComponents(Color.fromString("BLUE"))
        XCTAssertEqual(r1, r2, accuracy: 0.02)
        XCTAssertEqual(b1, b2, accuracy: 0.02)
    }

    func test_fromString_hexFallback_parsesRGB() {
        // "00FF00" not in tailwindToHex and not a named color → fallback to Color(hex:)
        let (r, g, b) = colorComponents(Color.fromString("00FF00"))
        XCTAssertEqual(r, 0.0, accuracy: 0.02)
        XCTAssertEqual(g, 1.0, accuracy: 0.02)
        XCTAssertEqual(b, 0.0, accuracy: 0.02)
    }

    func test_fromString_purple_isNotBlue() {
        let (_, _, b_blue) = colorComponents(Color.fromString("blue"))
        let (_, _, b_purple) = colorComponents(Color.fromString("purple"))
        // Purple should have less blue than pure blue
        XCTAssertLessThan(b_purple, b_blue)
    }

    func test_fromString_tailwindGreen_matchesHex() {
        let c1 = Color.fromString("bg-green-500")
        let c2 = Color(hex: "22C55E")
        let (_, g1, _) = colorComponents(c1)
        let (_, g2, _) = colorComponents(c2)
        XCTAssertEqual(g1, g2, accuracy: 0.02)
    }
}

// MARK: - tailwindToHex Dictionary Tests

final class TailwindToHexTests: XCTestCase {

    func test_tailwindToHex_amber_correctHex() {
        XCTAssertEqual(Color.tailwindToHex["bg-amber-500"], "F59E0B")
    }

    func test_tailwindToHex_blue_correctHex() {
        XCTAssertEqual(Color.tailwindToHex["bg-blue-500"], "3B82F6")
    }

    func test_tailwindToHex_green_correctHex() {
        XCTAssertEqual(Color.tailwindToHex["bg-green-500"], "22C55E")
    }

    func test_tailwindToHex_red_correctHex() {
        XCTAssertEqual(Color.tailwindToHex["bg-red-500"], "EF4444")
    }

    func test_tailwindToHex_unknownKey_returnsNil() {
        XCTAssertNil(Color.tailwindToHex["bg-unknown-999"])
    }

    func test_tailwindToHex_hasAtLeast30Entries() {
        XCTAssertGreaterThanOrEqual(Color.tailwindToHex.count, 30,
            "tailwindToHex should have a comprehensive color palette")
    }

    func test_tailwindToHex_allValues_are6CharHex() {
        for (key, hex) in Color.tailwindToHex {
            XCTAssertEqual(hex.count, 6, "Hex for '\(key)' should be 6 chars, got '\(hex)'")
            XCTAssertTrue(hex.allSatisfy(\.isHexDigit),
                "Hex '\(hex)' for '\(key)' must contain only hex characters")
        }
    }

    func test_tailwindToHex_emerald_exists() {
        XCTAssertNotNil(Color.tailwindToHex["bg-emerald-500"])
    }

    func test_tailwindToHex_orange_exists() {
        XCTAssertNotNil(Color.tailwindToHex["bg-orange-500"])
    }
}

// MARK: - lucideToSFSymbol Dictionary Tests

final class LucideToSFSymbolTests: XCTestCase {

    func test_lucideToSFSymbol_shoppingCart_isCart() {
        XCTAssertEqual(Color.lucideToSFSymbol["ShoppingCart"], "cart")
    }

    func test_lucideToSFSymbol_fuel_isFuelpump() {
        XCTAssertEqual(Color.lucideToSFSymbol["Fuel"], "fuelpump")
    }

    func test_lucideToSFSymbol_heart_isHeart() {
        XCTAssertEqual(Color.lucideToSFSymbol["Heart"], "heart")
    }

    func test_lucideToSFSymbol_gamepad_isGamecontroller() {
        XCTAssertEqual(Color.lucideToSFSymbol["Gamepad2"], "gamecontroller")
    }

    func test_lucideToSFSymbol_unknownKey_returnsNil() {
        XCTAssertNil(Color.lucideToSFSymbol["NonExistentIcon123"])
    }

    func test_lucideToSFSymbol_nilFallback_usesOriginalName() {
        // EnvelopeIconView uses: Color.lucideToSFSymbol[icon] ?? icon
        let sfSymbol = Color.lucideToSFSymbol["UnknownIcon"] ?? "UnknownIcon"
        XCTAssertEqual(sfSymbol, "UnknownIcon")
    }

    func test_lucideToSFSymbol_hasAtLeast15Entries() {
        XCTAssertGreaterThanOrEqual(Color.lucideToSFSymbol.count, 15)
    }

    func test_lucideToSFSymbol_home_isHouse() {
        XCTAssertEqual(Color.lucideToSFSymbol["Home"], "house")
    }
}

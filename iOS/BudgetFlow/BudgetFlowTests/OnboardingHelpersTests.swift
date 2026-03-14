import XCTest
@testable import BudgetFlow

// MARK: - convertToDouble Helper Tests

final class ConvertToDoubleTests: XCTestCase {

    func test_convertToDouble_periodDecimal_returnsDouble() {
        XCTAssertEqual(convertToDouble("12.50") ?? 0, 12.50, accuracy: 0.001)
    }

    func test_convertToDouble_commaDecimal_returnsDouble() {
        // French locale uses comma as decimal separator — must be normalized
        XCTAssertEqual(convertToDouble("12,50") ?? 0, 12.50, accuracy: 0.001)
    }

    func test_convertToDouble_integerString_returnsDouble() {
        XCTAssertEqual(convertToDouble("300") ?? 0, 300.0, accuracy: 0.001)
    }

    func test_convertToDouble_emptyString_returnsNil() {
        XCTAssertNil(convertToDouble(""))
    }

    func test_convertToDouble_invalidText_returnsNil() {
        XCTAssertNil(convertToDouble("abc"))
    }

    func test_convertToDouble_zeroString_returnsZero() {
        XCTAssertEqual(convertToDouble("0") ?? -1, 0.0, accuracy: 0.001)
    }

    func test_convertToDouble_largeAmount_parsesCorrectly() {
        XCTAssertEqual(convertToDouble("9999.99") ?? 0, 9999.99, accuracy: 0.001)
    }

    func test_convertToDouble_negativeNumber_returnsNegative() {
        XCTAssertEqual(convertToDouble("-50") ?? 0, -50.0, accuracy: 0.001)
    }

    func test_convertToDouble_leadingZero_parsesCorrectly() {
        XCTAssertEqual(convertToDouble("0.50") ?? 0, 0.50, accuracy: 0.001)
    }

    func test_convertToDouble_commaLargeAmount_parsesCorrectly() {
        XCTAssertEqual(convertToDouble("1500,00") ?? 0, 1500.0, accuracy: 0.001)
    }
}

// MARK: - TempEnvelope Model Tests

@MainActor
final class TempEnvelopeTests: XCTestCase {

    func test_tempEnvelope_init_allFieldsStored() {
        let env = TempEnvelope(name: "Courses", icon: "cart", color: "bg-green-500", amount: 300)
        XCTAssertEqual(env.name, "Courses")
        XCTAssertEqual(env.icon, "cart")
        XCTAssertEqual(env.color, "bg-green-500")
        XCTAssertEqual(env.amount, 300, accuracy: 0.001)
    }

    func test_tempEnvelope_uniqueId_eachInstance() {
        let e1 = TempEnvelope(name: "A", icon: "cart", color: "blue", amount: 100)
        let e2 = TempEnvelope(name: "B", icon: "cart", color: "blue", amount: 100)
        XCTAssertNotEqual(e1.id, e2.id, "Each TempEnvelope should have a unique UUID")
    }

    func test_tempEnvelope_identifiable_idIsUUID() {
        let env = TempEnvelope(name: "Test", icon: "tray", color: "gray", amount: 50)
        // id must exist and be a UUID (Identifiable conformance)
        XCTAssertNotNil(env.id)
    }

    func test_tempEnvelope_equatable_sameInstance() {
        let e1 = TempEnvelope(name: "A", icon: "cart", color: "blue", amount: 100)
        let copy = e1  // Copy of same struct
        XCTAssertEqual(e1, copy)
    }

    func test_tempEnvelope_equatable_differentInstances_notEqual() {
        let e1 = TempEnvelope(name: "A", icon: "cart", color: "blue", amount: 100)
        let e2 = TempEnvelope(name: "A", icon: "cart", color: "blue", amount: 100)
        // Even with identical fields, IDs are different UUIDs
        XCTAssertNotEqual(e1, e2)
    }

    func test_tempEnvelope_nameMutation() {
        var env = TempEnvelope(name: "Old", icon: "tray", color: "gray", amount: 50)
        env.name = "New Name"
        XCTAssertEqual(env.name, "New Name")
    }

    func test_tempEnvelope_amountMutation() {
        var env = TempEnvelope(name: "Test", icon: "tray", color: "gray", amount: 100)
        env.amount = 250
        XCTAssertEqual(env.amount, 250, accuracy: 0.001)
    }

    func test_tempEnvelope_zeroAmount() {
        let env = TempEnvelope(name: "Free", icon: "gift", color: "green", amount: 0)
        XCTAssertEqual(env.amount, 0.0, accuracy: 0.001)
    }
}

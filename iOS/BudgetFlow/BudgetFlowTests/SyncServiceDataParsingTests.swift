import XCTest
import FirebaseFirestore
@testable import BudgetFlow

// MARK: - parseDate Tests

final class ParseDateTests: XCTestCase {

    func test_parseDate_iso8601WithMilliseconds() {
        let input = "2026-03-10T15:30:00.000Z"
        let result = parseDate(input)
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        let comps = cal.dateComponents([.year, .month, .day, .hour, .minute, .second], from: result)
        XCTAssertEqual(comps.year, 2026)
        XCTAssertEqual(comps.month, 3)
        XCTAssertEqual(comps.day, 10)
        XCTAssertEqual(comps.hour, 15)
        XCTAssertEqual(comps.minute, 30)
        XCTAssertEqual(comps.second, 0)
    }

    func test_parseDate_iso8601WithoutMilliseconds() {
        let input = "2026-01-15T08:00:00Z"
        let result = parseDate(input)
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        let comps = cal.dateComponents([.year, .month, .day, .hour], from: result)
        XCTAssertEqual(comps.year, 2026)
        XCTAssertEqual(comps.month, 1)
        XCTAssertEqual(comps.day, 15)
        XCTAssertEqual(comps.hour, 8)
    }

    func test_parseDate_firestoreTimestamp() {
        let seconds: Int64 = 1234567890
        let ts = Timestamp(seconds: seconds, nanoseconds: 0)
        let result = parseDate(ts)
        XCTAssertEqual(result.timeIntervalSince1970, Double(seconds), accuracy: 1.0)
    }

    func test_parseDate_nilInput_fallsBackToNow() {
        let before = Date()
        let result = parseDate(nil)
        let after = Date()
        XCTAssertGreaterThanOrEqual(result, before.addingTimeInterval(-2))
        XCTAssertLessThanOrEqual(result, after.addingTimeInterval(2))
    }

    func test_parseDate_invalidString_fallsBackToNow() {
        let before = Date()
        let result = parseDate("not-a-date")
        let after = Date()
        XCTAssertGreaterThanOrEqual(result, before.addingTimeInterval(-2))
        XCTAssertLessThanOrEqual(result, after.addingTimeInterval(2))
    }

    func test_parseDate_emptyString_fallsBackToNow() {
        let before = Date()
        let result = parseDate("")
        let after = Date()
        XCTAssertGreaterThanOrEqual(result, before.addingTimeInterval(-2))
        XCTAssertLessThanOrEqual(result, after.addingTimeInterval(2))
    }
}

// MARK: - isoString Tests

final class IsoStringTests: XCTestCase {

    func test_isoString_epochDate_producesExpectedString() {
        let epoch = Date(timeIntervalSince1970: 0)
        let result = isoString(epoch)
        XCTAssertEqual(result, "1970-01-01T00:00:00Z")
    }

    func test_isoString_roundtrip_parseAndReSerialize() {
        let original = Date(timeIntervalSince1970: 1000000)
        let serialized = isoString(original)
        let reparsed = parseDate(serialized)
        XCTAssertEqual(reparsed.timeIntervalSince1970, original.timeIntervalSince1970, accuracy: 1.0)
    }

    func test_isoString_producesValidISO8601Format() {
        let date = Date()
        let result = isoString(date)
        XCTAssertTrue(result.hasSuffix("Z"), "ISO string should end with Z: \(result)")
        XCTAssertTrue(result.contains("T"), "ISO string should contain T separator: \(result)")
        XCTAssertEqual(result.count, 20, "ISO string should be 20 chars (e.g. 2026-03-10T08:00:00Z): \(result)")
    }
}

// MARK: - firestoreDouble Tests

final class FirestoreDoubleTests: XCTestCase {

    func test_firestoreDouble_withDoubleValue_returnsDouble() {
        let data: [String: Any] = ["amount": Double(3.14)]
        XCTAssertEqual(firestoreDouble(data, "amount", fallback: 0), 3.14, accuracy: 0.001)
    }

    func test_firestoreDouble_withIntValue_convertsToDouble() {
        let data: [String: Any] = ["budget": Int(42)]
        XCTAssertEqual(firestoreDouble(data, "budget", fallback: 0), 42.0, accuracy: 0.001)
    }

    func test_firestoreDouble_withInt64Value_convertsToDouble() {
        let data: [String: Any] = ["balance": Int64(9_999_999_999)]
        XCTAssertEqual(firestoreDouble(data, "balance", fallback: 0), 9_999_999_999.0, accuracy: 1.0)
    }

    func test_firestoreDouble_missingKey_returnsFallback() {
        let data: [String: Any] = ["other": 1.0]
        XCTAssertEqual(firestoreDouble(data, "missing", fallback: 99.9), 99.9, accuracy: 0.001)
    }

    func test_firestoreDouble_wrongType_returnsFallback() {
        let data: [String: Any] = ["amount": "not-a-number"]
        XCTAssertEqual(firestoreDouble(data, "amount", fallback: 7.5), 7.5, accuracy: 0.001)
    }
}

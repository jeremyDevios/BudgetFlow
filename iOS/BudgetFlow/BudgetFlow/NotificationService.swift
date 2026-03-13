import Foundation
import UserNotifications

final class NotificationService {
    static let shared = NotificationService()
    private init() {}

    private func identifier(for weekday: Int) -> String {
        "budgetflow-weekly-\(weekday)"
    }

    // MARK: - Permission

    func requestPermission() async -> Bool {
        do {
            return try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .sound, .badge])
        } catch {
            return false
        }
    }

    func currentAuthorizationStatus() async -> UNAuthorizationStatus {
        await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
    }

    // MARK: - Scheduling

    /// days: Set<Int> avec valeurs Calendar.weekday (1=Dimanche, 2=Lundi, …, 7=Samedi)
    func scheduleWeeklyNotifications(
        days: Set<Int>,
        hour: Int,
        minute: Int,
        todayExpenses: Double,
        todayCount: Int,
        currency: String = "EUR"
    ) {
        guard !days.isEmpty else {
            cancelAllNotifications()
            return
        }

        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(
            withIdentifiers: (1...7).map { identifier(for: $0) }
        )

        let todayWeekday = Calendar.current.component(.weekday, from: Date())

        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = currency
        formatter.maximumFractionDigits = 2

        for day in days {
            let content = UNMutableNotificationContent()
            content.title = "BudgetFlow - Rappel de dépenses"
            content.sound = .default

            if day == todayWeekday {
                let amountStr = formatter.string(from: NSNumber(value: todayExpenses)) ?? "\(todayExpenses)\(currency)"
                content.body = "Aujourd'hui : \(amountStr) dépensés en \(todayCount) transaction(s). N'oubliez pas de saisir vos dépenses !"
            } else {
                content.body = "N'oubliez pas de saisir vos dépenses du jour !"
            }

            var components = DateComponents()
            components.weekday = day
            components.hour = hour
            components.minute = minute

            let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: true)
            let request = UNNotificationRequest(
                identifier: identifier(for: day),
                content: content,
                trigger: trigger
            )
            center.add(request) { _ in } // erreur silencieuse acceptable
        }
    }

    // MARK: - Cancellation

    func cancelAllNotifications() {
        UNUserNotificationCenter.current().removePendingNotificationRequests(
            withIdentifiers: (1...7).map { identifier(for: $0) }
        )
    }
}

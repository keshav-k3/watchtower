import AppIntents
import WidgetKit

struct ProviderEntity: AppEntity, Hashable {
    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Provider")
    static var defaultQuery = ProviderEntityQuery()

    var id: String
    var name: String

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: LocalizedStringResource(stringLiteral: name))
    }
}

struct ProviderEntityQuery: EntityQuery {
    func entities(for identifiers: [ProviderEntity.ID]) async throws -> [ProviderEntity] {
        let snapshot = WidgetSnapshot.load()
        return identifiers.map { identifier in
            let name = snapshot.providers.first { $0.id == identifier }?.name ?? identifier
            return ProviderEntity(id: identifier, name: name)
        }
    }

    func suggestedEntities() async throws -> [ProviderEntity] {
        WidgetSnapshot.load().providers.map { provider in
            ProviderEntity(id: provider.id, name: provider.name)
        }
    }
}

struct WatchtowerWidgetIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Usage"
    static var description = IntentDescription("Choose which providers to show.")
    static var isDiscoverable: Bool { false }

    @Parameter(title: "Provider")
    var provider: ProviderEntity?

    @Parameter(title: "Providers")
    var providers: [ProviderEntity]?

    func perform() async throws -> some IntentResult {
        .result()
    }
}

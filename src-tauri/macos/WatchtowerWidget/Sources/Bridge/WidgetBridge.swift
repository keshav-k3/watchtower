import Foundation
import WidgetKit

/// Called from the Watchtower process after it writes a usage snapshot.
/// Return codes: 0 written and reload requested, 1 reload requested but the
/// App Group folder could not be written, 2 the JSON pointer was unusable.
@_cdecl("watchtower_widget_write_and_reload")
public func watchtowerWidgetWriteAndReload(_ jsonPtr: UnsafePointer<CChar>?) -> Int32 {
    guard let jsonPtr else { return 2 }
    let json = String(cString: jsonPtr)
    guard !json.isEmpty, json.utf8.count < 1_000_000 else { return 2 }

    let wrote = writeSnapshot(json)
    DispatchQueue.main.async {
        if #available(macOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
    }
    return wrote ? 0 : 1
}

private func writeSnapshot(_ json: String) -> Bool {
    let fileManager = FileManager.default
    guard let directory = fileManager.containerURL(
        forSecurityApplicationGroupIdentifier: WidgetContract.appGroupID
    ) else {
        return false
    }

    do {
        try fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
        let destination = directory.appendingPathComponent(WidgetContract.snapshotFileName)
        let temporary = directory.appendingPathComponent(".widget-snapshot.json.tmp")
        try json.write(to: temporary, atomically: true, encoding: .utf8)
        if fileManager.fileExists(atPath: destination.path) {
            try fileManager.removeItem(at: destination)
        }
        try fileManager.moveItem(at: temporary, to: destination)
        return true
    } catch {
        return false
    }
}

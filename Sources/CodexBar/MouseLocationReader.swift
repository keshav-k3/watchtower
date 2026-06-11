import AppKit
import SwiftUI

/// Lightweight NSView-based mouse tracking with local coordinates.
///
/// Why: SwiftUI's `onHover` doesn't provide location, but we want "hover a bar to see values" on macOS.
@MainActor
struct MouseLocationReader: NSViewRepresentable {
    let onMoved: (CGPoint?) -> Void

    func makeNSView(context: Context) -> TrackingView {
        let view = TrackingView()
        view.onMoved = self.onMoved
        return view
    }

    func updateNSView(_ nsView: TrackingView, context: Context) {
        nsView.onMoved = self.onMoved
    }

    final class TrackingView: NSView {
        private static let minimumDeliveredMoveDistance: CGFloat = 2

        var onMoved: ((CGPoint?) -> Void)?
        private var trackingArea: NSTrackingArea?
        private var pendingLocation: CGPoint?
        private var lastEmittedLocation: CGPoint?
        private var isMoveDeliveryScheduled = false

        override var isFlipped: Bool {
            true
        }

        override func viewDidMoveToWindow() {
            super.viewDidMoveToWindow()
            self.window?.acceptsMouseMovedEvents = true
            self.updateTrackingAreas()
        }

        override func updateTrackingAreas() {
            super.updateTrackingAreas()
            if let trackingArea {
                self.removeTrackingArea(trackingArea)
            }

            let options: NSTrackingArea.Options = [
                // NSMenu popups aren't "key windows", so `.activeInKeyWindow` would drop events and cause hover
                // state to flicker. `.activeAlways` keeps tracking stable while the menu is open.
                .activeAlways,
                .inVisibleRect,
                .mouseEnteredAndExited,
                .mouseMoved,
            ]
            let area = NSTrackingArea(rect: .zero, options: options, owner: self, userInfo: nil)
            self.addTrackingArea(area)
            self.trackingArea = area
        }

        override func mouseEntered(with event: NSEvent) {
            super.mouseEntered(with: event)
            self.scheduleMoveDelivery(self.convert(event.locationInWindow, from: nil))
        }

        override func mouseMoved(with event: NSEvent) {
            super.mouseMoved(with: event)
            self.scheduleMoveDelivery(self.convert(event.locationInWindow, from: nil))
        }

        override func mouseExited(with event: NSEvent) {
            super.mouseExited(with: event)
            self.scheduleMoveDelivery(nil)
        }

        private func scheduleMoveDelivery(_ location: CGPoint?) {
            self.pendingLocation = location
            guard !self.isMoveDeliveryScheduled else { return }

            self.isMoveDeliveryScheduled = true
            DispatchQueue.main.async { [weak self] in
                guard let self else { return }
                self.isMoveDeliveryScheduled = false
                let location = self.pendingLocation
                self.pendingLocation = nil
                self.deliverMove(location)
            }
        }

        private func deliverMove(_ location: CGPoint?) {
            if let location {
                if let lastEmittedLocation,
                   location.distance(to: lastEmittedLocation) < Self.minimumDeliveredMoveDistance
                {
                    return
                }
                self.lastEmittedLocation = location
                self.onMoved?(location)
            } else {
                guard self.lastEmittedLocation != nil else { return }
                self.lastEmittedLocation = nil
                self.onMoved?(nil)
            }
        }
    }
}

extension CGPoint {
    fileprivate func distance(to other: CGPoint) -> CGFloat {
        hypot(self.x - other.x, self.y - other.y)
    }
}

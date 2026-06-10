// swift-tools-version: 6.2
import CompilerPluginSupport
import Foundation
import PackageDescription

let sweetCookieKitPath = "../SweetCookieKit"
let useLocalSweetCookieKit =
    ProcessInfo.processInfo.environment["WATCHTOWER_USE_LOCAL_SWEETCOOKIEKIT"] == "1"
let sweetCookieKitDependency: Package.Dependency =
    useLocalSweetCookieKit && FileManager.default.fileExists(atPath: sweetCookieKitPath)
    ? .package(path: sweetCookieKitPath)
    : .package(url: "https://github.com/steipete/SweetCookieKit", from: "0.4.1")

let package = Package(
    name: "Watchtower",
    defaultLocalization: "en",
    platforms: [
        .macOS(.v14),
    ],
    products: [
        .library(name: "CodexBarCore", targets: ["CodexBarCore"]),
        .executable(name: "Watchtower", targets: ["CodexBar"]),
    ],
    dependencies: [
        .package(url: "https://github.com/apple/swift-crypto.git", from: "3.0.0"),
        .package(url: "https://github.com/apple/swift-log", from: "1.12.0"),
        .package(url: "https://github.com/apple/swift-syntax", from: "600.0.1"),
        .package(url: "https://github.com/swiftlang/swift-testing", from: "0.11.0"),
        sweetCookieKitDependency,
    ],
    targets: [
        .target(
            name: "CodexBarCore",
            dependencies: [
                "CodexBarMacroSupport",
                .product(name: "Crypto", package: "swift-crypto"),
                .product(name: "Logging", package: "swift-log"),
                .product(name: "SweetCookieKit", package: "SweetCookieKit"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .macro(
            name: "CodexBarMacros",
            dependencies: [
                .product(name: "SwiftCompilerPlugin", package: "swift-syntax"),
                .product(name: "SwiftSyntaxBuilder", package: "swift-syntax"),
                .product(name: "SwiftSyntaxMacros", package: "swift-syntax"),
            ]),
        .target(
            name: "CodexBarMacroSupport",
            dependencies: [
                "CodexBarMacros",
            ]),
        .executableTarget(
            name: "CodexBar",
            dependencies: [
                "CodexBarMacroSupport",
                "CodexBarCore",
            ],
            path: "Sources/CodexBar",
            resources: [
                .process("Resources"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "CodexBarTests",
            dependencies: [
                "CodexBar",
                "CodexBarCore",
                .product(name: "Testing", package: "swift-testing"),
            ],
            path: "Tests",
            resources: [
                .copy("CodexBarTests/Fixtures"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])

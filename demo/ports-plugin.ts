import { type Plugin } from "vite"
import { spawn, type ChildProcess } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const PORT = 8765

export function demoPortsPlugin(): Plugin {
  let child: ChildProcess | null = null
  const root = join(tmpdir(), "watchtower-demo-server")

  const user = process.env.USER || "ubuntu"
  // Shapes taken from a real Mac: full executable paths, one process on many ports.
  const samples = [
    ...[2300, 3100, 3101, 3102].map((port) => ({
      port, pid: 3543, processName: "/opt/podman/bin/gvproxy", user, cwd: "/", project: null, system: false, selfProcess: false,
    })),
    ...[5000, 7000].map((port) => ({
      port, pid: 612, processName: "/System/Library/CoreServices/ControlCenter.app/Contents/MacOS/ControlCenter", user, cwd: "/", project: null, system: true, selfProcess: false,
    })),
    { port: 5476, pid: 8812, processName: "/Applications/KiroCrew.app/Contents/Resources/dist/kirocrew-backend-arm64/bin/python3.12", user, cwd: "/", project: null, system: false, selfProcess: false },
    { port: 6736, pid: 9120, processName: "/Applications/Watchtower.app/Contents/MacOS/watchtower", user, cwd: "/", project: null, system: false, selfProcess: true },
    { port: 7265, pid: 701, processName: "/Applications/Raycast.app/Contents/MacOS/Raycast", user, cwd: "/", project: null, system: false, selfProcess: false },
    { port: 9222, pid: 9304, processName: "/Applications/Google Chrome.app/Contents/Frameworks/Google Chrome Framework.framework/Helpers/Google Chrome Helper.app/Contents/MacOS/Google Chrome Helper", user, cwd: "/", project: null, system: false, selfProcess: false },
  ]

  const snapshot = () => {
    if (!child?.pid || child.exitCode !== null) return samples
    return [
      ...samples,
      {
        port: PORT,
        pid: child.pid,
        processName: "python3",
        user,
        cwd: root,
        project: "demo-server",
        system: false,
        selfProcess: false,
      },
    ]
  }

  return {
    name: "watchtower-demo-ports",
    configureServer(server) {
      mkdirSync(root, { recursive: true })
      writeFileSync(join(root, "package.json"), JSON.stringify({ name: "demo-server" }))
      child = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], {
        cwd: root,
        stdio: "ignore",
      })
      child.on("exit", () => {
        child = null
      })

      server.middlewares.use("/__demo/ports", (_req, res) => {
        res.setHeader("content-type", "application/json")
        res.end(JSON.stringify({ supported: true, note: null, ports: snapshot() }))
      })
      server.middlewares.use("/__demo/stop", (req, res) => {
        let body = ""
        req.on("data", (chunk) => {
          body += chunk
        })
        req.on("end", () => {
          const payload = body ? JSON.parse(body) as { pid?: number; force?: boolean } : {}
          if (child?.pid && payload.pid === child.pid) {
            child.kill(payload.force ? "SIGKILL" : "SIGTERM")
          }
          res.setHeader("content-type", "application/json")
          res.end(JSON.stringify({ ok: true }))
        })
      })
    },
  }
}

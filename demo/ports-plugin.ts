import { type Plugin } from "vite"
import { spawn, type ChildProcess } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const PORT = 8765

export function demoPortsPlugin(): Plugin {
  let child: ChildProcess | null = null
  const root = join(tmpdir(), "watchtower-demo-server")

  const snapshot = () => {
    if (!child?.pid || child.exitCode !== null) return []
    return [
      {
        port: PORT,
        pid: child.pid,
        processName: "python3",
        user: process.env.USER || "ubuntu",
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

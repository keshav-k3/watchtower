# Ports

The Ports view lists TCP ports that are listening on this computer.

There is one row per process, with every port it listens on grouped together. Each row shows:

- A short name: the app name for anything inside an `.app` bundle (`Raycast`, `Google Chrome`), otherwise the binary name (`gvproxy`, `node`). A helper binary with a different name is shown next to it in grey
- Its ports, lowest first
- Process id, in small type
- Project name from `package.json` when that file is in the working directory, otherwise the folder name

Hover a row to see the full executable path. Click it to expand the path, working directory and user. If the working directory cannot be read, or is just `/`, the expanded row says "Not available". Nothing is invented.

Rows are ordered by their lowest port.

System and root processes are hidden until **Show System** is turned on. Watchtower never offers to stop itself.

**Stop** sits at the right edge of the row. It asks for confirmation (showing the process id and every port that will close), then sends the process a normal shutdown signal. If it is still listening on the next refresh, **Force Stop** is offered and asks again before ending it immediately.

The list refreshes every few seconds while the view is open.

On macOS and Linux this uses `lsof`. On Windows the view says that listing ports is not available.

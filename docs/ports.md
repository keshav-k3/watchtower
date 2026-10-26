# Ports

The Ports view lists TCP ports that are listening on this computer.

Each row shows:

- Port number
- Process name
- Process id
- Working directory, when the system will tell us
- Project name from `package.json` when that file is in the working directory, otherwise the folder name

If the working directory cannot be read, the row says so. Nothing is invented.

System and root processes are hidden until **Show System** is turned on. Watchtower never offers to stop itself.

**Stop** asks for confirmation, then sends the process a normal shutdown signal. If it is still listening on the next refresh, **Force Stop** is offered and asks again before ending it immediately.

The list refreshes every few seconds while the view is open.

On macOS and Linux this uses `lsof`. On Windows the view says that listing ports is not available.

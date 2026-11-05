// Native macOS notification. Asks for permission the first time; failures are
// logged, never thrown, so an alert can't break a refresh.
export async function sendNativeNotification(title: string, body: string): Promise<void> {
  try {
    const mod = await import("@tauri-apps/plugin-notification")
    let granted = await mod.isPermissionGranted()
    if (!granted) {
      granted = (await mod.requestPermission()) === "granted"
    }
    if (!granted) {
      console.error(`Notification permission was denied: ${title}`)
      return
    }
    mod.sendNotification({ title, body })
  } catch (error) {
    console.error(`Failed to send notification: ${title}`, error)
  }
}

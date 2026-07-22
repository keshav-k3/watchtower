const key = (() => {
  let next = 0
  return () => String(next++)
})()

const path = (d, attrs = {}) => ["path", { key: key(), d, fill: "currentColor", ...attrs }]
const circle = (attrs) => ["circle", { key: key(), fill: "currentColor", ...attrs }]
const rect = (attrs) => ["rect", { key: key(), fill: "currentColor", ...attrs }]

export const DashboardSquare02Icon = [
  rect({ x: 3, y: 3, width: 8, height: 8, rx: 2 }),
  rect({ x: 13, y: 3, width: 8, height: 8, rx: 2 }),
  rect({ x: 3, y: 13, width: 8, height: 8, rx: 2 }),
  rect({ x: 13, y: 13, width: 8, height: 8, rx: 2 }),
]

export const DashboardSpeed01Icon = [
  path("M12 3a9 9 0 0 0-9 9c0 2.2.78 4.22 2.08 5.8.35.43.99.47 1.39.09.4-.37.43-.99.09-1.42A6.95 6.95 0 0 1 5 12a7 7 0 1 1 12.44 4.47c-.34.43-.31 1.05.09 1.42.4.38 1.04.34 1.39-.09A8.96 8.96 0 0 0 21 12a9 9 0 0 0-9-9Z"),
  path("M16.7 7.3a1 1 0 0 1 .08 1.33l-3.2 4.07a2 2 0 1 1-1.57-1.25l3.36-4.07a1 1 0 0 1 1.33-.08Z"),
  circle({ cx: 7.5, cy: 12, r: 1 }),
  circle({ cx: 12, cy: 7.5, r: 1 }),
  circle({ cx: 16.5, cy: 12, r: 1 }),
]

export const RefreshIcon = [
  path("M20 6.5v4.25a1 1 0 0 1-1 1h-4.25a1 1 0 1 1 0-2h1.82A6 6 0 0 0 6.2 8.05a1 1 0 0 1-1.4-1.43 8 8 0 0 1 13.56 1.65V6.5a1 1 0 1 1 2 0Z"),
  path("M4 17.5v-4.25a1 1 0 0 1 1-1h4.25a1 1 0 1 1 0 2H7.43a6 6 0 0 0 10.37 1.7 1 1 0 1 1 1.4 1.43A8 8 0 0 1 5.64 15.73v1.77a1 1 0 1 1-2 0Z"),
]

export const Settings02Icon = [
  path("M10.75 2.75a1.25 1.25 0 0 1 2.5 0l.16 1.5c.62.18 1.2.42 1.76.73l1.18-.95a1.25 1.25 0 0 1 1.77.08l1.77 1.77c.49.49.52 1.28.08 1.77l-.95 1.18c.31.55.55 1.14.73 1.76l1.5.16a1.25 1.25 0 0 1 0 2.5l-1.5.16c-.18.62-.42 1.2-.73 1.76l.95 1.18c.44.49.41 1.28-.08 1.77l-1.77 1.77a1.25 1.25 0 0 1-1.77.08l-1.18-.95c-.55.31-1.14.55-1.76.73l-.16 1.5a1.25 1.25 0 0 1-2.5 0l-.16-1.5a7.75 7.75 0 0 1-1.76-.73l-1.18.95a1.25 1.25 0 0 1-1.77-.08l-1.77-1.77a1.25 1.25 0 0 1-.08-1.77l.95-1.18a7.75 7.75 0 0 1-.73-1.76l-1.5-.16a1.25 1.25 0 0 1 0-2.5l1.5-.16c.18-.62.42-1.2.73-1.76l-.95-1.18a1.25 1.25 0 0 1 .08-1.77l1.77-1.77a1.25 1.25 0 0 1 1.77-.08l1.18.95c.55-.31 1.14-.55 1.76-.73l.16-1.5ZM12 8.25a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5Z"),
]

export const CommandIcon = [
  path("M7 3a4 4 0 1 0 0 8h3V7a4 4 0 0 0-3-4Zm0 2a2 2 0 0 1 1 3v1H7a2 2 0 1 1 0-4Z", { fillRule: "evenodd", clipRule: "evenodd" }),
  path("M17 3a4 4 0 0 0-3 4v4h3a4 4 0 1 0 0-8Zm-1 5a2 2 0 1 1 1 1h-1V8Z", { fillRule: "evenodd", clipRule: "evenodd" }),
  path("M7 13a4 4 0 1 0 3 4v-4H7Zm0 2h1v1a2 2 0 1 1-1-1Z", { fillRule: "evenodd", clipRule: "evenodd" }),
  path("M14 13v4a4 4 0 1 0 3-4h-3Zm2 2h1a2 2 0 1 1-1 1v-1Z", { fillRule: "evenodd", clipRule: "evenodd" }),
  rect({ x: 8, y: 8, width: 8, height: 2, rx: 1 }),
  rect({ x: 8, y: 14, width: 8, height: 2, rx: 1 }),
  rect({ x: 8, y: 8, width: 2, height: 8, rx: 1 }),
  rect({ x: 14, y: 8, width: 2, height: 8, rx: 1 }),
]

export const ExternalLinkIcon = [
  path("M14 4a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0V6.41l-7.29 7.3a1 1 0 0 1-1.42-1.42L17.59 5H15a1 1 0 0 1-1-1Z"),
  path("M5 6h6a1 1 0 1 1 0 2H6v10h10v-5a1 1 0 1 1 2 0v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z"),
]

export const AlertCircleIcon = [
  circle({ cx: 12, cy: 12, r: 9 }),
  rect({ x: 11, y: 6.5, width: 2, height: 8, rx: 1, fill: "var(--card)" }),
  circle({ cx: 12, cy: 17, r: 1.1, fill: "var(--card)" }),
]

export const HourglassIcon = [
  path("M7 3h10a1 1 0 1 1 0 2h-.5v1.25a5.5 5.5 0 0 1-2.2 4.4L12.5 12l1.8 1.35a5.5 5.5 0 0 1 2.2 4.4V19h.5a1 1 0 1 1 0 2H7a1 1 0 1 1 0-2h.5v-1.25a5.5 5.5 0 0 1 2.2-4.4L11.5 12l-1.8-1.35a5.5 5.5 0 0 1-2.2-4.4V5H7a1 1 0 0 1 0-2Zm2.5 2v1.25a3.5 3.5 0 0 0 1.4 2.8L12 9.88l1.1-.83a3.5 3.5 0 0 0 1.4-2.8V5h-5Zm2.5 7.88-1.1.83a3.5 3.5 0 0 0-1.4 2.8V19h5v-1.25a3.5 3.5 0 0 0-1.4-2.8l-1.1-.83Z"),
]

export const Cancel01Icon = [
  path("M6.3 5.3a1 1 0 0 1 1.4 0l4.3 4.29 4.3-4.3a1 1 0 1 1 1.4 1.42L13.42 11l4.3 4.29a1 1 0 0 1-1.42 1.42L12 12.41l-4.3 4.3a1 1 0 0 1-1.4-1.42L10.58 11l-4.3-4.29a1 1 0 0 1 0-1.42Z"),
]

export const CheckmarkSquare02Icon = [
  path("M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm10.03 5.72a1 1 0 0 0-1.56-1.25l-3.7 4.63-1.32-1.31a1 1 0 0 0-1.4 1.42l2.11 2.1a1 1 0 0 0 1.49-.08l4.38-5.51Z"),
]

export const Loader03Icon = [
  path("M12 2a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1Z"),
  path("M12 17a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0v-3a1 1 0 0 1 1-1Z", { opacity: 0.45 }),
  path("M4.93 4.93a1 1 0 0 1 1.41 0l2.12 2.12a1 1 0 1 1-1.41 1.41L4.93 6.34a1 1 0 0 1 0-1.41Z", { opacity: 0.8 }),
  path("M15.54 15.54a1 1 0 0 1 1.41 0l2.12 2.12a1 1 0 0 1-1.41 1.41l-2.12-2.12a1 1 0 0 1 0-1.41Z", { opacity: 0.35 }),
  path("M2 12a1 1 0 0 1 1-1h3a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1Z", { opacity: 0.65 }),
  path("M17 12a1 1 0 0 1 1-1h3a1 1 0 1 1 0 2h-3a1 1 0 0 1-1-1Z", { opacity: 0.25 }),
]

export const ChevronRightIcon = [
  path("M8.3 4.3a1 1 0 0 1 1.4 0l7 7a1 1 0 0 1 0 1.4l-7 7a1 1 0 0 1-1.4-1.4l6.29-6.3L8.3 5.7a1 1 0 0 1 0-1.4Z"),
]

export const DragDropVerticalIcon = [
  circle({ cx: 9, cy: 5.5, r: 1.5 }),
  circle({ cx: 15, cy: 5.5, r: 1.5 }),
  circle({ cx: 9, cy: 12, r: 1.5 }),
  circle({ cx: 15, cy: 12, r: 1.5 }),
  circle({ cx: 9, cy: 18.5, r: 1.5 }),
  circle({ cx: 15, cy: 18.5, r: 1.5 }),
]

export const ArrowRight01Icon = [
  path("M13.3 5.3a1 1 0 0 1 1.4 0l6 6a1 1 0 0 1 0 1.4l-6 6a1 1 0 0 1-1.4-1.4l4.29-4.3H4a1 1 0 1 1 0-2h13.59l-4.3-4.3a1 1 0 0 1 0-1.4Z"),
]

export const Sun01Icon = [
  circle({ cx: 12, cy: 12, r: 4 }),
  path("M12 2.75a1 1 0 0 1 1 1V5a1 1 0 1 1-2 0V3.75a1 1 0 0 1 1-1Z"),
  path("M12 19a1 1 0 0 1 1 1v1.25a1 1 0 1 1-2 0V20a1 1 0 0 1 1-1Z"),
  path("M4.93 4.93a1 1 0 0 1 1.41 0l.88.88a1 1 0 1 1-1.41 1.41l-.88-.88a1 1 0 0 1 0-1.41Z"),
  path("M16.78 16.78a1 1 0 0 1 1.41 0l.88.88a1 1 0 0 1-1.41 1.41l-.88-.88a1 1 0 0 1 0-1.41Z"),
  path("M2.75 12a1 1 0 0 1 1-1H5a1 1 0 1 1 0 2H3.75a1 1 0 0 1-1-1Z"),
  path("M19 12a1 1 0 0 1 1-1h1.25a1 1 0 1 1 0 2H20a1 1 0 0 1-1-1Z"),
  path("M4.93 19.07a1 1 0 0 1 0-1.41l.88-.88a1 1 0 0 1 1.41 1.41l-.88.88a1 1 0 0 1-1.41 0Z"),
  path("M16.78 7.22a1 1 0 0 1 0-1.41l.88-.88a1 1 0 1 1 1.41 1.41l-.88.88a1 1 0 0 1-1.41 0Z"),
]

export const Moon02Icon = [
  path("M14.2 3.2a1 1 0 0 1 1.12 1.35A7.5 7.5 0 1 0 19.45 14.7a1 1 0 0 1 1.72.95A9.5 9.5 0 1 1 12.05 2.5c.5 0 .99.03 1.47.1a1 1 0 0 1 .68.6Z"),
]

export const MoonIcon = [
  path(
    "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM8.75 6.75a1.75 1.75 0 1 1 0 3.5 1.75 1.75 0 0 1 0-3.5Zm6.5 5.25a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM8 15.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Z",
    { fillRule: "evenodd", clipRule: "evenodd" }
  ),
]

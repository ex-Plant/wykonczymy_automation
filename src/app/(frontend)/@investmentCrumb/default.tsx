// Only the dashboard at "/" reaches this — every deeper route has an explicit slot page, and from
// the root there is nowhere to go back to, so the top-bar crumb stays empty.
export default function CrumbDefault() {
  return null
}

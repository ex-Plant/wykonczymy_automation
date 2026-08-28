// Without this the slot inherits (frontend)/loading.tsx, whose full-screen 🚧 lands inside the
// 56px top bar. A layout-level <Suspense> can't override it — loading.tsx nests *inside* it.
export default function InvestmentCrumbLoading() {
  return null
}

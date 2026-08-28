// Everything without its own slot page — the listings, which need no back affordance because the
// sidebar is one. The route still has to exist: soft navigation keeps a slot's previous content
// when nothing matches, so leaving a sub-page would strand its crumb in the top bar.
export default function CrumbCatchAll() {
  return null
}

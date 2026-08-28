import { HistoryBackButton } from '@/components/ui/history-back-button'

// Each detail page is spelled out because a slot route only matches when it mirrors the real
// segment names — a shared [section]/[...rest] never fires.
export default function CrumbRegisterDetail() {
  return <HistoryBackButton fallbackHref="/kasy" />
}

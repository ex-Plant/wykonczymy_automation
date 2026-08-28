import { HistoryBackButton } from '@/components/ui/history-back-button'

// The investment detail page: back only. Its name is already the page heading, so repeating it in
// the top bar would say the same thing twice — that's reserved for the sub-pages.
export default function CrumbInvestmentDetail() {
  return <HistoryBackButton fallbackHref="/inwestycje" />
}

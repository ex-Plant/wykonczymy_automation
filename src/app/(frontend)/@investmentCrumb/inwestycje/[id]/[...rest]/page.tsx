// Sub-routes of an investment (/kosztorys, /kosztorys_v2, …) only. The detail page itself has no
// slot file — the crumb would just repeat its heading and point „wróć" at the page you're on.
export { InvestmentCrumb as default } from '@/components/nav/investment-crumb'

import { google } from 'googleapis'
import { resolveLaborColumns } from '@/lib/kosztorys/sheet-import/resolve-columns'

const IDS = process.env.IDS!.split(',')
const num = (cell: unknown): number => {
  if (typeof cell === 'number') return cell
  const raw = String(cell ?? '')
    .replace(/\s| /g, '')
    .replace(/zł|%/g, '')
    .replace(',', '.')
  const v = Number(raw)
  return Number.isFinite(v) ? v : 0
}
function colLetter(index: number): string {
  let n = index + 1,
    out = ''
  while (n > 0) {
    const r = (n - 1) % 26
    out = String.fromCharCode(65 + r) + out
    n = Math.floor((n - 1) / 26)
  }
  return out
}

async function main() {
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!)
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
  const sheets = google.sheets({ version: 'v4', auth })
  let totalNonZero = 0,
    totalZeroPomiar = 0,
    totalStagesZero = 0
  for (const entry of IDS) {
    const [inv, id] = entry.split(':')
    try {
      const [res, resF] = await Promise.all([
        sheets.spreadsheets.values.get({
          spreadsheetId: id,
          range: "'kosztorys_robocizny'!A1:BZ500",
          valueRenderOption: 'FORMATTED_VALUE',
        }),
        sheets.spreadsheets.values.get({
          spreadsheetId: id,
          range: "'kosztorys_robocizny'!A1:BZ500",
          valueRenderOption: 'FORMULA',
        }),
      ])
      const grid = (res.data.values ?? []) as unknown[][]
      const formulas = (resF.data.values ?? []) as unknown[][]
      const r = resolveLaborColumns(grid)
      if (!r.ok) continue
      const mq = r.columns.measuredQty
      if (mq === undefined) continue
      const { firstColumn, count } = r.stages
      const stageCols = Array.from({ length: count }, (_, i) => firstColumn + i)
      const stageLetters = stageCols.map(colLetter)
      let nonZero = 0,
        zeroPomiar = 0,
        stagesZero = 0
      for (let i = 3; i < grid.length; i++) {
        const f = String(formulas[i]?.[mq] ?? '').trim()
        const v = grid[i]?.[mq]
        if (f === '' && (v == null || String(v).trim() === '')) continue
        if (!f.startsWith('=')) continue
        const norm = f.toUpperCase().replace(/\s/g, '')
        if (
          stageLetters.some(
            (L) => new RegExp(`\\$?${L}\\$?\\d`).test(norm) || norm.includes(`${L}:`),
          )
        )
          continue
        const pomiar = num(v)
        const stageTotal = stageCols.reduce((a, c) => a + num(grid[i]?.[c]), 0)
        if (Math.abs(pomiar - stageTotal) <= 0.0001) continue
        if (pomiar === 0) {
          zeroPomiar++
          continue
        }
        nonZero++
        if (stageTotal === 0) stagesZero++
      }
      totalNonZero += nonZero
      totalZeroPomiar += zeroPomiar
      totalStagesZero += stagesZero
      if (nonZero || zeroPomiar)
        console.log(
          `inw ${inv}: pomiar≠0 → ${nonZero} (w tym etapy=0: ${stagesZero}) | pomiar=0 a etapy≠0 → ${zeroPomiar}`,
        )
    } catch (e) {
      console.log(`inw ${inv}: ERROR ${(e as Error).message.slice(0, 60)}`)
    }
  }
  console.log(
    `\nRAZEM pomiar≠0: ${totalNonZero} (etapy=0: ${totalStagesZero}) | pomiar=0 a etapy≠0: ${totalZeroPomiar}`,
  )
}
main()

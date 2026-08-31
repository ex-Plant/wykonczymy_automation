// Measuring width is the caller's job so the wrapping rules can be tested without a browser — the
// unit suite runs in node, with no DOM to lay text out in.
export type MeasureTextWidthT = (text: string) => number

// Canvas width and layout width disagree by a fraction of a pixel, so a line that ends exactly at
// the column edge can round either way. Measured on 120 real cells: 118 agreed, and both
// disagreements were texts sitting on that edge. Shaving a pixel biases every such call toward the
// taller row — an extra strip of whitespace, rather than a clipped description, which is the very
// thing row height exists to prevent.
const EDGE_TOLERANCE_PX = 1

// How many lines `text` occupies when wrapped into `availableWidth`. Words break onto the next line
// whole; a single word wider than the column breaks mid-word, matching `overflow-wrap: break-word`.
export function countWrappedLines(
  text: string,
  availableWidth: number,
  measure: MeasureTextWidthT,
): number {
  const limit = availableWidth - EDGE_TOLERANCE_PX
  if (!text || limit <= 0) return 1

  let lines = 0
  for (const paragraph of text.split('\n')) {
    lines += countParagraphLines(paragraph, limit, measure)
  }
  return Math.max(1, lines)
}

function countParagraphLines(paragraph: string, limit: number, measure: MeasureTextWidthT): number {
  const words = paragraph.split(/\s+/).filter(Boolean)
  // An empty paragraph is still a line — a blank line between two paragraphs takes vertical space.
  if (words.length === 0) return 1

  let lines = 1
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (measure(candidate) <= limit) {
      current = candidate
      continue
    }
    if (current) {
      lines += 1
      current = ''
    }
    // The word alone still overflows, so it breaks across lines by characters; the remainder starts
    // the line the next word may join.
    const [extraLines, remainder] = breakLongWord(word, limit, measure)
    lines += extraLines
    current = remainder
  }

  return lines
}

// Returns the number of ADDITIONAL lines the word fills and the tail left on the current line.
function breakLongWord(word: string, limit: number, measure: MeasureTextWidthT): [number, string] {
  if (measure(word) <= limit) return [0, word]

  let extraLines = 0
  let current = ''

  for (const char of word) {
    const candidate = current + char
    if (measure(candidate) <= limit || !current) {
      current = candidate
      continue
    }
    extraLines += 1
    current = char
  }

  return [extraLines, current]
}

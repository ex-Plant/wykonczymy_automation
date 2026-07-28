// Reference-data rows carry `active` as OPTIONAL, and an absent flag means active — so the test is
// `!== false`, never `=== true`. Named once because getting it backwards silently empties a picker.
export const isActiveRef = (item: { active?: boolean }) => item.active !== false

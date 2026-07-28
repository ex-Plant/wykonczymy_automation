// Map/React key for a per-worker row: the null-worker bucket needs a stable non-null key so it can
// sit in the same lookup as the real workers.
const UNASSIGNED_KEY = 'unassigned'

export const workerKey = (workerId: number | null) =>
  workerId === null ? UNASSIGNED_KEY : workerId

import { isActiveRef } from '@/lib/utils/is-active-ref'
import type { WorkerRefT } from '@/types/reference-data'

/**
 * Who the etap header may offer, and who currently holds the etap.
 *
 * The reference query is unfiltered, so deactivated workers must not be offered NEW work — but the
 * current holder is resolved off the UNFILTERED list and kept in the options regardless. Filtering
 * first and looking up second is what made a since-deactivated assignee read as unassigned: no
 * checkbox ticked (nor „Bez przypisania", since `workerId` is not null), and the reassignment confirm
 * quoting „nieznana osoba" instead of the name it exists to state. The podwykonawcy panel reads the
 * unfiltered roster and still names them, so the two surfaces disagreed about who holds the etap.
 */
export function stageWorkerOptions(workers: WorkerRefT[], currentWorkerId: number | null) {
  const options = workers.filter(
    (worker) => isActiveRef(worker) || worker.id === currentWorkerId,
  )
  const nameOf = (workerId: number | null) =>
    workerId === null ? undefined : options.find((worker) => worker.id === workerId)?.name

  return { options, currentWorkerName: nameOf(currentWorkerId), nameOf }
}

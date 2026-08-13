// One labelled section of a sheet report. Shared by the import preview and the live comparison so
// the two dialogs read as one report rather than two visual dialects of the same thing.
export function SheetReportBlock({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <p className="font-medium">{title}</p>
      {children}
    </div>
  )
}

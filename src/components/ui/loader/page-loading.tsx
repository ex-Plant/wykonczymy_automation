// Route-segment fallback: sits inside the layout's <main>, so it fills the flex row
// rather than the viewport (h-screen here would overflow that scroll container).
export function PageLoading() {
  return (
    <div className="flex w-full flex-1 items-center justify-center">
      <p className="animate-bounce text-3xl font-semibold lg:text-5xl">🚧</p>
    </div>
  )
}

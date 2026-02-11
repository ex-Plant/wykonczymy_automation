export const DebugScreens = () => {
  if (process.env.NODE_ENV !== 'development') return
  return (
    <div className="text-md fixed right-4 bottom-12 rounded-full">
      {/* Mobile: < 768px */}
      <div className="block sm:hidden">xs 0 - 768px</div>
      {/* SM: 768px - 1023px */}
      <div className="hidden sm:block md:hidden">sm (768px)</div>
      {/* MD: 1024px - 1279px */}
      <div className="hidden md:block lg:hidden">md (1024px)</div>
      {/* LG: 1280px - 1439px */}
      <div className="hidden lg:block xl:hidden">lg (1280px)</div>
      {/* XL: 1440px - 1919px */}
      <div className="hidden xl:block 2xl:hidden">xl (1440px)</div>
      {/* 2XL: 1920px+ */}
      <div className="hidden 2xl:block">2xl (1920px)</div>
    </div>
  )
}

import { useEffect, useState } from 'react'

export default function useIsOnTop() {
  const [isOnTop, setIsOnTop] = useState(true)

  useEffect(() => {
    const onScroll = () => {
      if (window.scrollY < 70) {
        setIsOnTop(true)
      } else {
        setIsOnTop(false)
      }
    }

    window.addEventListener('scroll', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  return isOnTop
}

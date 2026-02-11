import localFont from 'next/font/local'

export const ABCFavorit = localFont({
  src: [
    {
      path: '../../public/fonts/ABCFavorit-Regular.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../public/fonts/ABCFavorit-Light.otf',
      weight: '300',
      style: 'normal',
    },
    {
      path: '../../public/fonts/ABCFavorit-LightItalic.otf',
      weight: '300',
      style: 'italic',
    },
  ],
  variable: '--font-abc-favorit',
})

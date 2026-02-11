import localFont from 'next/font/local'
import { DM_Sans, Space_Mono } from 'next/font/google'

// ABC Favorit - Local custom font
export const abcFavorit = localFont({
  src: [
    {
      path: './ABCFavorit-Regular.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: './ABCFavorit-Light.otf',
      weight: '300',
      style: 'normal',
    },
    {
      path: './ABCFavorit-LightItalic.otf',
      weight: '300',
      style: 'italic',
    },
  ],
  variable: '--font-abc-favorit',
  display: 'swap',
})

// Climate Crisis - Variable display font (requires license from etceteratype.co)
// Download the font files and place them in public/fonts/
// Supports variable axis: YEAR (1979-2050)

// export const climateCrisis = localFont({
//   src: './ClimateCrisis-Regular-VariableFont_YEAR.woff2',
//   variable: '--font-climate-crisis',
//   display: 'swap',
//   weight: '400',
// })

// DM Sans - Google Font (body text, headings h4-h6)
export const dmSans = DM_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '600'],
  style: ['normal'],
  variable: '--font-dm-sans',
  display: 'swap',
})

// Space Mono - Google Font (labels, tags)
export const spaceMono = Space_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['400'],
  style: ['normal'],
  variable: '--font-space-mono',
  display: 'swap',
})

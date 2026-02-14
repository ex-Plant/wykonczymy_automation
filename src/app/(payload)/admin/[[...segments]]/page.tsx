/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
import type { AdminViewProps } from 'payload'
import config from '@payload-config'
import { RootPage, generatePageMetadata } from '@payloadcms/next/views'

import { importMap } from '../importMap.js'

type ArgsT = {
  params: Promise<{ segments: string[] }>
  searchParams: Promise<{ [key: string]: string | string[] }>
}

export const generateMetadata = ({ params, searchParams }: ArgsT) =>
  generatePageMetadata({ config, params, searchParams })

export default async function Page(props: ArgsT) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return RootPage({ ...props, config, importMap } as any)
}

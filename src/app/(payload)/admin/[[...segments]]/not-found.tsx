/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
import config from '@payload-config'
import { NotFoundPage, generatePageMetadata } from '@payloadcms/next/views'

import { importMap } from '../importMap.js'

type ArgsT = {
  params: Promise<{ segments: string[] }>
  searchParams: Promise<{ [key: string]: string | string[] }>
}

export const generateMetadata = ({ params, searchParams }: ArgsT) =>
  generatePageMetadata({ config, params, searchParams })

export default async function NotFound(props: ArgsT) {
  return NotFoundPage({ ...props, config, importMap })
}

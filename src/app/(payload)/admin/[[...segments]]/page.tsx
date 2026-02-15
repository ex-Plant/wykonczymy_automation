/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
import type { AdminViewProps } from 'payload'
import config from '@payload-config'
import { RootPage, generatePageMetadata } from '@payloadcms/next/views'
import { Suspense } from 'react'

import { importMap } from '../importMap.js'

type ArgsT = {
  params: Promise<{ segments: string[] }>
  searchParams: Promise<{ [key: string]: string | string[] }>
}

export const generateMetadata = ({ params, searchParams }: ArgsT) =>
  generatePageMetadata({ config, params, searchParams })

export default async function Page(props: AdminViewProps) {
  return (
    <Suspense>
      <PayloadAdminPage {...props} />
    </Suspense>
  )
}

async function PayloadAdminPage(props: AdminViewProps) {
  // @ts-expect-error — Payload 3.73 AdminViewProps doesn't align with RootPage params; auto-generated file
  return RootPage({ ...props, config, importMap })
}

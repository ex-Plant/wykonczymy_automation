export default function logErrorDetails(error: unknown, message: string, ...args: unknown[]) {
  const details =
    error instanceof Error
      ? {
          message: error.message,
          name: error.name,
          cause: error.cause,
        }
      : error

  console.error(`❌❌❌ ${message}`, details, ...args)
}

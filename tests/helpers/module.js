import { pathToFileURL } from 'url'

export async function importFreshModule(relativePath) {
  const moduleUrl = pathToFileURL(process.cwd() + '\\' + relativePath).href
  return import(`${moduleUrl}?t=${Date.now()}-${Math.random()}`)
}

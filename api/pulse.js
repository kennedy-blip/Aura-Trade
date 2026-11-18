import { HttpError, route } from '../server/http.js'
import { history, pulse } from '../server/pulse.js'
import { hasInstrument } from '../src/data/pulse.js'

export default route(['GET'], async (req) => {
  const query = new URL(req.url, 'https://local.invalid').searchParams
  const id = query.get('history')
  const interval = query.get('interval') || '1d'
  if (id === null) return pulse()
  if (!hasInstrument(id) || !['1d', '1m'].includes(interval)) throw new HttpError(400, 'Choose a supported instrument.')
  return { history: await history(id, interval) }
}, { publicCache: 'public, max-age=0, s-maxage=10, stale-while-revalidate=5' })

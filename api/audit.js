import { directory } from '../src/data/compliance.js'
import { identity } from '../server/auth.js'
import { marketFeeds } from '../server/feeds.js'
import { route } from '../server/http.js'
export default route(['GET'], async (req) => {
  const auth = await identity(req, { admin: true })
  return { actor: auth.user.id, generatedAt: new Date().toISOString(), directory, market: await marketFeeds() }
})

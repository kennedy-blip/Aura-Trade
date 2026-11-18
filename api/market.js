import { route } from '../server/http.js'
import { marketFeeds } from '../server/feeds.js'
export default route(['GET'], marketFeeds, { publicCache: true })

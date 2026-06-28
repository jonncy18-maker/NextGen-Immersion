import { verifySession } from "./_auth.js"
import { classifyVideo } from "./_tag.js"

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authUser = await verifySession(req.headers.authorization)
  if (!authUser) return res.status(401).json({ error: 'Unauthorized' })

  const { title, description = '', language = 'english' } = req.body || {}
  if (!title) return res.status(400).json({ error: 'title required' })

  const tags = await classifyVideo({ title, description, language })
  return res.status(200).json(tags)
}

import { createImageEditHandler } from '../server/image-edit-adapter.js'

const timeoutMs = Math.min(
  285_000,
  Math.max(30_000, Number(process.env.IMAGE_EDIT_TIMEOUT_MS) || 285_000)
)

const handler = createImageEditHandler({
  baseUrl: process.env.IMAGE_EDIT_API_BASE_URL,
  apiKey: process.env.IMAGE_EDIT_API_KEY,
  model: process.env.IMAGE_EDIT_API_MODEL,
  inspirationModel: process.env.IMAGE_INSPIRATION_API_MODEL,
  timeoutMs
})

export const config = {
  api: {
    bodyParser: false
  }
}

export default handler

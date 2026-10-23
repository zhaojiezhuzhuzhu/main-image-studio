import { createImageEditHandler } from '../../server/image-edit-adapter.js'

const handler = createImageEditHandler({
  baseUrl: process.env.IMAGE_EDIT_API_BASE_URL,
  apiKey: process.env.IMAGE_EDIT_API_KEY,
  model: process.env.IMAGE_EDIT_API_MODEL,
  inspirationModel: process.env.IMAGE_INSPIRATION_API_MODEL
})

export default handler

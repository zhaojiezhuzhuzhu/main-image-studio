export default function handler(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.statusCode = 405
    response.setHeader('Allow', 'GET, HEAD')
    response.end()
    return
  }

  response.statusCode = 307
  response.setHeader('Location', '/reference-library/manifest.json')
  response.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300')
  response.end()
}

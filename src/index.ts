import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import authRoutes from '../src/modules/auth/auth.route.js'

const app = new Hono()

// to check if the server is reaching the endpoint
app.get('/', (c) => {
  return c.text('Hello Hono!')
})

// Mount auth routes
app.route('/auth', authRoutes)

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
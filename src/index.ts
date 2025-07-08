import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import authRoutes from '../src/modules/auth/auth.route.js'
import resumRoutes from '../src/modules/resumes/resume.route.js'

const app = new Hono()

// to check if the server is reaching the endpoint
app.get('/', (c) => {
  return c.text('Hello Hono!')
})

// Mount auth routes
app.route('/auth', authRoutes)
app.route('/resume',resumRoutes)

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
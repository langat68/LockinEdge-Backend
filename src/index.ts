import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import authRoutes from '../src/modules/auth/auth.route.js'
import resumRoutes from '../src/modules/resumes/resume.route.js'
import {jobRoutes} from '../src/modules/jobs/jobs.route.js'

const app = new Hono()

// Add logger middleware
app.use('*', logger())

// to check if the server is reaching the endpoint
app.get('/', (c) => {
  return c.text('Hello Hono!')
})

// Mount auth routes
app.route('/auth', authRoutes)
app.route('/resume', resumRoutes)
app.route('/', jobRoutes)

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
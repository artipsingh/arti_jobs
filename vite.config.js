import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'

// eslint-disable-next-line no-undef
const JOBS_FILE = resolve(process.cwd(), process.env.TEST_JOBS_FILE || 'data/jobs.json')

function readEnvKey(key) {
  try {
    // eslint-disable-next-line no-undef
    const content = readFileSync(resolve(process.cwd(), '.env'), 'utf8')
    const match = content.match(new RegExp(`^${key}=(.+)$`, 'm'))
    return match ? match[1].trim() : undefined
  } catch {
    return undefined
  }
}

const apiKey = readEnvKey('VITE_ANTHROPIC_API_KEY')

function anthropicProxyPlugin() {
  return {
    name: 'anthropic-proxy',
    configureServer(server) {
      server.middlewares.use('/api/anthropic/v1/messages', async (req, res) => {
        const chunks = []
        req.on('data', chunk => chunks.push(chunk))
        req.on('end', async () => {
          try {
            // eslint-disable-next-line no-undef
            const body = Buffer.concat(chunks)
            const response = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
              },
              body,
            })
            const data = await response.json()
            res.setHeader('Content-Type', 'application/json')
            res.statusCode = response.status
            res.end(JSON.stringify(data))
          } catch (err) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: err.message }))
          }
        })
      })
    },
  }
}

function jobsPlugin() {
  return {
    name: 'jobs-persistence',
    configureServer(server) {
      server.middlewares.use('/api/jobs', (req, res) => {
        res.setHeader('Content-Type', 'application/json')

        if (req.method === 'GET') {
          try {
            const data = existsSync(JOBS_FILE) ? readFileSync(JOBS_FILE, 'utf8') : '[]'
            res.end(data)
          } catch (err) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: err.message }))
          }
        } else if (req.method === 'POST') {
          const chunks = []
          req.on('data', chunk => chunks.push(chunk))
          req.on('end', () => {
            try {
              // eslint-disable-next-line no-undef
              const body = Buffer.concat(chunks).toString()
              writeFileSync(JOBS_FILE, JSON.stringify(JSON.parse(body), null, 2))
              res.end(JSON.stringify({ ok: true }))
            } catch (err) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: err.message }))
            }
          })
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), anthropicProxyPlugin(), jobsPlugin()],
  resolve: {
    alias: [
      // data/initialJobs.js is gitignored — use the stub when the real file is absent (e.g. CI)
      {
        find: /^.*\/data\/initialJobs\.js$/,
        // eslint-disable-next-line no-undef
        replacement: resolve(process.cwd(), existsSync(resolve(process.cwd(), 'data/initialJobs.js'))
          ? 'data/initialJobs.js'
          : 'data/initialJobs.stub.js'),
      },
    ],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.js',
    exclude: ['tests/e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        'src/test-setup.js',
        'src/prompts/**',
        'src/main.jsx',                    // entry point, not unit testable
        'src/App.jsx',                     // thin shell, covered by E2E
        'src/utils/validatePromptFile.js', // requires gitignored prompt files
      ],
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        lines: 55,
        functions: 50,
        branches: 55,
        statements: 55,
      },
    },
  },
})

import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const sportsradarApiKey = env.SPORTRADAR_API_KEY
  const sportsradarApiHost = env.SPORTRADAR_API_HOST || 'https://api.sportradar.com'
  const sportsradarTennisPath = env.SPORTRADAR_TENNIS_PATH
    || '/tennis/trial/v3/en/schedules/live/summaries.json'
  const apiTennisKey = env.API_TENNIS_KEY
  const apiTennisHost = env.API_TENNIS_HOST || 'https://api.api-tennis.com'
  const apiTennisPath = env.API_TENNIS_PATH
    || '/tennis/?method=get_livescore'

  const proxy = {}

  if (sportsradarApiKey) {
    proxy['/api/sportsradar/tennis/atp-live'] = {
      target: sportsradarApiHost,
      changeOrigin: true,
      secure: true,
      rewrite: () => {
        const separator = sportsradarTennisPath.includes('?') ? '&' : '?'
        return `${sportsradarTennisPath}${separator}api_key=${encodeURIComponent(sportsradarApiKey)}`
      },
    }
  }

  if (apiTennisKey) {
    proxy['/api/api-tennis/atp-live'] = {
      target: apiTennisHost,
      changeOrigin: true,
      secure: true,
      rewrite: () => {
        const separator = apiTennisPath.includes('?') ? '&' : '?'
        return `${apiTennisPath}${separator}APIkey=${encodeURIComponent(apiTennisKey)}`
      },
    }
  }

  return {
    plugins: [react(), tailwindcss()],
    server: { proxy },
    preview: { proxy },
  }
})

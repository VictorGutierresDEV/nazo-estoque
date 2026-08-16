import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Sem isto o Turbopack sobe a árvore procurando lockfile e acha o
  // package-lock.json de C:\Users\victo, fora do repositório.
  turbopack: {
    root: __dirname,
  },
}

export default nextConfig

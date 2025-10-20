import { buildClient } from './lib/build-client'

/**
 * Main build script
 * This can be run directly with: bun run build.ts
 */
async function main() {
	await buildClient()
}

// Run the build
main()

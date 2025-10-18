import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { PluginOption } from 'vite'

const reactScan = (): PluginOption => {
	return {
		name: "react-scan",
		apply: "serve", // Only apply this plugin during development
		transformIndexHtml(html) {
			return {
				html,
				tags: [
					{
						tag: "script",
						attrs: {
							src: "https://unpkg.com/react-scan/dist/auto.global.js",
						},
						injectTo: "head",
					},
				],
			};
		},
	};
};


export default defineConfig({
  plugins: [react(), reactScan()],
  server: {
    port: 5173,
    open: true,
  },
  build: {
    sourcemap: true,
  },
})

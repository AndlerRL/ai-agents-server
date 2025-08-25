import * as React from 'react'
import { hydrateRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import './index.css'

const rootElement = document.getElementById('root')
if (!rootElement) {
	throw new Error('Root element not found')
}
hydrateRoot(
	rootElement,
	<React.StrictMode>
		<BrowserRouter>
			<Routes>
				<Route path="/dashboard" element={<>
					<div>
						Home page
					</div>
				</>} />
			</Routes>
		</BrowserRouter>
	</React.StrictMode>,
)

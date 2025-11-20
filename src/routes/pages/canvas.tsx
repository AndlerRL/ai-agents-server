import { Elysia } from "elysia";
import React from "react";
import { renderPage } from "../../components/layout";

function CanvasPage() {
	return (
		<div className="max-w-7xl mx-auto">
			<header className="mb-8">
				<h1 className="text-3xl font-bold text-slate-900">Agent Flows</h1>
				<p className="text-slate-500 mt-2">
					Design and manage your agentic workflows
				</p>
			</header>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
				<div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm min-h-[600px] flex items-center justify-center bg-slate-50">
					<div className="text-center">
						<div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
							<svg
								className="w-8 h-8"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<title>Create New Flow</title>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth="2"
									d="M12 6v6m0 0v6m0-6h6m-6 0H6"
								></path>
							</svg>
						</div>
						<h3 className="text-lg font-medium text-slate-900">
							Create New Flow
						</h3>
						<p className="text-slate-500 mt-1 mb-4">
							Start building a new agentic workflow
						</p>
						<button
							type="button"
							className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
						>
							Open Canvas
						</button>
					</div>
				</div>

				<div className="space-y-6">
					<div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
						<h3 className="font-semibold text-slate-900 mb-4">Recent Flows</h3>
						<div className="space-y-4">
							{[1, 2, 3].map((i) => (
								<div
									key={i}
									className="p-3 rounded-lg border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50 transition-colors cursor-pointer"
								>
									<div className="font-medium text-slate-900">
										Customer Support Bot {i}
									</div>
									<div className="text-xs text-slate-500 mt-1">
										Updated 2h ago • 3 Agents
									</div>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

export const canvasPageRoutes = new Elysia().get("/canvas", () =>
	renderPage("AgentCanvas - Flows", <CanvasPage />),
);

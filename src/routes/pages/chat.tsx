import { Elysia } from "elysia";
import { renderPage } from "../../components/layout";

export function ChatPage() {
	return (
		<div className="max-w-7xl mx-auto h-[calc(100vh-140px)] flex gap-6">
			<div className="w-80 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
				<div className="p-4 border-b border-slate-100">
					<button
						type="button"
						className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
					>
						+ New Chat
					</button>
				</div>
				<div className="flex-1 overflow-y-auto p-2 space-y-1">
					{[1, 2, 3, 4, 5].map((i) => (
						<div
							key={i}
							className={`p-3 rounded-lg cursor-pointer ${i === 1 ? "bg-indigo-50 border-indigo-100" : "hover:bg-slate-50 border-transparent"} border`}
						>
							<div className="font-medium text-slate-900 text-sm truncate">
								Project Analysis Session {i}
							</div>
							<div className="text-xs text-slate-500 mt-1 truncate">
								Last message: Here is the summary...
							</div>
						</div>
					))}
				</div>
			</div>

			<div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
				<div className="p-4 border-b border-slate-100 flex justify-between items-center">
					<div>
						<h2 className="font-semibold text-slate-900">
							Project Analysis Session 1
						</h2>
						<div className="flex items-center gap-2 mt-1">
							<span className="w-2 h-2 bg-green-500 rounded-full"></span>
							<span className="text-xs text-slate-500">
								Agent: Research Assistant
							</span>
						</div>
					</div>
					<button type="button" className="text-slate-400 hover:text-slate-600">
						<svg
							className="w-5 h-5"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<title>Menu</title>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth="2"
								d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
							></path>
						</svg>
					</button>
				</div>

				<div className="flex-1 p-6 overflow-y-auto space-y-6 bg-slate-50">
					<div className="flex gap-4">
						<div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 text-xs font-bold flex-shrink-0">
							AI
						</div>
						<div className="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm border border-slate-100 max-w-[80%]">
							<p className="text-slate-800 text-sm leading-relaxed">
								Hello! I'm your Research Assistant. How can I help you analyze
								your project data today?
							</p>
						</div>
					</div>

					<div className="flex gap-4 flex-row-reverse">
						<div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 text-xs font-bold flex-shrink-0">
							U
						</div>
						<div className="bg-indigo-600 p-4 rounded-2xl rounded-tr-none shadow-sm max-w-[80%]">
							<p className="text-white text-sm leading-relaxed">
								Can you summarize the latest trends in agentic workflows?
							</p>
						</div>
					</div>

					<div className="flex gap-4">
						<div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 text-xs font-bold flex-shrink-0">
							AI
						</div>
						<div className="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm border border-slate-100 max-w-[80%]">
							<p className="text-slate-800 text-sm leading-relaxed">
								Based on recent data, here are the key trends in agentic
								workflows:
							</p>
							<ul className="list-disc list-inside mt-2 space-y-1 text-slate-700 text-sm">
								<li>Multi-agent orchestration patterns</li>
								<li>Tool-use optimization</li>
								<li>Memory persistence across sessions</li>
								<li>Human-in-the-loop feedback mechanisms</li>
							</ul>
						</div>
					</div>
				</div>

				<div className="p-4 border-t border-slate-100 bg-white rounded-b-xl">
					<div className="relative">
						<input
							type="text"
							placeholder="Type your message..."
							className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
						/>
						<button
							type="button"
							className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
						>
							<svg
								className="w-5 h-5"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<title>Send</title>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth="2"
									d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
								></path>
							</svg>
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

export const chatPageRoutes = new Elysia().get("/chat", () =>
	renderPage("AgentCanvas - Chat", <ChatPage />),
);

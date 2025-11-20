import React from 'react';
import { Elysia } from 'elysia';
import { renderPage } from '../../components/layout';

function ToolsPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Tools</h1>
          <p className="text-slate-500 mt-2">Explore and configure available tools for your agents</p>
        </div>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
          + Create Tool
        </button>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {['Web Search', 'Calculator', 'Database Query', 'Email Sender', 'File Reader', 'Image Gen', 'Code Interpreter', 'Slack Notifier'].map((tool, i) => (
          <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-300 transition-colors group">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              </div>
              <h3 className="font-semibold text-slate-900">{tool}</h3>
            </div>
            <p className="text-slate-500 text-sm mb-4 line-clamp-2">
              Standard utility for {tool.toLowerCase()} operations. Can be attached to any agent.
            </p>
            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              <span className="text-xs font-medium text-slate-500">v1.0.2</span>
              <button className="text-xs font-medium text-indigo-600 hover:text-indigo-800">View Details</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const toolsPageRoutes = new Elysia()
  .get('/tools', () => renderPage('AgentCanvas - Tools', <ToolsPage />));

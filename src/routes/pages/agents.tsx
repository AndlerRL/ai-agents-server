import React from 'react';
import { Elysia } from 'elysia';
import { renderPage } from '../../components/layout';

export function AgentsPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Agents</h1>
          <p className="text-slate-500 mt-2">Manage and configure your AI agents</p>
        </div>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
          + New Agent
        </button>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
                A{i}
              </div>
              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">Active</span>
            </div>
            <h3 className="font-semibold text-lg text-slate-900">Research Assistant {i}</h3>
            <p className="text-slate-500 text-sm mt-1 mb-4">Specialized in gathering and synthesizing information from various sources.</p>
            <div className="flex gap-2 text-xs text-slate-600 mb-4">
              <span className="bg-slate-100 px-2 py-1 rounded">GPT-4o</span>
              <span className="bg-slate-100 px-2 py-1 rounded">Web Search</span>
            </div>
            <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
              <button className="flex-1 text-sm font-medium text-slate-600 hover:text-indigo-600">Configure</button>
              <button className="flex-1 text-sm font-medium text-slate-600 hover:text-indigo-600">Test</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const agentsPageRoutes = new Elysia()
  .get('/agents', () => renderPage('AgentCanvas - Agents', <AgentsPage />));

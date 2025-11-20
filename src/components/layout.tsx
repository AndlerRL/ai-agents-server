import React from 'react';
import { renderToString } from 'react-dom/server';
import { renderLayout } from '~/lib/render-layout';

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav className="bg-white/80 backdrop-blur border-b border-slate-200/50 dark:bg-gray-900/80 dark:border-gray-800 px-6 py-4 flex items-center gap-6 sticky top-0 z-50">
        <a href="/" className="font-bold text-xl text-indigo-600 dark:text-indigo-400">AgentCanvas</a>
        <div className="flex gap-4 text-sm font-medium text-slate-600 dark:text-slate-300">
          <a href="/canvas" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Canvas</a>
          <a href="/agents" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Agents</a>
          <a href="/tools" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Tools</a>
          <a href="/chat" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Chat</a>
          <a href="/nodes" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Nodes</a>
        </div>
      </nav>
      <main className="p-6">
        {children}
      </main>
    </>
  );
}

export function renderPage(title: string, component: React.ReactNode, context?: Record<string, unknown>) {
  const $htmlComponent = (
    <Layout>
      {component}
    </Layout>
  );
  const html = renderToString($htmlComponent);
  const layoutString = renderLayout(html, { title, data: context })
  return new Response(layoutString, {
    headers: { 'Content-Type': 'text/html' }
  });
}

import React from 'react';
import { renderToString } from 'react-dom/server';

export function Layout({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>{`
          body { font-family: system-ui, -apple-system, sans-serif; }
        `}</style>
      </head>
      <body className="bg-slate-50 text-slate-900 min-h-screen">
        <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-6">
          <a href="/" className="font-bold text-xl text-indigo-600">AgentCanvas</a>
          <div className="flex gap-4 text-sm font-medium text-slate-600">
            <a href="/canvas" className="hover:text-indigo-600">Canvas</a>
            <a href="/agents" className="hover:text-indigo-600">Agents</a>
            <a href="/tools" className="hover:text-indigo-600">Tools</a>
            <a href="/chat" className="hover:text-indigo-600">Chat</a>
            <a href="/nodes" className="hover:text-indigo-600">Nodes</a>
          </div>
        </nav>
        <main className="p-6">
          {children}
        </main>
      </body>
    </html>
  );
}

export function renderPage(title: string, component: React.ReactNode) {
  const html = renderToString(<Layout title={title}>{component}</Layout>);
  return new Response(`<!DOCTYPE html>${html}`, {
    headers: { 'Content-Type': 'text/html' }
  });
}

import { Elysia } from 'elysia';
import { renderPage } from '../../components/layout';

export function NodesLayout({ children, activeTab }: { children: any, activeTab: string }) {
  const tabs = [
    { id: 'retrieval', label: 'Retrieval', href: '/nodes' },
    { id: 'adaptive', label: 'Adaptive', href: '/nodes/adaptive' },
    { id: 'documents', label: 'Documents', href: '/nodes/documents' },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Knowledge Nodes</h1>
        <p className="text-slate-500 mt-1">Manage your knowledge base, retrieval strategies, and document sources.</p>
      </div>

      <div className="border-b border-slate-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <a
              key={tab.id}
              href={tab.href}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                ${activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}
              `}
            >
              {tab.label}
            </a>
          ))}
        </nav>
      </div>

      {children}
    </div>
  );
}

export function RetrievalView() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 mb-4">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><title>Vector</title><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        </div>
        <h3 className="font-semibold text-slate-900">Vector Search</h3>
        <p className="text-sm text-slate-500 mt-2">Semantic similarity search using cosine distance on embeddings.</p>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs font-medium bg-green-100 text-green-700 px-2 py-1 rounded-full">Active</span>
          <button type="button" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">Configure</button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600 mb-4">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><title>Graph</title><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
        </div>
        <h3 className="font-semibold text-slate-900">Hybrid Search</h3>
        <p className="text-sm text-slate-500 mt-2">Combination of keyword-based (BM25) and vector search results.</p>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded-full">Inactive</span>
          <button type="button" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">Enable</button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600 mb-4">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><title>Graph</title><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
        </div>
        <h3 className="font-semibold text-slate-900">Graph Traversal</h3>
        <p className="text-sm text-slate-500 mt-2">Knowledge graph traversal for relationship-based retrieval.</p>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded-full">Inactive</span>
          <button type="button" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">Enable</button>
        </div>
      </div>
    </div>
  );
}

export function AdaptiveView() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100">
        <h3 className="font-semibold text-slate-900">Adaptive Learning Pipelines</h3>
        <p className="text-sm text-slate-500 mt-1">Configure how the system learns from interactions and updates the knowledge base.</p>
      </div>
      <div className="divide-y divide-slate-100">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-6 flex items-start gap-4">
            <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 flex-shrink-0">
              <span className="font-bold">{i}</span>
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium text-slate-900">Feedback Loop {i}</h4>
                  <p className="text-sm text-slate-500 mt-1">Automatically updates node weights based on user positive/negative feedback.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Last run: 2h ago</span>
                  <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                    <input type="checkbox" name="toggle" id={`toggle-${i}`} className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer"/>
                    <label htmlFor={`toggle-${i}`} className="toggle-label block overflow-hidden h-5 rounded-full bg-indigo-300 cursor-pointer"></label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DocumentsView() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center">
        <div className="relative max-w-md w-full">
          <input 
            type="text" 
            placeholder="Search documents..." 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><title>Search</title><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          </div>
        </div>
        <button type="button" className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><title>Upload</title><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
          Upload Document
        </button>
      </div>
      <table className="w-full text-sm text-left">
        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
          <tr>
            <th className="px-6 py-3 font-medium">Name</th>
            <th className="px-6 py-3 font-medium">Type</th>
            <th className="px-6 py-3 font-medium">Size</th>
            <th className="px-6 py-3 font-medium">Status</th>
            <th className="px-6 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {[1, 2, 3, 4].map((i) => (
            <tr key={i} className="hover:bg-slate-50">
              <td className="px-6 py-4 font-medium text-slate-900">Project_Specs_v{i}.pdf</td>
              <td className="px-6 py-4 text-slate-500">PDF</td>
              <td className="px-6 py-4 text-slate-500">2.4 MB</td>
              <td className="px-6 py-4">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Indexed
                </span>
              </td>
              <td className="px-6 py-4 text-right">
                <button type="button" className="text-slate-400 hover:text-red-600 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><title>Delete</title><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const nodesPageRoutes = new Elysia()
  .get('/nodes', () => renderPage('AgentCanvas - Nodes', <NodesLayout activeTab="retrieval"><RetrievalView /></NodesLayout>))
  .get('/nodes/adaptive', () => renderPage('AgentCanvas - Nodes', <NodesLayout activeTab="adaptive"><AdaptiveView /></NodesLayout>))
  .get('/nodes/documents', () => renderPage('AgentCanvas - Nodes', <NodesLayout activeTab="documents"><DocumentsView /></NodesLayout>));

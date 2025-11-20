import React from 'react';
import { Dashboard, type DashboardData } from '../../components/dashboard';
import { renderPage } from '../../components/layout';

export const dashboardPageRoutes = (data: DashboardData) => {
  return renderPage(
    'AgentCanvas - Dashboard',
    <Dashboard data={data} />
  );
}

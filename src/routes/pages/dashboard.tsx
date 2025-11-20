import React from 'react';
import { Dashboard, type DashboardData } from '../../components/dashboard';
import { renderPage } from '../../components/layout';
import { Elysia } from 'elysia';
import { dashboardRouteOptions, getDashboardDataHandler } from '~/lib/server/dashboard-data';

export const dashboardPageRoutes = new Elysia()
  .get('/', (response) => {
    // TODO: Continue from here... need to fix how to send data from server to components. The data is not returning as expecting with their functions and variables.
    console.log('response data', JSON.stringify(response, null, 2))
    const dashboardData = getDashboardDataHandler(response);
    return renderPage(
      'AgentCanvas - Dashboard',
      <Dashboard data={dashboardData} />
    )
  }, dashboardRouteOptions)
  

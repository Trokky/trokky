/**
 * DashboardContextSidebar - Context sidebar content for the dashboard page
 * 
 * Contains Recent Activity and other dashboard-specific contextual information
 */

import { ActivityFeed } from './ActivityFeed';

export function DashboardContextSidebar() {
  return (
    <div className="h-full">
      {/* Recent Activity takes full height of context sidebar */}
      <ActivityFeed limit={10} />
    </div>
  );
}
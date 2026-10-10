import type { ReactNode } from 'react';
import type { DashboardData } from '@/server/dashboard-data';
import { CalendarWidget, MyDayWidget, NextActionWidget, PrioritiesWidget } from './today';
import { EmailWidget, NewsWidget, ProjectsWidget, TasksWidget } from './organization';
import { AIWidget, FinanceWidget, HealthWidget, InvestmentsWidget, NotificationsWidget, TravelWidget } from './money-life';

/** id de widget → contenido. Añadir un widget = una línea aquí + una entrada en lib/widgets.ts. */
export function renderWidgets(d: DashboardData): Record<string, ReactNode> {
  return {
    myday: <MyDayWidget d={d} />,
    priorities: <PrioritiesWidget d={d} />,
    nextaction: <NextActionWidget d={d} />,
    calendar: <CalendarWidget d={d} />,
    email: <EmailWidget d={d} />,
    tasks: <TasksWidget d={d} />,
    news: <NewsWidget d={d} />,
    finance: <FinanceWidget d={d} />,
    investments: <InvestmentsWidget d={d} />,
    health: <HealthWidget d={d} />,
    projects: <ProjectsWidget d={d} />,
    travel: <TravelWidget d={d} />,
    notifications: <NotificationsWidget d={d} />,
    ai: <AIWidget />,
  };
}

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ThemeProvider } from './providers/theme-provider';
import { QueryProvider } from './providers/query-provider';
import { ShortcutProvider } from './providers/shortcut-provider';
import { TooltipProvider } from './components/ui/tooltip';
import { useAuthStore } from './stores/auth-store';
import { ROUTES } from './config/routes';
import { InboxPage } from './pages/inbox';
import { LoginPage } from './pages/login';
import { RegisterPage } from './pages/register';
import { InvitationPage } from './pages/invitation';
import { OAuthCallback } from './components/auth/oauth-callback';
import { SettingsPage, SettingsModal } from './pages/settings';
import { CalendarPage } from './pages/calendar';
import { DocsPage } from './pages/docs';
import { DrawPage } from './pages/draw';
import { TasksPage } from './pages/tasks';
import { TablesPage } from './pages/tables';
import { DrivePage } from './pages/drive';
import { MarketplacePage } from './pages/marketplace';
import { HomePage } from './pages/home';
import { CommandPalette } from './components/ui/command-palette';
import { ErrorBoundary } from './components/ui/error-boundary';
import { useEffect, type ReactNode } from 'react';
import { OrgLayout } from './pages/org/org-layout';
import { OrgOverviewPage } from './pages/org/org-overview';
import { OrgMembersPage } from './pages/org/org-members';
import { OrgAppsPage } from './pages/org/org-apps';
import { OrgSettingsPage } from './pages/org/org-settings';
import { ForgotPasswordPage } from './pages/forgot-password';
import { ResetPasswordPage } from './pages/reset-password';
import { AdminLayout, AdminProtectedRoute } from './pages/admin/admin-layout';
import { AdminOverviewPage } from './pages/admin/admin-overview';
import { AdminTenantsPage } from './pages/admin/admin-tenants';
import { AdminTenantDetailPage } from './pages/admin/admin-tenant-detail';
import { AdminInstallationsPage } from './pages/admin/admin-installations';
import { AdminContainersPage } from './pages/admin/admin-containers';

const DEV_MODE = import.meta.env.DEV && !import.meta.env.VITE_GOOGLE_CLIENT_ID;

function DevAuthInit() {
  const setAccount = useAuthStore((s) => s.setAccount);
  useEffect(() => {
    if (DEV_MODE) {
      setAccount({
        id: 'dev-account',
        userId: 'dev-user',
        email: 'demo@atlasmail.dev',
        name: 'Demo User',
        pictureUrl: null,
        provider: 'google',
        providerId: 'dev',
        historyId: null,
        lastSync: null,
        syncStatus: 'idle',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }, [setAccount]);
  return null;
}


/** Requires Google OAuth. Redirects to HOME if not authenticated. */
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading && !DEV_MODE) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: 'var(--color-bg-primary)',
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-family)',
          fontSize: 'var(--font-size-md)',
        }}
      >
        {t('common.loading')}
      </div>
    );
  }

  if (!isAuthenticated && !DEV_MODE) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  return <>{children}</>;
}

export function App() {
  return (
    <QueryProvider>
      <ThemeProvider>
        <TooltipProvider>
          <ShortcutProvider>
            <BrowserRouter>
            <DevAuthInit />
            <ErrorBoundary>
              <Routes>
                <Route path={ROUTES.LOGIN} element={<LoginPage />} />
                <Route path={ROUTES.REGISTER} element={<RegisterPage />} />
                <Route path={ROUTES.INVITATION} element={<InvitationPage />} />
                <Route path={ROUTES.AUTH_CALLBACK} element={<OAuthCallback />} />
                <Route path={ROUTES.FORGOT_PASSWORD} element={<ForgotPasswordPage />} />
                <Route path={ROUTES.RESET_PASSWORD} element={<ResetPasswordPage />} />
                <Route
                  path={ROUTES.HOME}
                  element={
                    <ProtectedRoute>
                      <HomePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path={ROUTES.INBOX}
                  element={
                    <ProtectedRoute>
                      <InboxPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path={ROUTES.SETTINGS}
                  element={
                    <ProtectedRoute>
                      <SettingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path={ROUTES.CALENDAR}
                  element={
                    <ProtectedRoute>
                      <CalendarPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path={ROUTES.DOCS}
                  element={<ProtectedRoute><DocsPage /></ProtectedRoute>}
                />
                <Route
                  path={ROUTES.DOC_DETAIL}
                  element={<ProtectedRoute><DocsPage /></ProtectedRoute>}
                />
                <Route
                  path={ROUTES.DRAW}
                  element={<ProtectedRoute><DrawPage /></ProtectedRoute>}
                />
                <Route
                  path={ROUTES.DRAW_DETAIL}
                  element={<ProtectedRoute><DrawPage /></ProtectedRoute>}
                />
                <Route
                  path={ROUTES.TASKS}
                  element={<ProtectedRoute><TasksPage /></ProtectedRoute>}
                />
                <Route
                  path={ROUTES.TABLES}
                  element={<ProtectedRoute><TablesPage /></ProtectedRoute>}
                />
                <Route
                  path={ROUTES.TABLE_DETAIL}
                  element={<ProtectedRoute><TablesPage /></ProtectedRoute>}
                />
                <Route
                  path={ROUTES.DRIVE}
                  element={<ProtectedRoute><DrivePage /></ProtectedRoute>}
                />
                <Route
                  path={ROUTES.DRIVE_FOLDER}
                  element={<ProtectedRoute><DrivePage /></ProtectedRoute>}
                />
                <Route
                  path={ROUTES.MARKETPLACE}
                  element={<ProtectedRoute><MarketplacePage /></ProtectedRoute>}
                />
                <Route
                  path={ROUTES.TENANT_USERS}
                  element={<Navigate to={ROUTES.ORG_MEMBERS} replace />}
                />
                {/* Org routes */}
                <Route
                  path={ROUTES.ORG}
                  element={<ProtectedRoute><OrgLayout /></ProtectedRoute>}
                >
                  <Route index element={<OrgOverviewPage />} />
                  <Route path="members" element={<OrgMembersPage />} />
                  <Route path="apps" element={<OrgAppsPage />} />
                  <Route path="settings" element={<OrgSettingsPage />} />
                </Route>
                {/* Admin routes */}
                <Route path={ROUTES.ADMIN_LOGIN} element={<Navigate to={ROUTES.LOGIN} replace />} />
                <Route
                  path={ROUTES.ADMIN}
                  element={
                    <AdminProtectedRoute>
                      <AdminLayout />
                    </AdminProtectedRoute>
                  }
                >
                  <Route index element={<AdminOverviewPage />} />
                  <Route path="tenants" element={<AdminTenantsPage />} />
                  <Route path="tenants/:id" element={<AdminTenantDetailPage />} />
                  <Route path="installations" element={<AdminInstallationsPage />} />
                  <Route path="containers" element={<AdminContainersPage />} />
                </Route>

                <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
              </Routes>
              <CommandPalette />
              <SettingsModal />
            </ErrorBoundary>
            </BrowserRouter>
          </ShortcutProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}

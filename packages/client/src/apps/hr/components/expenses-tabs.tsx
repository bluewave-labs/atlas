/**
 * ExpensesTabs — wraps the Expense-related sub-views in a horizontal tab bar.
 *
 * Replaces the old "Expenses" sidebar SECTION (with up to 6 individual
 * sidebar items) with a single sidebar item that opens this tabbed view.
 * The active tab is reflected in the URL via the `tab` search param and
 * persisted to localStorage as a fallback.
 *
 * Owns all expense-related transient state (selected expense, selected
 * report, form-open) so the parent HR page doesn't need to know about it.
 * The form modal + detail panel render at the bottom of this component.
 *
 * Tabs gating by HR app permission:
 *   - viewer (portal user): My expenses, Expense reports
 *   - editor: + Expense approvals
 *   - admin: + All expenses, Categories, Policies
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Tabs } from '../../../components/ui/tabs';
import { useMyAppPermission } from '../../../hooks/use-app-permissions';
import { usePendingExpenseCount, useExpense } from '../hooks';
import { MyExpensesView } from './expenses/my-expenses-view';
import { ExpenseApprovalsView } from './expenses/expense-approvals-view';
import { AllExpensesView } from './expenses/all-expenses-view';
import { ExpenseReportsView } from './expenses/expense-reports-view';
import { ExpenseReportDetail } from './expenses/expense-report-detail';
import { ExpenseCategoriesView } from './expenses/expense-categories-view';
import { ExpensePoliciesView } from './expenses/expense-policies-view';
import { ExpenseFormModal } from './expenses/expense-form-modal';
import { ExpenseDetailPanel } from './expenses/expense-detail-panel';

const EXPENSE_TABS = [
  'my-expenses',
  'expense-approvals',
  'all-expenses',
  'expense-reports',
  'expense-categories',
  'expense-policies',
] as const;
type ExpenseTabId = typeof EXPENSE_TABS[number];

const STORAGE_KEY = 'atlasmail_hr_expenses_tab';

function readPersistedTab(): ExpenseTabId | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw && (EXPENSE_TABS as readonly string[]).includes(raw)) {
      return raw as ExpenseTabId;
    }
  } catch { /* ignore */ }
  return null;
}

interface ExpensesTabsProps {
  searchQuery?: string;
}

export function ExpensesTabs({ searchQuery = '' }: ExpensesTabsProps) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: hrPerm } = useMyAppPermission('hr');
  const isAdmin = hrPerm?.role === 'admin';
  const canApprove = isAdmin || hrPerm?.role === 'editor';

  const { data: pendingExpenseRaw } = usePendingExpenseCount();
  // The hook returns either a number or { count } depending on the
  // server response shape — normalise to a plain number here.
  const pendingExpenseCount: number =
    typeof pendingExpenseRaw === 'number'
      ? pendingExpenseRaw
      : (pendingExpenseRaw as { count?: number } | undefined)?.count ?? 0;

  // Internal expense state (lifted out of HrPage so the parent doesn't
  // need to know about expense lifecycle).
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  // When opening the form to edit an existing expense, stash it here.
  // When creating new, stays null.
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const { data: selectedExpense } = useExpense(selectedExpenseId ?? undefined);
  const { data: editingExpense } = useExpense(editingExpenseId ?? undefined);

  // Auto-open create modal from quick action URL param
  useEffect(() => {
    if (searchParams.get('action') === 'create') {
      setShowExpenseForm(true);
      const next = new URLSearchParams(searchParams);
      next.delete('action');
      setSearchParams(next, { replace: true });
    }
  }, []);

  // Resolve the active tab: URL > localStorage > default 'my-expenses'.
  const urlTab = searchParams.get('tab') as ExpenseTabId | null;
  const persistedTab = readPersistedTab();
  const activeTab: ExpenseTabId =
    urlTab && (EXPENSE_TABS as readonly string[]).includes(urlTab)
      ? urlTab
      : persistedTab ?? 'my-expenses';

  useEffect(() => {
    if (!urlTab) {
      const next = new URLSearchParams(searchParams);
      next.set('tab', activeTab);
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlTab]);

  const handleChange = (id: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', id);
    setSearchParams(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch { /* ignore */ }
    // Clear the report-detail sub-state when leaving the reports tab.
    if (id !== 'expense-reports') {
      setSelectedReportId(null);
    }
  };

  const tabs = [
    { id: 'my-expenses', label: t('hr.expenses.sidebar.myExpenses') },
    {
      id: 'expense-approvals',
      label: t('hr.expenses.sidebar.expenseApprovals'),
      count: pendingExpenseCount,
      hidden: !canApprove,
    },
    {
      id: 'all-expenses',
      label: t('hr.expenses.sidebar.allExpenses'),
      hidden: !isAdmin,
    },
    { id: 'expense-reports', label: t('hr.expenses.sidebar.expenseReports') },
    {
      id: 'expense-categories',
      label: t('hr.expenses.sidebar.expenseCategories'),
      hidden: !isAdmin,
    },
    {
      id: 'expense-policies',
      label: t('hr.expenses.sidebar.expensePolicies'),
      hidden: !isAdmin,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <Tabs tabs={tabs} activeTab={activeTab} onChange={handleChange} />
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'my-expenses' && (
          <MyExpensesView
            onSelect={setSelectedExpenseId}
            onAdd={() => setShowExpenseForm(true)}
            searchQuery={searchQuery}
            selectedId={selectedExpenseId}
          />
        )}
        {activeTab === 'expense-approvals' && canApprove && <ExpenseApprovalsView />}
        {activeTab === 'all-expenses' && isAdmin && (
          <AllExpensesView onSelect={setSelectedExpenseId} selectedId={selectedExpenseId} />
        )}
        {activeTab === 'expense-reports' && !selectedReportId && (
          <ExpenseReportsView onSelectReport={(id) => setSelectedReportId(id)} />
        )}
        {activeTab === 'expense-reports' && selectedReportId && (
          <ExpenseReportDetail reportId={selectedReportId} onBack={() => setSelectedReportId(null)} />
        )}
        {activeTab === 'expense-categories' && isAdmin && <ExpenseCategoriesView />}
        {activeTab === 'expense-policies' && isAdmin && <ExpensePoliciesView />}
      </div>

      {/* Modals + side panels — local to the Expenses tabs view */}
      {showExpenseForm && (
        <ExpenseFormModal
          open={showExpenseForm}
          onClose={() => {
            setShowExpenseForm(false);
            setEditingExpenseId(null);
          }}
          expense={editingExpense ?? null}
        />
      )}
      {selectedExpenseId && selectedExpense && (
        <ExpenseDetailPanel
          expense={selectedExpense}
          onClose={() => setSelectedExpenseId(null)}
          onEdit={() => {
            setEditingExpenseId(selectedExpenseId);
            setShowExpenseForm(true);
          }}
        />
      )}
    </div>
  );
}

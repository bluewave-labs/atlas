import hrRouter from './routes';
import type { ServerAppManifest } from '../../config/app-manifest.server';
import type { EntityObjectMeta } from '@atlasmail/shared';

const objects: EntityObjectMeta[] = [
  {
    id: 'employees',
    name: 'Employees',
    iconName: 'Users',
    tableName: 'employees',
    description: 'Team members and staff records',
    standardFields: [
      { name: 'Name', slug: 'name', fieldType: 'text', isRequired: true },
      { name: 'Email', slug: 'email', fieldType: 'email', isRequired: true },
      { name: 'Phone', slug: 'phone', fieldType: 'phone', isRequired: false },
      { name: 'Department', slug: 'department_id', fieldType: 'relation', isRequired: false },
      { name: 'Role', slug: 'role', fieldType: 'text', isRequired: true },
      { name: 'Start date', slug: 'start_date', fieldType: 'date', isRequired: false },
      { name: 'Status', slug: 'status', fieldType: 'select', isRequired: true },
      { name: 'Avatar URL', slug: 'avatar_url', fieldType: 'url', isRequired: false },
      { name: 'Tags', slug: 'tags', fieldType: 'multi_select', isRequired: false },
      { name: 'Date of birth', slug: 'date_of_birth', fieldType: 'date', isRequired: false },
      { name: 'Gender', slug: 'gender', fieldType: 'select', isRequired: false },
      { name: 'Employment type', slug: 'employment_type', fieldType: 'select', isRequired: false },
      { name: 'Manager', slug: 'manager_id', fieldType: 'relation', isRequired: false },
      { name: 'Job title', slug: 'job_title', fieldType: 'text', isRequired: false },
      { name: 'Work location', slug: 'work_location', fieldType: 'text', isRequired: false },
      { name: 'Salary', slug: 'salary', fieldType: 'number', isRequired: false },
    ],
    relations: [
      { targetObjectId: 'hr:departments', type: 'many-to-one', foreignKey: 'department_id' },
    ],
  },
  {
    id: 'departments',
    name: 'Departments',
    iconName: 'Building2',
    tableName: 'departments',
    description: 'Organizational units and teams',
    standardFields: [
      { name: 'Name', slug: 'name', fieldType: 'text', isRequired: true },
      { name: 'Description', slug: 'description', fieldType: 'text', isRequired: false },
      { name: 'Head employee', slug: 'head_employee_id', fieldType: 'relation', isRequired: false },
      { name: 'Color', slug: 'color', fieldType: 'text', isRequired: true },
    ],
    relations: [
      { targetObjectId: 'hr:employees', type: 'one-to-many' },
    ],
  },
  {
    id: 'leave_balances',
    name: 'Leave balances',
    iconName: 'CalendarDays',
    tableName: 'leave_balances',
    description: 'Employee leave allocation and usage tracking',
    standardFields: [
      { name: 'Leave type', slug: 'leave_type', fieldType: 'select', isRequired: true },
      { name: 'Year', slug: 'year', fieldType: 'number', isRequired: true },
      { name: 'Allocated', slug: 'allocated', fieldType: 'number', isRequired: true },
      { name: 'Used', slug: 'used', fieldType: 'number', isRequired: true },
      { name: 'Carried', slug: 'carried', fieldType: 'number', isRequired: false },
    ],
    relations: [
      { targetObjectId: 'hr:employees', type: 'many-to-one', foreignKey: 'employee_id' },
    ],
  },
  {
    id: 'onboarding_tasks',
    name: 'Onboarding tasks',
    iconName: 'CheckSquare',
    tableName: 'onboarding_tasks',
    description: 'New hire onboarding checklist items',
    standardFields: [
      { name: 'Title', slug: 'title', fieldType: 'text', isRequired: true },
      { name: 'Description', slug: 'description', fieldType: 'text', isRequired: false },
      { name: 'Category', slug: 'category', fieldType: 'select', isRequired: true },
      { name: 'Due date', slug: 'due_date', fieldType: 'date', isRequired: false },
    ],
    relations: [
      { targetObjectId: 'hr:employees', type: 'many-to-one', foreignKey: 'employee_id' },
    ],
  },
  {
    id: 'employee_documents',
    name: 'Employee documents',
    iconName: 'FileText',
    tableName: 'employee_documents',
    description: 'Employee-related documents and files',
    standardFields: [
      { name: 'Name', slug: 'name', fieldType: 'text', isRequired: true },
      { name: 'Type', slug: 'type', fieldType: 'select', isRequired: true },
      { name: 'Expires at', slug: 'expires_at', fieldType: 'date', isRequired: false },
      { name: 'Notes', slug: 'notes', fieldType: 'text', isRequired: false },
    ],
    relations: [
      { targetObjectId: 'hr:employees', type: 'many-to-one', foreignKey: 'employee_id' },
    ],
  },
];

export const hrServerManifest: ServerAppManifest = {
  id: 'hr',
  name: 'HR',
  labelKey: 'sidebar.hr',
  iconName: 'Users',
  color: '#10b981',
  minPlan: 'starter',
  category: 'productivity',
  dependencies: [],
  defaultEnabled: true,
  version: '1.0.0',
  router: hrRouter,
  routePrefix: '/hr',
  tables: [
    'employees', 'departments', 'time_off_requests', 'leave_balances', 'onboarding_tasks', 'onboarding_templates', 'employee_documents',
    'hr_leave_types', 'hr_leave_policies', 'hr_leave_policy_assignments',
    'hr_holiday_calendars', 'hr_holidays', 'hr_leave_applications',
    'hr_attendance', 'hr_lifecycle_events',
  ],
  objects,
};

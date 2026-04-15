import type { Request, Response } from 'express';

// Re-export ported task handlers
export {
  listTasks,
  createTask,
  searchTasks,
  getTaskCounts,
  getTask,
  updateTask,
  deleteTask,
  reorderTasks,
  listSubtasks,
  createSubtask,
  updateSubtask,
  deleteSubtask,
  reorderSubtasks,
  listActivities,
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  createTaskFromTemplate,
  listComments,
  createComment,
  deleteComment,
  listAttachments,
  uploadAttachment,
  deleteAttachment,
  downloadAttachment,
  listDependencies,
  addDependency,
  removeDependency,
  getBlockedTaskIds,
} from './controllers/tasks.controller';

// Stubs for project/financials handlers (implemented in later tasks)
const NOT_IMPLEMENTED = (_req: Request, res: Response) => {
  res.status(501).json({ success: false, error: 'Not implemented yet' });
};

export const listProjects = NOT_IMPLEMENTED;
export const createProject = NOT_IMPLEMENTED;
export const getProject = NOT_IMPLEMENTED;
export const updateProject = NOT_IMPLEMENTED;
export const deleteProject = NOT_IMPLEMENTED;

export const listProjectMembers = NOT_IMPLEMENTED;
export const addProjectMember = NOT_IMPLEMENTED;
export const removeProjectMember = NOT_IMPLEMENTED;

export const listProjectTimeEntries = NOT_IMPLEMENTED;
export const createProjectTimeEntry = NOT_IMPLEMENTED;
export const updateProjectTimeEntry = NOT_IMPLEMENTED;
export const deleteProjectTimeEntry = NOT_IMPLEMENTED;

export const listProjectFiles = NOT_IMPLEMENTED;
export const getProjectFinancials = NOT_IMPLEMENTED;

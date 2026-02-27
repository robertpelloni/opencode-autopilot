export interface SubTask {
  id: string;
  title: string;
  description: string;
  dependencies: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  assignedSupervisor?: string;
  context?: string;
}

export interface TaskPlan {
  originalTaskId: string;
  subtasks: SubTask[];
  reasoning: string;
}

import TaskManager from "@/components/tasks/TaskManager";

export default function DetailTasksTab({ project, members, onRefresh }) {
  return (
          <div className="space-y-4">
            <TaskManager
              mode="project"
              projectId={project.id}
              userId={project.owner_id || "sa"}
              userName={project.owner_name || "Project Owner"}
              projects={[{ id: project.id, name: project.name }]}
              projectMembers={members}
              taskList={project.tasks || []}
              onTasksChange={onRefresh}
              showCarryOver={false}
            />
          </div>
  );
}

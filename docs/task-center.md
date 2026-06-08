# Task Center

Koravo task APIs expose platform DTOs through `/api/v1`; controllers do not access Flowable native services directly.

## My Tasks

```http
GET /api/v1/tasks/my?page=1&pageSize=20
```

The response contains the current user's assigned runtime tasks.

## Done Tasks

```http
GET /api/v1/tasks/done?page=1&pageSize=20
```

The response contains finished historic tasks assigned to the current user.

## Started Instances

```http
GET /api/v1/tasks/started?page=1&pageSize=20
```

The response contains process instances started by the current user. The console shows these under the Started tab and links the user to the process instance detail page for tracing and operational inspection.

The `/process-instances` console page loads deployed process models from `GET /api/v1/process-models?status=DEPLOYED`. Selecting a model fills the process definition key for start, while the key field remains editable for direct API calls.

## Task Detail

```http
GET /api/v1/tasks/{taskId}
```

The task detail response includes:

- task metadata: task ID, name, process instance ID, definition ID, business key, assignee, task definition key
- task status: `RUNNING` for active tasks and `COMPLETED` for finished historic tasks
- bound form schema, if a binding exists for `processDefinitionId + taskDefinitionKey`
- process variables
- task variables
- task comments
- historical form snapshots for the process instance
- task audit logs, such as `TASK_COMPLETE`

`GET /api/v1/tasks/{taskId}` supports both active runtime tasks and completed historic tasks assigned to the current user. For completed tasks, task variables are read from Flowable historic variables while process variables, comments, form snapshots, and audit logs remain available for review.

Form snapshots are stored in `ko_form_snapshot`. They preserve submitted form data, form schema version, schema JSON, and UI schema JSON at completion time, so historic review does not depend on the latest form schema or latest task variables. The console task detail snapshot drawer renders saved data as a structured business table.
Task audit logs are queried from `ko_audit_log` by `resourceType = TASK` and `resourceId = taskId`.

The console task detail page links directly to `/process-instances/{instanceId}` so approvers can move from a task to the BPMN trace, timeline, current tasks, variables, and saved form snapshots without switching through Ops first.
For completed historic tasks, the console switches to review mode: comments, variables, snapshots, and audit logs remain visible, while the completion form is hidden.

## Complete Task

```http
POST /api/v1/tasks/{taskId}/complete
```

Body:

```json
{
  "variables": {
    "approved": true
  },
  "formData": {
    "reason": "approved from Koravo workflow"
  },
  "formSchemaId": "form-1",
  "comment": "approved"
}
```

Completion behavior:

- saves `formData` as a form snapshot when `formSchemaId` is present or the task has a bound form schema
- writes Flowable task comments when `comment` is present
- completes the Flowable task through `ProcessFacade`
- writes a `TASK_COMPLETE` audit log with task ID, process instance ID, business key, task definition key, and form schema ID when available
- renders simple bound form schema fields in the task detail page
- renders purchase approval tasks with dedicated conclusion and opinion controls
- validates required business fields before submitting the request

## Current Limits

- Advanced form widgets, nested groups, arrays, and conditional fields remain roadmap items for the console.

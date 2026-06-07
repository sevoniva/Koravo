# Task Center

Koravo task APIs expose platform DTOs through `/api/v1`; controllers do not access Flowable native services directly.

## My Tasks

```http
GET /api/v1/tasks/my?page=1&pageSize=20
```

The response contains the current user's assigned runtime tasks.

## Task Detail

```http
GET /api/v1/tasks/{taskId}
```

The task detail response includes:

- task metadata: task ID, name, process instance ID, definition ID, business key, assignee, task definition key
- bound form schema, if a binding exists for `processDefinitionId + taskDefinitionKey`
- process variables
- task variables
- task comments
- historical form snapshots for the process instance

Form snapshots are stored in `ko_form_snapshot`. They preserve submitted form data at completion time, so historic review does not depend on the latest form schema or latest task variables.

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
    "reason": "approved from Koravo demo"
  },
  "formSchemaId": "form-1",
  "comment": "approved"
}
```

Completion behavior:

- saves `formData` as a form snapshot when `formSchemaId` is present
- writes Flowable task comments when `comment` is present
- completes the Flowable task through `ProcessFacade`
- writes a `TASK_COMPLETE` audit log

## Current Limits

- Done tasks and initiated-by-me lists are still planned for the next task center iteration.
- Form rendering is still JSON-oriented in the console; schema-driven controls are the next frontend step.

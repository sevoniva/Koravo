# Process Tracing

Koravo exposes process tracing through platform APIs, not Flowable native services in controllers.

## APIs

- `GET /api/v1/ops/process-instances?page=1&pageSize=20`
- `GET /api/v1/ops/process-instances/{instanceId}`
- `GET /api/v1/ops/process-instances/{instanceId}/trace`

Trace includes:

- process instance ID
- process definition ID
- business key
- status
- BPMN XML
- current activity IDs
- current tasks
- process variables
- historic activity timeline

## Console

The process instance detail page at `/process-instances/{instanceId}` renders:

- instance metadata
- BPMN trace diagram
- current tasks
- historic activity timeline
- process variable summary

The process instance start/list page links each started instance directly to Ops trace with `/ops?view=trace&instanceId={instanceId}`. This keeps the demo flow short after starting a process: start, open trace, inspect current tasks and completed activities.

The task detail page exposes a `Trace Instance` action that opens the same process instance detail page for the task's process instance. This keeps the approval flow connected: review task metadata, inspect bound form snapshots, then jump straight to the BPMN trace and timeline.

Ops also renders trace BPMN XML with `bpmn-js`:

- completed activities are highlighted
- current activities are highlighted
- timeline remains available as a table
- raw JSON remains available for troubleshooting

## Instance Actions

Ops supports:

- suspend
- activate
- terminate with reason

These actions are tenant scoped and audited.

## Current Limits

- Failed jobs, dead-letter jobs, retry, and migration APIs are reserved for the next Ops iteration.

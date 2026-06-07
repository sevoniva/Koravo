# Form Binding

Koravo separates form schema management from Flowable variables. Form schemas are stored in platform tables, and submitted form data is saved as immutable snapshots when tasks are completed.

## Form Schema APIs

- `POST /api/v1/forms/schemas`: create schema
- `GET /api/v1/forms/schemas`: list schemas
- `GET /api/v1/forms/schemas/{id}`: get schema detail
- `PUT /api/v1/forms/schemas/{id}`: update schema

Schema payloads include:

- `formKey`
- `formName`
- `schemaJson`
- `uiSchemaJson`

## Binding APIs

- `POST /api/v1/form-bindings`: bind a form schema to a task node
- `GET /api/v1/form-bindings?processModelId={id}`: list bindings

Bindings can target:

- `processModelId + taskDefinitionKey`
- `processDefinitionId + taskDefinitionKey`

Task detail resolves binding by `processDefinitionId + taskDefinitionKey` and returns the bound form schema when present.

## Snapshot Behavior

When completing a task, clients can submit:

```json
{
  "variables": {
    "approved": true
  },
  "formData": {
    "reason": "approved"
  },
  "formSchemaId": "form-1",
  "comment": "approved"
}
```

If `formData` and `formSchemaId` are present, Koravo writes a `ko_form_snapshot` row with:

- process instance ID
- task ID
- form schema ID
- submitted JSON data
- tenant/user audit fields

Task detail returns historical snapshots for the process instance so review does not depend on the latest form schema.

## Audit

Form schema create/update writes `FORM_SCHEMA_CREATE` and `FORM_SCHEMA_UPDATE`. Form binding writes `FORM_BIND`. Task completion writes `TASK_COMPLETE`.

## Current Limits

- The console currently uses JSON text areas for form data. Schema-driven form rendering is planned.
- Binding update/delete APIs are not implemented yet.

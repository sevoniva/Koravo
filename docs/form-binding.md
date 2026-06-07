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
- `GET /api/v1/form-bindings?processModelId={id}`: list model-scoped bindings
- `GET /api/v1/form-bindings?processDefinitionId={id}`: list definition-scoped bindings
- `PUT /api/v1/form-bindings/{id}`: update a binding
- `DELETE /api/v1/form-bindings/{id}`: soft delete a binding

Bindings can target:

- `processModelId + taskDefinitionKey`
- `processDefinitionId + taskDefinitionKey`

Runtime task detail and task completion first resolve binding by `processDefinitionId + taskDefinitionKey`. If no definition-scoped binding exists, Koravo looks up the deployed process model by Flowable definition ID and falls back to `processModelId + taskDefinitionKey`.
Use `processDefinitionId` when binding a Flowable definition directly. Use `processModelId` when binding a stored model from the model center; after deployment, runtime tasks can still find that model-scoped binding.
The `/form-bindings` console page can load deployed models, fill both the platform `processModelId` and Flowable `processDefinitionId`, and filter the list to bindings for the selected deployment while keeping both fields editable for direct API demos.
The console renders simple JSON Schema object fields for bound task forms. Supported field types are `string`, `number`, `integer`, and `boolean`; complex schema constructs can still be submitted through the raw JSON form data editor.
The console validates form schema, UI schema, variables, and raw form data inputs as JSON objects before calling the API.

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

If `formData` is present, Koravo writes a `ko_form_snapshot` row when the request includes `formSchemaId` or the task has a bound form schema:

- process instance ID
- task ID
- form schema ID
- form schema version
- schema JSON and UI schema JSON snapshot
- submitted JSON data
- tenant/user audit fields

Task detail returns historical snapshots for the process instance so review does not depend on the latest form schema or latest task variables.

## Audit

Form schema create/update writes `FORM_SCHEMA_CREATE` and `FORM_SCHEMA_UPDATE`. Form binding create/update/delete writes `FORM_BIND`, `FORM_BIND_UPDATE`, and `FORM_BIND_DELETE`. Task completion writes `TASK_COMPLETE`.
Form binding audit details include the target `processModelId` or `processDefinitionId`, `taskDefinitionKey`, and `formSchemaId` so operators can trace which task node received a form binding.

## Current Limits

- Advanced JSON Schema constructs such as arrays, nested objects, conditional schemas, and custom widgets still use the raw JSON fallback in the console.

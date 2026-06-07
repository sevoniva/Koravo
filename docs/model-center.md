# Model Center

Koravo stores process model metadata and BPMN XML in platform tables before deploying to Flowable. The model center is the product boundary for draft, validation, deployment, export, and lifecycle state.

## Status

Supported model states:

- `DRAFT`
- `DEPLOYED`
- `DISABLED`
- `ARCHIVED`

The model API writes `ko_process_model` rows with model key, name, version, status, BPMN XML, Flowable deployment ID, and Flowable process definition ID.

## APIs

- `POST /api/v1/process-models`: create a draft model
- `POST /api/v1/process-models/import`: import BPMN XML as a draft model
- `GET /api/v1/process-models?status=DRAFT`: list models
- `GET /api/v1/process-models/{id}`: get model detail
- `PUT /api/v1/process-models/{id}`: update draft content
- `POST /api/v1/process-models/{id}/validate`: validate stored BPMN XML
- `POST /api/v1/process-models/validate`: validate raw BPMN XML
- `POST /api/v1/process-models/{id}/deploy`: deploy stored BPMN XML
- `POST /api/v1/process-models/{id}/disable`: disable a model
- `POST /api/v1/process-models/{id}/archive`: archive a model
- `GET /api/v1/process-models/{id}/export`: download BPMN XML
- `POST /api/v1/process-models/deploy`: legacy multipart deploy shortcut for examples

Validation returns structured `errors` and `warnings`, not a boolean-only result.

## Audit

The model service records audit events:

- `PROCESS_MODEL_CREATE`
- `PROCESS_MODEL_IMPORT`
- `PROCESS_MODEL_UPDATE`
- `PROCESS_MODEL_DEPLOY`
- `PROCESS_MODEL_DISABLE`
- `PROCESS_MODEL_ARCHIVE`

Creating a blank/default draft writes `PROCESS_MODEL_CREATE`; importing BPMN XML writes `PROCESS_MODEL_IMPORT`. Both stored draft deployment and the legacy multipart deploy shortcut write `PROCESS_MODEL_DEPLOY`.

## Console

Use `/process-models` to list models by status, inspect metadata, deploy stored drafts, export BPMN XML, disable models, and archive models.

Use `/process-designer` to create, edit, import, export, validate, save, and deploy BPMN with `bpmn-js`.

The default new process is:

```text
startEvent -> userTask -> endEvent
```

The default user task assignee is `${approver}`.

For newly created drafts, the designer synchronizes the BPMN process `id` and `name` with the Model key and Model name fields before validation or saving. Existing models keep their stored BPMN identity unless edited directly in the canvas/XML.

## Current Limits

- Visual property editing is still minimal. Advanced extension editing is done through BPMN XML or bpmn-js canvas editing.
- Model version branching is represented by incremented version metadata, not by a full diff/merge UI.

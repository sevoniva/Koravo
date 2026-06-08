import { PlusOutlined } from '@ant-design/icons';
import {
  ModalForm,
  PageContainer,
  ProFormDependency,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProTable,
  type ActionType,
  type ProColumns,
} from '@ant-design/pro-components';
import { Button, Form, Modal, Space, Typography, message } from 'antd';
import React, { useRef, useState } from 'react';
import { CopyableText } from '@/components/CopyableText';
import {
  createFormBinding,
  deleteFormBinding,
  listFormBindings,
  listFormSchemas,
  listProcessModelTaskDefinitions,
  listProcessModels,
  updateFormBinding,
  type FormBindingItem,
  type FormSchemaItem,
  type ProcessModelItem,
} from '@/services/koravo/api';
import { processDisplayName, taskDefinitionLabel } from '@/utils/display';

interface BindingForm {
  processModelId?: string;
  processDefinitionId?: string;
  taskDefinitionKey: string;
  formSchemaId: string;
  formSchemaVersion: number;
}

type BindingTableItem = FormBindingItem & {
  processModel?: ProcessModelItem;
  formSchema?: FormSchemaItem;
};

function modelBindingLabel(record: BindingTableItem) {
  if (!record.processModel) {
    return record.processModelId ? (
      <CopyableText value={record.processModelId} />
    ) : (
      '-'
    );
  }

  return (
    <Space orientation="vertical" size={0}>
      <Typography.Text>
        {processDisplayName(
          record.processModel.modelKey,
          record.processModel.modelName,
        )}
      </Typography.Text>
      <CopyableText
        value={record.processModelId}
        displayValue={record.processModel.modelKey}
      />
    </Space>
  );
}

function formBindingLabel(record: BindingTableItem) {
  if (!record.formSchema) {
    return <CopyableText value={record.formSchemaId} />;
  }

  return (
    <Space orientation="vertical" size={0}>
      <Typography.Text>{record.formSchema.formName}</Typography.Text>
      <CopyableText
        value={record.formSchemaId}
        displayValue={`${record.formSchema.formKey} v${record.formSchema.version}`}
      />
    </Space>
  );
}

const BindingFormItems: React.FC = () => {
  const form = Form.useFormInstance();

  return (
    <>
      <ProFormSelect
        name="processModelId"
        label="流程模型"
        rules={[{ required: true, message: '请选择流程模型' }]}
        fieldProps={{
          showSearch: true,
          optionFilterProp: 'label',
          onChange: () => form.setFieldValue('taskDefinitionKey', undefined),
        }}
        request={async () =>
          (await listProcessModels()).map((item) => ({
            label: `${processDisplayName(item.modelKey, item.modelName)}（${item.modelKey}）`,
            value: item.id,
          }))
        }
      />
      <ProFormText name="processDefinitionId" label="流程定义 ID" />
      <ProFormDependency name={['processModelId']}>
        {({ processModelId }) => (
          <ProFormSelect
            key={processModelId || 'task-definition'}
            name="taskDefinitionKey"
            label="任务节点"
            disabled={!processModelId}
            rules={[{ required: true, message: '请选择任务节点' }]}
            params={{ processModelId }}
            placeholder={
              processModelId ? '请选择任务节点' : '先选择流程模型'
            }
            fieldProps={{
              showSearch: true,
              optionFilterProp: 'label',
            }}
            request={async () => {
              if (!processModelId) return [];
              return (await listProcessModelTaskDefinitions(processModelId)).map(
                (task) => ({
                  label: `${taskDefinitionLabel(task.taskDefinitionKey, task)}（${task.taskDefinitionKey}）`,
                  value: task.taskDefinitionKey,
                }),
              );
            }}
          />
        )}
      </ProFormDependency>
      <ProFormSelect
        name="formSchemaId"
        label="表单"
        rules={[{ required: true, message: '请选择表单' }]}
        fieldProps={{
          showSearch: true,
          optionFilterProp: 'label',
        }}
        request={async () =>
          (await listFormSchemas()).map((item) => ({
            label: `${item.formName}（${item.formKey} v${item.version}）`,
            value: item.id,
          }))
        }
      />
      <ProFormDigit
        name="formSchemaVersion"
        label="表单版本"
        min={1}
        initialValue={1}
        rules={[{ required: true, message: '请输入表单版本' }]}
      />
    </>
  );
};

const FormBindings: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const [editing, setEditing] = useState<FormBindingItem>();
  const [modal, contextHolder] = Modal.useModal();

  const columns: ProColumns<BindingTableItem>[] = [
    {
      title: '流程模型',
      dataIndex: 'processModelId',
      ellipsis: true,
      render: (_, record) => modelBindingLabel(record),
    },
    {
      title: '流程定义',
      dataIndex: 'processDefinitionId',
      ellipsis: true,
      render: (_, record) => <CopyableText value={record.processDefinitionId} />,
    },
    {
      title: '任务节点',
      dataIndex: 'taskDefinitionKey',
      width: 160,
      renderText: (value) => taskDefinitionLabel(value),
    },
    {
      title: '表单编号',
      dataIndex: 'formSchemaId',
      ellipsis: true,
      render: (_, record) => formBindingLabel(record),
    },
    {
      title: '表单版本',
      dataIndex: 'formSchemaVersion',
      width: 100,
      search: false,
      renderText: (value) => `v${value || 1}`,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 140,
      render: (_, record) => [
        <Button key="edit" type="link" onClick={() => setEditing(record)}>
          编辑
        </Button>,
        <Button
          key="delete"
          type="link"
          danger
          onClick={() => {
            modal.confirm({
              title: '删除表单绑定',
              content: '确认删除该任务节点的表单绑定？',
              okText: '删除',
              cancelText: '取消',
              onOk: async () => {
                await deleteFormBinding(record.id);
                message.success('已删除');
                actionRef.current?.reload();
              },
            });
          }}
        >
          删除
        </Button>,
      ],
    },
  ];

  return (
    <PageContainer title="表单绑定" content="将流程任务节点绑定到指定表单版本。">
      {contextHolder}
      <ProTable<BindingTableItem>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        scroll={{ x: 1000 }}
        request={async () => {
          const [bindings, models, schemas] = await Promise.all([
            listFormBindings(),
            listProcessModels(),
            listFormSchemas(),
          ]);
          const modelMap = new Map(models.map((item) => [item.id, item]));
          const schemaMap = new Map(schemas.map((item) => [item.id, item]));
          return {
            data: bindings.map((item) => ({
              ...item,
              processModel: item.processModelId
                ? modelMap.get(item.processModelId)
                : undefined,
              formSchema: schemaMap.get(item.formSchemaId),
            })),
            success: true,
          };
        }}
        search={{ labelWidth: 'auto' }}
        toolBarRender={() => [
          <ModalForm<BindingForm>
            key="create"
            title="新建表单绑定"
            trigger={
              <Button type="primary" icon={<PlusOutlined />}>
                新建绑定
              </Button>
            }
            modalProps={{ destroyOnHidden: true }}
            onFinish={async (values) => {
              await createFormBinding(values);
              message.success('已创建');
              actionRef.current?.reload();
              return true;
            }}
          >
            <BindingFormItems />
          </ModalForm>,
        ]}
      />

      <ModalForm<BindingForm>
        key={editing?.id || 'edit-binding'}
        title="编辑表单绑定"
        open={Boolean(editing)}
        initialValues={editing}
        modalProps={{
          destroyOnHidden: true,
          onCancel: () => setEditing(undefined),
        }}
        onOpenChange={(open) => {
          if (!open) setEditing(undefined);
        }}
        onFinish={async (values) => {
          if (!editing) return false;
          await updateFormBinding(editing.id, values);
          message.success('已保存');
          setEditing(undefined);
          actionRef.current?.reload();
          return true;
        }}
      >
        <BindingFormItems />
      </ModalForm>
    </PageContainer>
  );
};

export default FormBindings;

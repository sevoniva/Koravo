import { PlusOutlined } from '@ant-design/icons';
import {
  ModalForm,
  PageContainer,
  ProFormDependency,
  ProFormSelect,
  ProFormText,
  ProTable,
  type ActionType,
  type ProColumns,
} from '@ant-design/pro-components';
import { history, useLocation } from '@umijs/max';
import { Alert, App, Button, Empty, Flex, Form, Modal, Space, Tag, Typography } from 'antd';
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
import {
  formSchemaNameLabel,
  formSchemaOptionLabel,
  processDisplayName,
  taskDefinitionLabel,
} from '@/utils/display';

interface BindingForm {
  bindingType?: 'START' | 'TASK';
  processModelId?: string;
  processDefinitionId?: string;
  taskDefinitionKey?: string;
  formSchemaId: string;
  formSchemaVersion: number;
}

type BindingTableItem = FormBindingItem & {
  processModel?: ProcessModelItem;
  formSchema?: FormSchemaItem;
};

const START_FORM_TASK_KEY = '__START__';

function bindingPayload(values: BindingForm) {
  const taskDefinitionKey =
    values.bindingType === 'START'
      ? START_FORM_TASK_KEY
      : values.taskDefinitionKey || '';
  return {
    processModelId: values.processModelId,
    processDefinitionId: values.processDefinitionId,
    taskDefinitionKey,
    formSchemaId: values.formSchemaId,
    formSchemaVersion: Number(values.formSchemaVersion || 1),
  };
}

function bindingTypeOf(binding?: Pick<FormBindingItem, 'taskDefinitionKey'>) {
  return binding?.taskDefinitionKey === START_FORM_TASK_KEY ? 'START' : 'TASK';
}

function useQueryProcessModelId() {
  const location = useLocation();
  return React.useMemo(() => {
    return new URLSearchParams(location.search).get('processModelId') || undefined;
  }, [location.search]);
}

function useQueryFormSchemaId() {
  const location = useLocation();
  return React.useMemo(() => {
    return new URLSearchParams(location.search).get('formSchemaId') || undefined;
  }, [location.search]);
}

function modelBindingLabel(record: BindingTableItem) {
  if (!record.processModel) {
    return record.processModelId ? '未匹配流程模型' : '-';
  }

  return (
    <Flex vertical gap={0}>
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
    </Flex>
  );
}

function formBindingLabel(record: BindingTableItem) {
  if (!record.formSchema) {
    return record.formSchemaId ? '未匹配表单' : '-';
  }

  return (
    <Flex vertical gap={0}>
      <Typography.Text>{formSchemaNameLabel(record.formSchema.formName)}</Typography.Text>
      <CopyableText
        value={record.formSchemaId}
        displayValue={`${record.formSchema.formKey} v${record.formSchema.version}`}
      />
    </Flex>
  );
}

function bindingTargetLabel(record: Pick<FormBindingItem, 'taskDefinitionKey'>) {
  if (record.taskDefinitionKey === START_FORM_TASK_KEY) {
    return <Tag color="processing">流程启动</Tag>;
  }
  return <Tag>{taskDefinitionLabel(record.taskDefinitionKey)}</Tag>;
}

function bindingModelId(binding: FormBindingItem | BindingForm) {
  return binding.processModelId;
}

const BindingFormItems: React.FC<{
  initialProcessModelId?: string;
  initialFormSchemaId?: string;
}> = ({
  initialProcessModelId,
  initialFormSchemaId,
}) => {
  const form = Form.useFormInstance();

  React.useEffect(() => {
    if (!initialProcessModelId) return;
    const fillProcessDefinition = async () => {
      const models = await listProcessModels();
      const model = models.find((item) => item.id === initialProcessModelId);
      form.setFieldsValue({
        processModelId: initialProcessModelId,
        processDefinitionId: model?.flowableDefinitionId,
      });
    };
    void fillProcessDefinition();
  }, [form, initialProcessModelId]);

  React.useEffect(() => {
    if (!initialFormSchemaId) return;
    const fillFormSchema = async () => {
      const schemas = await listFormSchemas();
      const schema = schemas.find((item) => item.id === initialFormSchemaId);
      form.setFieldsValue({
        formSchemaId: initialFormSchemaId,
        formSchemaVersion: schema?.version || 1,
      });
    };
    void fillFormSchema();
  }, [form, initialFormSchemaId]);

  return (
    <>
      <ProFormSelect
        name="processModelId"
        label="流程模型"
        rules={[{ required: true, message: '请选择流程模型' }]}
        fieldProps={{
          showSearch: true,
          optionFilterProp: 'label',
          onChange: async (value) => {
            form.setFieldValue('taskDefinitionKey', undefined);
            const models = await listProcessModels();
            const model = models.find((item) => item.id === value);
            form.setFieldValue(
              'processDefinitionId',
              model?.flowableDefinitionId,
            );
          },
        }}
        request={async () =>
          (await listProcessModels())
            .filter((item) => item.status !== 'ARCHIVED')
            .map((item) => ({
              label: `${processDisplayName(item.modelKey, item.modelName)}（${item.modelKey}）`,
              value: item.id,
            }))
        }
      />
      <ProFormSelect
        name="bindingType"
        label="绑定范围"
        initialValue="TASK"
        rules={[{ required: true, message: '请选择绑定范围' }]}
        options={[
          { label: '任务表单', value: 'TASK' },
          { label: '启动表单', value: 'START' },
        ]}
        fieldProps={{
          onChange: () => form.setFieldValue('taskDefinitionKey', undefined),
        }}
      />
      <ProFormText
        name="processDefinitionId"
        hidden
      />
      <ProFormDependency name={['processModelId', 'bindingType']}>
        {({ processModelId, bindingType }) =>
          bindingType === 'START' ? null : (
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
          )
        }
      </ProFormDependency>
      <ProFormSelect
        name="formSchemaId"
        label="表单"
        rules={[{ required: true, message: '请选择表单' }]}
        fieldProps={{
          showSearch: true,
          optionFilterProp: 'label',
          onChange: async (value) => {
            const schemas = await listFormSchemas();
            const schema = schemas.find((item) => item.id === value);
            form.setFieldValue('formSchemaVersion', schema?.version || 1);
          },
        }}
        request={async () =>
          (await listFormSchemas()).map((item) => ({
            label: formSchemaOptionLabel(item),
            value: item.id,
          }))
        }
      />
      <ProFormText
        name="formSchemaVersion"
        label="表单版本"
        initialValue={1}
        fieldProps={{ readOnly: true }}
        rules={[{ required: true, message: '请输入表单版本' }]}
      />
    </>
  );
};

const FormBindings: React.FC = () => {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [editing, setEditing] = useState<FormBindingItem>();
  const [modal, contextHolder] = Modal.useModal();
  const queryProcessModelId = useQueryProcessModelId();
  const queryFormSchemaId = useQueryFormSchemaId();

  const showBindingSuccess = (binding: FormBindingItem | BindingForm, action: 'created' | 'updated') => {
    const processModelId = bindingModelId(binding);
    modal.success({
      title: action === 'created' ? '表单绑定已创建' : '表单绑定已保存',
      width: 520,
      okText: '留在列表',
      content: (
        <Flex vertical gap={12}>
          <span>
            {binding.taskDefinitionKey === START_FORM_TASK_KEY
              ? '已将表单绑定为流程启动表单。'
              : `已将表单绑定到任务节点 ${taskDefinitionLabel(binding.taskDefinitionKey || '')}。`}
          </span>
          <Space wrap>
            <Button
              type="primary"
              onClick={() =>
                history.push(
                  processModelId
                    ? `/process-start?processModelId=${processModelId}`
                    : '/process-start',
                )
              }
            >
              发起实例
            </Button>
            {processModelId ? (
              <Button
                onClick={() =>
                  history.push(`/process-designer?modelId=${processModelId}`)
                }
              >
                查看流程设计
              </Button>
            ) : null}
          </Space>
        </Flex>
      ),
    });
  };

  const columns: ProColumns<BindingTableItem>[] = [
    {
      title: '绑定范围',
      dataIndex: 'taskDefinitionKey',
      width: 120,
      valueType: 'select',
      valueEnum: {
        [START_FORM_TASK_KEY]: { text: '启动表单' },
      },
      renderText: (value) =>
        value === START_FORM_TASK_KEY ? '启动表单' : '任务表单',
    },
    {
      title: '流程模型',
      dataIndex: 'processModelId',
      ellipsis: true,
      render: (_, record) => modelBindingLabel(record),
    },
    {
      title: '绑定位置',
      dataIndex: 'taskDefinitionKey',
      width: 180,
      render: (_, record) => bindingTargetLabel(record),
    },
    {
      title: '绑定表单',
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
      width: 210,
      render: (_, record) => [
        <Button
          key="start"
          type="link"
          onClick={() =>
            history.push(
              record.processModelId
                ? `/process-start?processModelId=${record.processModelId}`
                : '/process-start',
            )
          }
        >
          发起验证
        </Button>,
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
      {queryProcessModelId ? (
        <Alert
          showIcon
          type="info"
          title="正在查看指定流程的表单绑定"
          description="从流程模型进入后，列表和新建绑定会默认使用该流程模型。"
          action={
            <Button size="small" onClick={() => history.push('/form-bindings')}>
              查看全部
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      ) : null}
      {queryFormSchemaId ? (
        <Alert
          showIcon
          type="info"
          title="正在绑定指定表单"
          description="从表单管理进入后，列表会只显示该表单的绑定，新建绑定会默认使用该表单版本。"
          action={
            <Button size="small" onClick={() => history.push('/form-bindings')}>
              查看全部
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      ) : null}
      <ProTable<BindingTableItem>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        scroll={{ x: 1000 }}
        params={{ processModelId: queryProcessModelId, formSchemaId: queryFormSchemaId }}
        request={async (params) => {
          const [bindings, models, schemas] = await Promise.all([
            listFormBindings(
              queryProcessModelId
                ? { processModelId: queryProcessModelId }
                : undefined,
            ),
            listProcessModels(),
            listFormSchemas(),
          ]);
          const modelMap = new Map(models.map((item) => [item.id, item]));
          const schemaMap = new Map(schemas.map((item) => [item.id, item]));
          const keyword = String(
            params.processModelId ||
              params.taskDefinitionKey ||
              '',
          ).trim();
          const data = bindings.map((item) => ({
            ...item,
            processModel: item.processModelId
              ? modelMap.get(item.processModelId)
              : undefined,
            formSchema: schemaMap.get(item.formSchemaId),
          }));
          const scopedData = queryFormSchemaId
            ? data.filter((item) => item.formSchemaId === queryFormSchemaId)
            : data;
          return {
            data: keyword
              ? scopedData.filter((item) =>
                  [
                    item.processModel?.modelName,
                    item.processModel?.modelKey,
                    item.taskDefinitionKey,
                    formSchemaNameLabel(item.formSchema?.formName),
                    item.formSchema?.formKey,
                  ]
                    .filter(Boolean)
                    .some((value) => String(value).includes(keyword)),
                  )
              : scopedData,
            success: true,
          };
        }}
        search={{ labelWidth: 'auto' }}
        locale={{
          emptyText: (
            <Empty
              description="暂无表单绑定"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Space>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => history.push('/forms')}
                >
                  配置表单
                </Button>
                <Button onClick={() => history.push('/process-designer')}>
                  设计流程
                </Button>
              </Space>
            </Empty>
          ),
        }}
        toolBarRender={() => [
          <ModalForm<BindingForm>
            key={`create-${queryProcessModelId || 'all'}-${queryFormSchemaId || 'form-all'}`}
            title="新建表单绑定"
            trigger={
              <Button type="primary" icon={<PlusOutlined />}>
                新建绑定
              </Button>
            }
            initialValues={{
              bindingType: 'TASK',
              processModelId: queryProcessModelId,
              formSchemaId: queryFormSchemaId,
            }}
            modalProps={{ destroyOnHidden: true }}
            onFinish={async (values) => {
              const binding = await createFormBinding(bindingPayload(values));
              showBindingSuccess(binding, 'created');
              actionRef.current?.reload();
              return true;
            }}
          >
            <BindingFormItems
              initialProcessModelId={queryProcessModelId}
              initialFormSchemaId={queryFormSchemaId}
            />
          </ModalForm>,
        ]}
      />

      <ModalForm<BindingForm>
        key={editing?.id || 'edit-binding'}
        title="编辑表单绑定"
        open={Boolean(editing)}
        initialValues={
          editing
            ? {
                ...editing,
                bindingType: bindingTypeOf(editing),
                taskDefinitionKey:
                  editing.taskDefinitionKey === START_FORM_TASK_KEY
                    ? undefined
                    : editing.taskDefinitionKey,
              }
            : undefined
        }
        modalProps={{
          destroyOnHidden: true,
          onCancel: () => setEditing(undefined),
        }}
        onOpenChange={(open) => {
          if (!open) setEditing(undefined);
        }}
        onFinish={async (values) => {
          if (!editing) return false;
          const binding = await updateFormBinding(editing.id, bindingPayload(values));
          showBindingSuccess(binding, 'updated');
          setEditing(undefined);
          actionRef.current?.reload();
          return true;
        }}
      >
        <BindingFormItems initialProcessModelId={editing?.processModelId} />
      </ModalForm>
    </PageContainer>
  );
};

export default FormBindings;

import { PlusOutlined } from '@ant-design/icons';
import {
  ModalForm,
  PageContainer,
  ProFormText,
  ProFormTextArea,
  ProTable,
  type ActionType,
  type ProColumns,
} from '@ant-design/pro-components';
import { Button, Drawer, Typography, message } from 'antd';
import React, { useRef, useState } from 'react';
import { CopyableText } from '@/components/CopyableText';
import { KoravoStatusTag } from '@/components/KoravoStatusTag';
import {
  createFormSchema,
  listFormSchemas,
  updateFormSchema,
  type FormSchemaItem,
} from '@/services/koravo/api';

interface FormSchemaForm {
  formKey: string;
  formName: string;
  schemaJson: string;
  uiSchemaJson?: string;
}

const defaultSchema = JSON.stringify(
  {
    type: 'object',
    required: [],
    properties: {},
  },
  null,
  2,
);

const Forms: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const [editing, setEditing] = useState<FormSchemaItem>();
  const [preview, setPreview] = useState<FormSchemaItem>();

  const columns: ProColumns<FormSchemaItem>[] = [
    { title: '表单名称', dataIndex: 'formName' },
    {
      title: '表单标识',
      dataIndex: 'formKey',
      width: 180,
      render: (_, record) => <CopyableText value={record.formKey} />,
    },
    {
      title: '版本',
      dataIndex: 'version',
      width: 88,
      search: false,
      renderText: (value) => `v${value || 1}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (_, record) => <KoravoStatusTag status={record.status} />,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 160,
      render: (_, record) => [
        <Button key="preview" type="link" onClick={() => setPreview(record)}>
          查看
        </Button>,
        <Button key="edit" type="link" onClick={() => setEditing(record)}>
          编辑
        </Button>,
      ],
    },
  ];

  return (
    <PageContainer title="表单管理" content="维护任务表单结构和展示配置。">
      <ProTable<FormSchemaItem>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={async (params) => {
          const data = await listFormSchemas();
          const keyword = String(params.formName || params.formKey || '').trim();
          return {
            data: keyword
              ? data.filter((item) =>
                  [item.formName, item.formKey].some((value) =>
                    String(value).includes(keyword),
                  ),
                )
              : data,
            success: true,
          };
        }}
        search={{ labelWidth: 'auto' }}
        toolBarRender={() => [
          <ModalForm<FormSchemaForm>
            key="create"
            title="新建表单"
            trigger={
              <Button type="primary" icon={<PlusOutlined />}>
                新建表单
              </Button>
            }
            initialValues={{ schemaJson: defaultSchema }}
            modalProps={{ destroyOnHidden: true }}
            onFinish={async (values) => {
              await createFormSchema(values);
              message.success('已创建');
              actionRef.current?.reload();
              return true;
            }}
          >
            <ProFormText
              name="formKey"
              label="表单标识"
              rules={[{ required: true, message: '请输入表单标识' }]}
            />
            <ProFormText
              name="formName"
              label="表单名称"
              rules={[{ required: true, message: '请输入表单名称' }]}
            />
            <ProFormTextArea
              name="schemaJson"
              label="Schema"
              rules={[{ required: true, message: '请输入 Schema' }]}
              fieldProps={{ rows: 10 }}
            />
            <ProFormTextArea
              name="uiSchemaJson"
              label="UI Schema"
              fieldProps={{ rows: 6 }}
            />
          </ModalForm>,
        ]}
      />

      <ModalForm<FormSchemaForm>
        key={editing?.id || 'edit-form'}
        title="编辑表单"
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
          await updateFormSchema(editing.id, values);
          message.success('已保存');
          setEditing(undefined);
          actionRef.current?.reload();
          return true;
        }}
      >
        <ProFormText
          name="formKey"
          label="表单标识"
          rules={[{ required: true, message: '请输入表单标识' }]}
        />
        <ProFormText
          name="formName"
          label="表单名称"
          rules={[{ required: true, message: '请输入表单名称' }]}
        />
        <ProFormTextArea
          name="schemaJson"
          label="Schema"
          rules={[{ required: true, message: '请输入 Schema' }]}
          fieldProps={{ rows: 10 }}
        />
        <ProFormTextArea
          name="uiSchemaJson"
          label="UI Schema"
          fieldProps={{ rows: 6 }}
        />
      </ModalForm>

      <Drawer
        title={preview?.formName}
        size={720}
        open={Boolean(preview)}
        onClose={() => setPreview(undefined)}
      >
        <Typography.Title level={5}>Schema</Typography.Title>
        <Typography.Paragraph>
          <pre>{preview?.schemaJson || '-'}</pre>
        </Typography.Paragraph>
        <Typography.Title level={5}>UI Schema</Typography.Title>
        <Typography.Paragraph>
          <pre>{preview?.uiSchemaJson || '-'}</pre>
        </Typography.Paragraph>
      </Drawer>
    </PageContainer>
  );
};

export default Forms;

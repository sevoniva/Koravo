import { PlusOutlined } from '@ant-design/icons';
import {
  ModalForm,
  PageContainer,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
  ProTable,
  type ActionType,
  type ProColumns,
} from '@ant-design/pro-components';
import { Button, Modal, Space, message } from 'antd';
import React, { useRef, useState } from 'react';
import { KoravoStatusTag } from '@/components/KoravoStatusTag';
import {
  createDataSource,
  deleteDataSource,
  listDataSources,
  testDataSource,
  updateDataSource,
  type DataSourceItem,
} from '@/services/koravo/api';
import { dataSourceTypeLabel } from '@/utils/display';
import { formatDuration } from '@/utils/format';

interface DataSourceForm extends Record<string, unknown> {
  name: string;
  type: string;
  jdbcUrl: string;
  username?: string;
  password?: string;
  driverClassName?: string;
  readOnly: boolean;
  poolConfigJson?: string;
}

const typeOptions = [
  { label: 'PostgreSQL', value: 'POSTGRESQL' },
  { label: 'MySQL', value: 'MYSQL' },
  { label: 'H2', value: 'H2' },
];

const DataSources: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const [editing, setEditing] = useState<DataSourceItem>();
  const [modal, contextHolder] = Modal.useModal();

  const columns: ProColumns<DataSourceItem>[] = [
    { title: '名称', dataIndex: 'name' },
    {
      title: '类型',
      dataIndex: 'type',
      width: 120,
      valueType: 'select',
      fieldProps: { options: typeOptions },
      renderText: (value) => dataSourceTypeLabel(value),
    },
    {
      title: '连接地址',
      dataIndex: 'jdbcUrl',
      ellipsis: true,
      search: false,
    },
    { title: '用户名', dataIndex: 'username', width: 140, search: false },
    {
      title: '驱动',
      dataIndex: 'driverClassName',
      ellipsis: true,
      search: false,
    },
    {
      title: '只读',
      dataIndex: 'readOnly',
      width: 90,
      search: false,
      render: (_, record) => <KoravoStatusTag status={record.readOnly} text={record.readOnly ? '只读' : '可写'} />,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      search: false,
      render: (_, record) => <KoravoStatusTag status={record.status} />,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 190,
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="link"
            onClick={async () => {
              const result = await testDataSource(record.id);
              message[result.connected ? 'success' : 'warning'](
                `${result.message || (result.connected ? '连接成功' : '连接失败')}，耗时 ${formatDuration(result.elapsedMillis)}`,
              );
              actionRef.current?.reload();
            }}
          >
            测试
          </Button>
          <Button type="link" onClick={() => setEditing(record)}>
            编辑
          </Button>
          <Button
            type="link"
            danger
            onClick={() => {
              modal.confirm({
                title: '删除数据源',
                content: `确认删除「${record.name}」？`,
                okText: '删除',
                cancelText: '取消',
                onOk: async () => {
                  await deleteDataSource(record.id);
                  message.success('已删除');
                  actionRef.current?.reload();
                },
              });
            }}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const formItems = (
    <>
      <ProFormText
        name="name"
        label="名称"
        rules={[{ required: true, message: '请输入名称' }]}
      />
      <ProFormSelect
        name="type"
        label="类型"
        options={typeOptions}
        rules={[{ required: true, message: '请选择类型' }]}
      />
      <ProFormText
        name="jdbcUrl"
        label="连接地址"
        rules={[{ required: true, message: '请输入连接地址' }]}
      />
      <ProFormText name="username" label="用户名" />
      <ProFormText
        name="password"
        label="密码"
        fieldProps={{ type: 'password', autoComplete: 'new-password' }}
      />
      <ProFormText name="driverClassName" label="驱动类" />
      <ProFormSwitch name="readOnly" label="只读" />
      <ProFormTextArea
        name="poolConfigJson"
        label="连接池配置"
        fieldProps={{ rows: 5 }}
      />
    </>
  );

  return (
    <PageContainer title="数据源管理" content="维护外部数据源连接和连通性。">
      {contextHolder}
      <ProTable<DataSourceItem>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        scroll={{ x: 1200 }}
        request={async (params) => {
          const data = await listDataSources();
          const keyword = String(params.name || '').trim();
          return {
            data: keyword
              ? data.filter((item) =>
                  [item.name, item.jdbcUrl, item.username]
                    .filter(Boolean)
                    .some((value) => String(value).includes(keyword)),
                )
              : data,
            success: true,
          };
        }}
        search={{ labelWidth: 'auto' }}
        toolBarRender={() => [
          <ModalForm<DataSourceForm>
            key="create"
            title="新建数据源"
            trigger={
              <Button type="primary" icon={<PlusOutlined />}>
                新建数据源
              </Button>
            }
            initialValues={{ type: 'POSTGRESQL', readOnly: true, poolConfigJson: '{}' }}
            modalProps={{ destroyOnHidden: true }}
            onFinish={async (values) => {
              await createDataSource(values);
              message.success('已创建');
              actionRef.current?.reload();
              return true;
            }}
          >
            {formItems}
          </ModalForm>,
        ]}
      />

      <ModalForm<DataSourceForm>
        key={editing?.id || 'edit-datasource'}
        title="编辑数据源"
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
          await updateDataSource(editing.id, values);
          message.success('已保存');
          setEditing(undefined);
          actionRef.current?.reload();
          return true;
        }}
      >
        {formItems}
      </ModalForm>
    </PageContainer>
  );
};

export default DataSources;

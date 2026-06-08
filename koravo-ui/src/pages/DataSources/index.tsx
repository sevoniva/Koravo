import { PlusOutlined } from '@ant-design/icons';
import {
  ModalForm,
  PageContainer,
  ProFormDigit,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProTable,
  type ActionType,
  type ProColumns,
} from '@ant-design/pro-components';
import { App, Button, Modal, Space } from 'antd';
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
  maximumPoolSize?: number;
  minimumIdle?: number;
  connectionTimeout?: number;
}

const typeOptions = [
  { label: 'PostgreSQL', value: 'POSTGRESQL' },
  { label: 'MySQL', value: 'MYSQL' },
  { label: 'H2', value: 'H2' },
];

const defaultPoolConfig = {
  maximumPoolSize: 10,
  minimumIdle: 2,
  connectionTimeout: 30000,
};

function parsePoolConfig(poolConfigJson?: string) {
  if (!poolConfigJson?.trim()) return defaultPoolConfig;
  try {
    const value = JSON.parse(poolConfigJson) as Record<string, unknown>;
    return {
      maximumPoolSize:
        typeof value.maximumPoolSize === 'number'
          ? value.maximumPoolSize
          : defaultPoolConfig.maximumPoolSize,
      minimumIdle:
        typeof value.minimumIdle === 'number'
          ? value.minimumIdle
          : defaultPoolConfig.minimumIdle,
      connectionTimeout:
        typeof value.connectionTimeout === 'number'
          ? value.connectionTimeout
          : defaultPoolConfig.connectionTimeout,
    };
  } catch {
    return defaultPoolConfig;
  }
}

function toFormValues(record?: DataSourceItem): Partial<DataSourceForm> {
  if (!record) {
    return { type: 'POSTGRESQL', readOnly: true, ...defaultPoolConfig };
  }
  return {
    ...record,
    ...parsePoolConfig(record.poolConfigJson),
  };
}

function buildDataSourcePayload(values: DataSourceForm) {
  return {
    name: values.name,
    type: values.type,
    jdbcUrl: values.jdbcUrl,
    username: values.username,
    password: values.password,
    driverClassName: values.driverClassName,
    readOnly: values.readOnly,
    poolConfigJson: JSON.stringify({
      maximumPoolSize: values.maximumPoolSize ?? defaultPoolConfig.maximumPoolSize,
      minimumIdle: values.minimumIdle ?? defaultPoolConfig.minimumIdle,
      connectionTimeout: values.connectionTimeout ?? defaultPoolConfig.connectionTimeout,
    }),
  };
}

const DataSources: React.FC = () => {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [editing, setEditing] = useState<DataSourceItem>();
  const [modal, contextHolder] = Modal.useModal();

  const saveDataSource = async (values: DataSourceForm, id?: string) => {
    if (
      values.minimumIdle !== undefined &&
      values.maximumPoolSize !== undefined &&
      values.minimumIdle > values.maximumPoolSize
    ) {
      message.error('最小空闲连接不能大于最大连接数');
      return false;
    }
    if (id) {
      await updateDataSource(id, buildDataSourcePayload(values));
      message.success('已保存');
      setEditing(undefined);
    } else {
      await createDataSource(buildDataSourcePayload(values));
      message.success('已创建');
    }
    actionRef.current?.reload();
    return true;
  };

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
      <ProFormDigit
        name="maximumPoolSize"
        label="最大连接数"
        min={1}
        max={200}
        fieldProps={{ precision: 0 }}
        rules={[{ required: true, message: '请输入最大连接数' }]}
      />
      <ProFormDigit
        name="minimumIdle"
        label="最小空闲连接"
        min={0}
        max={200}
        fieldProps={{ precision: 0 }}
        rules={[{ required: true, message: '请输入最小空闲连接数' }]}
      />
      <ProFormDigit
        name="connectionTimeout"
        label="连接超时"
        min={1000}
        max={120000}
        fieldProps={{ precision: 0, suffix: '毫秒' }}
        rules={[{ required: true, message: '请输入连接超时时间' }]}
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
            initialValues={toFormValues()}
            modalProps={{ destroyOnHidden: true }}
            onFinish={(values) => saveDataSource(values)}
          >
            {formItems}
          </ModalForm>,
        ]}
      />

      <ModalForm<DataSourceForm>
        key={editing?.id || 'edit-datasource'}
        title="编辑数据源"
        open={Boolean(editing)}
        initialValues={toFormValues(editing)}
        modalProps={{
          destroyOnHidden: true,
          onCancel: () => setEditing(undefined),
        }}
        onOpenChange={(open) => {
          if (!open) setEditing(undefined);
        }}
        onFinish={async (values) => {
          if (!editing) return false;
          return saveDataSource(values, editing.id);
        }}
      >
        {formItems}
      </ModalForm>
    </PageContainer>
  );
};

export default DataSources;

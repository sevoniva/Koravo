import {
  PageContainer,
  ProCard,
  ProDescriptions,
  ProForm,
  ProFormText,
  ProFormTextArea,
  ProTable,
  type ProColumns,
} from '@ant-design/pro-components';
import { useLocation } from '@umijs/max';
import { useQuery } from '@tanstack/react-query';
import { Button, Flex, message } from 'antd';
import React, { useEffect, useState } from 'react';
import { CopyableText } from '@/components/CopyableText';
import { KoravoStatusTag } from '@/components/KoravoStatusTag';
import {
  getProcessModel,
  importProcessModel,
  listProcessModels,
  updateProcessModel,
  validateProcessModelXml,
  type ProcessModelItem,
} from '@/services/koravo/api';
import { processDisplayName, processStatusLabel } from '@/utils/display';
import { formatDateTime } from '@/utils/format';

interface DesignerForm {
  modelName: string;
  description?: string;
  bpmnXml: string;
}

const columns: ProColumns<ProcessModelItem>[] = [
  {
    title: '模型名称',
    dataIndex: 'modelName',
    renderText: (_, record) => processDisplayName(record.modelKey, record.modelName),
  },
  {
    title: '状态',
    dataIndex: 'status',
    width: 110,
    render: (_, record) => (
      <KoravoStatusTag
        status={record.status}
        text={processStatusLabel(record.status)}
      />
    ),
  },
  {
    title: '更新时间',
    dataIndex: 'updatedAt',
    width: 170,
    renderText: formatDateTime,
  },
];

const ProcessDesigner: React.FC = () => {
  const location = useLocation();
  const [selectedId, setSelectedId] = useState<string>();
  const { data: models, refetch: reloadModels } = useQuery({
    queryKey: ['designer-models'],
    queryFn: () => listProcessModels(),
  });
  const { data: selected, refetch } = useQuery({
    queryKey: ['designer-model', selectedId],
    queryFn: () => getProcessModel(selectedId || ''),
    enabled: Boolean(selectedId),
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const modelId = params.get('modelId') || undefined;
    if (modelId) setSelectedId(modelId);
  }, [location.search]);

  return (
    <PageContainer title="流程设计器" content="维护 BPMN XML，完成校验后保存为流程草稿。">
      <ProCard split="vertical" gutter={16} wrap>
        <ProCard title="模型列表" colSpan={{ xs: 24, xl: 8 }}>
          <ProTable<ProcessModelItem>
            rowKey="id"
            columns={columns}
            dataSource={models || []}
            search={false}
            pagination={{ pageSize: 8 }}
            options={false}
            rowSelection={{
              type: 'radio',
              selectedRowKeys: selectedId ? [selectedId] : [],
              onChange: ([key]) => setSelectedId(String(key)),
            }}
          />
        </ProCard>
        <ProCard title={selected ? '模型编辑' : '导入模型'} colSpan={{ xs: 24, xl: 16 }}>
          {selected && (
            <ProDescriptions<ProcessModelItem>
              column={2}
              dataSource={selected}
              columns={[
                { title: '模型标识', dataIndex: 'modelKey', render: (_, record) => <CopyableText value={record.modelKey} /> },
                { title: '版本', dataIndex: 'version', renderText: (value) => `v${value || 1}` },
                { title: '状态', dataIndex: 'status', render: (_, record) => <KoravoStatusTag status={record.status} text={processStatusLabel(record.status)} /> },
                { title: '流程定义', dataIndex: 'flowableDefinitionId', copyable: true },
              ]}
              style={{ marginBottom: 16 }}
            />
          )}
          <ProForm<DesignerForm>
            key={selected?.id || 'import'}
            initialValues={{
              modelName: selected?.modelName || '',
              description: selected?.description || '',
              bpmnXml: selected?.bpmnXml || '',
            }}
            submitter={{
              searchConfig: {
                submitText: selected ? '保存模型' : '导入模型',
              },
              render: (_, dom) => (
                <Flex gap={8}>
                  <Button
                    onClick={async () => {
                      const bpmnXml = _.form?.getFieldValue('bpmnXml');
                      await validateProcessModelXml(bpmnXml);
                      message.success('校验通过');
                    }}
                  >
                    校验 XML
                  </Button>
                  {dom}
                </Flex>
              ),
            }}
            onFinish={async (values) => {
              if (selected) {
                await updateProcessModel(selected.id, values);
                message.success('已保存');
                await refetch();
                await reloadModels();
                return true;
              }
              await importProcessModel(values);
              message.success('已导入');
              await reloadModels();
              return true;
            }}
          >
            <ProFormText
              name="modelName"
              label="模型名称"
              rules={[{ required: true, message: '请输入模型名称' }]}
            />
            <ProFormText name="description" label="说明" />
            <ProFormTextArea
              name="bpmnXml"
              label="BPMN XML"
              rules={[{ required: true, message: '请输入 BPMN XML' }]}
              fieldProps={{ rows: 22 }}
            />
          </ProForm>
        </ProCard>
      </ProCard>
    </PageContainer>
  );
};

export default ProcessDesigner;

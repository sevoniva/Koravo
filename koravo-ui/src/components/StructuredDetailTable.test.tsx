import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StructuredDetailTable from './StructuredDetailTable';

vi.mock('@ant-design/pro-components', async () => {
  const React = await import('react');
  return {
    ProTable: ({
      columns,
      dataSource,
    }: {
      columns: any[];
      dataSource: any[];
    }) =>
      React.createElement(
        'table',
        {},
        React.createElement(
          'tbody',
          {},
          dataSource.map((record) =>
            React.createElement(
              'tr',
              { key: record.key },
              columns.map((column) =>
                React.createElement(
                  'td',
                  { key: column.dataIndex || column.title },
                  record[column.dataIndex],
                ),
              ),
            ),
          ),
        ),
      ),
  };
});

describe('StructuredDetailTable', () => {
  it('renders workflow audit details as business labels', async () => {
    render(
      <StructuredDetailTable
        value={{
          approvalUsers: ['manager', 'finance'],
          applicantName: '真实申请专员',
          applicantDepartment: '业务一部',
          approverUserId: 'manager',
          reviewers: ['manager', 'finance'],
          candidateGroups: ['role-01', 'role-02'],
          password: 'plain-password',
          comment:
            '这是一段用于验证长文本收起展示的处理意见，内容需要保持业务可读，但不能把整段明细压成难以扫描的一行。',
        }}
      />,
    );

    expect(await screen.findByText('审批人')).toBeInTheDocument();
    expect(screen.getByText('申请部门')).toBeInTheDocument();
    expect(screen.getByText('业务一部')).toBeInTheDocument();
    expect(screen.getAllByText('审批主管').length).toBeGreaterThan(0);
    expect(screen.getAllByText('复核专员').length).toBeGreaterThan(0);
    expect(screen.getByText('复核人')).toBeInTheDocument();
    expect(screen.getByText('候选角色')).toBeInTheDocument();
    expect(screen.getByText('审批角色 1')).toBeInTheDocument();
    expect(screen.getByText('审批角色 2')).toBeInTheDocument();
    expect(screen.getByText('处理意见')).toBeInTheDocument();
    expect(screen.getByText('密码')).toBeInTheDocument();
    expect(screen.getByText('******')).toBeInTheDocument();
    expect(screen.queryByText('plain-password')).not.toBeInTheDocument();
    expect(screen.queryByText('role-01')).not.toBeInTheDocument();
  });

  it('hides workflow engine variables in nested detail records', async () => {
    render(
      <StructuredDetailTable
        value={{
          variables: {
            subject: '通用业务申请检查',
            decision: 'APPROVED',
            approvalUser: 'finance',
            nrOfInstances: 2,
            nrOfActiveInstances: 0,
            nrOfCompletedInstances: 2,
            loopCounter: 1,
          },
        }}
      />,
    );

    expect(await screen.findByText('业务数据 / 事项名称')).toBeInTheDocument();
    expect(screen.getByText('通用业务申请检查')).toBeInTheDocument();
    expect(screen.getByText('业务数据 / 处理结论')).toBeInTheDocument();
    expect(screen.getByText('同意')).toBeInTheDocument();
    expect(screen.queryByText('APPROVED')).not.toBeInTheDocument();
    expect(screen.queryByText(/approvalUser/)).not.toBeInTheDocument();
    expect(screen.queryByText(/nrOfInstances/)).not.toBeInTheDocument();
    expect(screen.queryByText(/loopCounter/)).not.toBeInTheDocument();
    expect(screen.queryByText('复核专员')).not.toBeInTheDocument();
  });

  it('expands nested json strings into readable rows', async () => {
    const processInstanceId = '62738d33-678f-11f1-9bb0-6eaa56961236';

    render(
      <StructuredDetailTable
        value={{
          processInstanceId,
          request: JSON.stringify({
            url: 'http://localhost:8080/actuator/health',
            body: JSON.stringify({
              subject: '通用业务申请检查',
              approvalUsers: ['manager', 'finance'],
              password: 'plain-password',
            }),
          }),
          responseSummary: JSON.stringify({
            statusCode: 200,
            body: { success: true },
          }),
        }}
      />,
    );

    expect(await screen.findByText('流程实例编号')).toBeInTheDocument();
    expect(screen.getByText('62738d33')).toBeInTheDocument();
    expect(screen.queryByText(processInstanceId)).not.toBeInTheDocument();
    expect(screen.getByText('请求 / 请求地址')).toBeInTheDocument();
    expect(screen.getByText('本地服务健康检查')).toBeInTheDocument();
    expect(screen.getByText('请求 / 请求体 / 事项名称')).toBeInTheDocument();
    expect(screen.getByText('通用业务申请检查')).toBeInTheDocument();
    expect(screen.getByText('请求 / 请求体 / 审批人')).toBeInTheDocument();
    expect(screen.getAllByText('审批主管').length).toBeGreaterThan(0);
    expect(screen.getAllByText('复核专员').length).toBeGreaterThan(0);
    expect(screen.getByText('请求 / 请求体 / 密码')).toBeInTheDocument();
    expect(screen.getByText('******')).toBeInTheDocument();
    expect(screen.queryByText('plain-password')).not.toBeInTheDocument();
    expect(screen.getByText('响应摘要 / 状态码')).toBeInTheDocument();
    expect(
      screen.getByText('响应摘要 / 响应体 / 是否成功'),
    ).toBeInTheDocument();
    expect(screen.getByText('是')).toBeInTheDocument();
  });
});

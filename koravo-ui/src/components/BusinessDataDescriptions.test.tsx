import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import BusinessDataDescriptions from './BusinessDataDescriptions';

vi.mock('@ant-design/pro-components', async () => {
  const React = await import('react');
  return {
    ProDescriptions: ({
      columns,
      dataSource,
    }: {
      columns: any[];
      dataSource: Record<string, unknown>;
    }) =>
      React.createElement(
        'div',
        {},
        columns.map((column) =>
          React.createElement(
            'section',
            { key: column.dataIndex },
            React.createElement('span', {}, column.title),
            React.createElement(
              'div',
              {},
              column.render?.(undefined, dataSource) ??
                String(dataSource[column.dataIndex]),
            ),
          ),
        ),
      ),
  };
});

describe('BusinessDataDescriptions', () => {
  it('renders organization members as readable business values', () => {
    render(
      <BusinessDataDescriptions
        schemaJson={JSON.stringify({
          type: 'object',
          properties: {
            applicant: { type: 'string', title: '发起人' },
            approvalUsers: {
              type: 'array',
              title: '审批人',
              items: { type: 'string' },
            },
          },
        })}
        uiSchemaJson={JSON.stringify({
          applicant: { 'ui:widget': 'organizationProfile' },
          approvalUsers: { 'ui:widget': 'organizationMemberMulti' },
        })}
        values={{
          applicant: 'applicant',
          approver: 'applicant',
          approvalUsers: ['manager', 'finance'],
        }}
      />,
    );

    expect(screen.getByText('发起人')).toBeInTheDocument();
    expect(screen.getByText('业务申请专员')).toBeInTheDocument();
    expect(screen.getByText('审批人')).toBeInTheDocument();
    expect(screen.getAllByText('审批人')).toHaveLength(1);
    expect(screen.getByText('审批主管')).toBeInTheDocument();
    expect(screen.getByText('复核专员')).toBeInTheDocument();
    expect(screen.queryByText('manager')).not.toBeInTheDocument();
  });

  it('renders json string values as business text', () => {
    render(
      <BusinessDataDescriptions
        values={{
          payload: JSON.stringify({
            applicantName: '真实申请专员',
            department: '业务一部',
          }),
        }}
      />,
    );

    expect(
      screen.getByText((text) => text.includes('发起人：真实申请专员')),
    ).toBeInTheDocument();
    expect(
      screen.getByText((text) => text.includes('所属部门：业务一部')),
    ).toBeInTheDocument();
    expect(screen.queryByText(/"applicantName"/)).not.toBeInTheDocument();
  });

  it('keeps task decision fields when they are outside the bound form schema', () => {
    render(
      <BusinessDataDescriptions
        schemaJson={JSON.stringify({
          type: 'object',
          properties: {
            subject: { type: 'string', title: '申请主题' },
          },
        })}
        values={{
          subject: '生产发布',
          approved: true,
          decision: 'APPROVED',
          reviewComment: '同意发布',
          nrOfInstances: 2,
          nrOfActiveInstances: 0,
          nrOfCompletedInstances: 2,
          loopCounter: 1,
        }}
      />,
    );

    expect(screen.getByText('申请主题')).toBeInTheDocument();
    expect(screen.getByText('生产发布')).toBeInTheDocument();
    expect(screen.getByText('处理结论')).toBeInTheDocument();
    expect(screen.getAllByText('同意').length).toBeGreaterThan(0);
    expect(screen.getByText('处理意见')).toBeInTheDocument();
    expect(screen.getByText('同意发布')).toBeInTheDocument();
    expect(screen.queryByText(/nrOfInstances/)).not.toBeInTheDocument();
    expect(screen.queryByText(/loopCounter/)).not.toBeInTheDocument();
  });

  it('hides runtime fields that are not part of business data', () => {
    render(
      <BusinessDataDescriptions
        schemaJson={JSON.stringify({
          type: 'object',
          properties: {
            subject: { type: 'string', title: '申请主题' },
          },
        })}
        values={{
          subject: '流程上下文验收',
          requestId: '331b0d7404b6457f96b47d41c18ed77f',
          tenantId: 'default',
          processInstanceId: '0262ff50-6776-11f1-bc79-e679d55d1770',
          startUserId: 'applicant',
        }}
      />,
    );

    expect(screen.getByText('申请主题')).toBeInTheDocument();
    expect(screen.getByText('流程上下文验收')).toBeInTheDocument();
    expect(screen.queryByText('业务追踪号')).not.toBeInTheDocument();
    expect(screen.queryByText('组织')).not.toBeInTheDocument();
    expect(screen.queryByText('流程实例编号')).not.toBeInTheDocument();
    expect(screen.queryByText('331b0d7404b6457f96b47d41c18ed77f')).not.toBeInTheDocument();
  });
});

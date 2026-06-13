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
          approvalUsers: ['manager', 'finance'],
        }}
      />,
    );

    expect(screen.getByText('发起人')).toBeInTheDocument();
    expect(screen.getByText('业务申请专员')).toBeInTheDocument();
    expect(screen.getByText('审批人')).toBeInTheDocument();
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
          reviewComment: '同意发布',
        }}
      />,
    );

    expect(screen.getByText('申请主题')).toBeInTheDocument();
    expect(screen.getByText('生产发布')).toBeInTheDocument();
    expect(screen.getByText('处理结论')).toBeInTheDocument();
    expect(screen.getByText('是')).toBeInTheDocument();
    expect(screen.getByText('处理意见')).toBeInTheDocument();
    expect(screen.getByText('同意发布')).toBeInTheDocument();
  });
});

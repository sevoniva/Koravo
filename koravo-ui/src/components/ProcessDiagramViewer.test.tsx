import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ProcessTraceNode } from '@/services/koravo/api';
import ProcessDiagramViewer from './ProcessDiagramViewer';

const timeline: ProcessTraceNode[] = [
  {
    activityId: 'start',
    activityName: '开始',
    activityType: 'startEvent',
    startTime: '2026-06-13T09:00:00Z',
    endTime: '2026-06-13T09:01:00Z',
    status: 'COMPLETED',
  },
  {
    activityId: 'jointApprovalTask',
    activityName: '多人会签',
    activityType: 'userTask',
    startTime: '2026-06-13T09:01:00Z',
    status: 'ACTIVE',
  },
];

describe('ProcessDiagramViewer', () => {
  it('keeps the generated flow view compact', () => {
    render(
      <ProcessDiagramViewer
        currentActivityIds={['jointApprovalTask']}
        height={260}
        timeline={timeline}
      />,
    );

    expect(screen.getByTestId('process-diagram-viewer')).toBeInTheDocument();
    expect(screen.getAllByText('多人会签').length).toBeGreaterThan(0);
    expect(screen.getByText('1/2')).toBeInTheDocument();
    expect(screen.queryByText('当前位置')).not.toBeInTheDocument();
  });
});

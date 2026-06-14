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

const bpmnXml = `
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL">
  <process id="collaborativeApproval">
    <startEvent id="start" name="开始" />
    <userTask id="jointApprovalTask" name="多人会签" />
    <endEvent id="end" name="完成" />
  </process>
</definitions>
`;

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
    expect(screen.getByText('2/2')).toBeInTheDocument();
    expect(screen.queryByText('当前位置')).not.toBeInTheDocument();
  });

  it('renders BPMN models as business steps without raw technical statuses', () => {
    render(
      <ProcessDiagramViewer
        bpmnXml={bpmnXml}
        currentActivityIds={['start']}
        height={180}
        viewMode="steps"
      />,
    );

    expect(screen.getAllByText('开始').length).toBeGreaterThan(0);
    expect(screen.getByText('多人会签')).toBeInTheDocument();
    expect(screen.getByText('结束')).toBeInTheDocument();
    expect(screen.getByText('1/3')).toBeInTheDocument();
    expect(screen.getByText('当前')).toBeInTheDocument();
    expect(screen.getAllByText('待到达')).toHaveLength(2);
    expect(screen.queryByText('WAITING')).not.toBeInTheDocument();
  });
});

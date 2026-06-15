import { describe, expect, it } from 'vitest';
import { summarizeExceptionStacktrace } from './exceptionDiagnostics';

describe('summarizeExceptionStacktrace', () => {
  it('summarizes Java stack traces without exposing every frame first', () => {
    const summary = summarizeExceptionStacktrace(`
java.lang.IllegalStateException: connector timeout
  at io.koravo.ops.service.ProcessOpsService.retry(ProcessOpsService.java:42)
  at org.flowable.job.service.impl.asyncexecutor.ExecuteAsyncRunnable.run(ExecuteAsyncRunnable.java:88)
Caused by: java.net.SocketTimeoutException: Read timed out
  at okhttp3.internal.http.RealInterceptorChain.proceed(RealInterceptorChain.kt:109)
`);

    expect(summary).toMatchObject({
      hasRawText: true,
      exceptionType: 'IllegalStateException',
      exceptionMessage: 'connector timeout',
      rootCause: 'SocketTimeoutException：Read timed out',
      applicationFrame: 'Koravo：ProcessOpsService.retry（ProcessOpsService.java:42）',
      stackFrameCount: 3,
    });
    expect(summary.rawText).toContain('io.koravo.ops.service');
  });

  it('keeps plain messages readable', () => {
    const summary = summarizeExceptionStacktrace('外部服务超时');

    expect(summary.exceptionType).toBeUndefined();
    expect(summary.exceptionMessage).toBe('外部服务超时');
    expect(summary.stackFrameCount).toBe(0);
  });

  it('returns an empty state for missing diagnostics', () => {
    expect(summarizeExceptionStacktrace(undefined)).toEqual({
      rawText: '',
      hasRawText: false,
      stackFrameCount: 0,
    });
  });
});

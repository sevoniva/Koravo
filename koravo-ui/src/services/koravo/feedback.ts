import type { App } from 'antd';

type MessageApi = ReturnType<typeof App.useApp>['message'];
type NotificationApi = ReturnType<typeof App.useApp>['notification'];

let messageApi: MessageApi | undefined;
let notificationApi: NotificationApi | undefined;

export function setFeedbackApis(apis: {
  message: MessageApi;
  notification: NotificationApi;
}) {
  messageApi = apis.message;
  notificationApi = apis.notification;
}

export function showErrorMessage(content: string) {
  messageApi?.error(content);
}

export function showSuccessMessage(content: string) {
  messageApi?.success(content);
}

export function showErrorNotification(config: {
  message: string;
  description?: string;
}) {
  notificationApi?.error(config);
}

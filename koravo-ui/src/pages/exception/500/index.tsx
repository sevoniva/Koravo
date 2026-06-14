import { Link } from '@umijs/max';
import { Button, Card, Result } from 'antd';

export default () => (
  <Card variant="borderless">
    <Result
      status="500"
      title="500"
      subTitle="系统暂时无法完成请求。"
      extra={
        <Link to="/" prefetch>
          <Button type="primary">返回总览</Button>
        </Link>
      }
    />
  </Card>
);

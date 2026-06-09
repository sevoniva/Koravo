import { Link } from '@umijs/max';
import { Button, Card, Result } from 'antd';

export default () => (
  <Card variant="borderless">
    <Result
      status="403"
      title="403"
      subTitle="当前身份无权访问该页面。"
      extra={
        <Link to="/" prefetch>
          <Button type="primary">返回总览</Button>
        </Link>
      }
    />
  </Card>
);

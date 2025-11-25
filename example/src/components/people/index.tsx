import type { ReactElement } from 'react';
import { Button, Space, Table, Typography, App, Badge, Tag, FloatButton } from 'antd';
import {
  SortAscendingOutlined,
  SortDescendingOutlined,
  PlusOutlined,
  GithubOutlined,
  TeamOutlined,
  SyncOutlined,
  DeleteOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { Global } from '@emotion/react';
import 'antd/dist/reset.css';
import { Op } from '../../../../src';
import { useController } from './utils';
import * as styles from './styles';

export default function People(): ReactElement {
  const controller = useController();

  const creating = controller.state.model.people.filter((_, i) => controller.state.inspect.people[i].is(Op.Add)).length;
  const updating = controller.state.model.people.filter((_, i) => controller.state.inspect.people[i].name.pending()).length;
  const deleting = controller.state.model.people.filter((_, i) => controller.state.inspect.people[i].is(Op.Remove)).length;
  const total = controller.state.model.people.length - creating - deleting;

  return (
    <App>
      <Global styles={styles.globalStyles} />

      <div css={styles.wrapper}>
        <h1 css={styles.title}>Immertation</h1>

        <div css={styles.container}>
          <div css={styles.buttonGroup}>
            <Space size="middle">
              <Button
                variant="filled"
                icon={controller.sortOrder === 'asc' ? <SortDescendingOutlined /> : <SortAscendingOutlined />}
                onClick={controller.toggleSort}
                loading={controller.sorting}
                disabled={controller.sorting}
              >
                {controller.sorting ? 'Sorting...' : `Sort ${controller.sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
              </Button>

              <Button variant="filled" icon={<PlusOutlined />} onClick={controller.handleCreate}>
                Create Person
              </Button>
            </Space>
          </div>

          <div css={styles.statsGroup}>
            <span css={styles.statBadge}><TeamOutlined /> <Badge count={total} showZero color="#8c8c8c" /></span>
            <span css={styles.statBadge}><PlusOutlined /> <Badge count={creating} showZero color="#52c41a" /></span>
            <span css={styles.statBadge}><SyncOutlined /> <Badge count={updating} showZero color="#1890ff" /></span>
            <span css={styles.statBadge}><DeleteOutlined /> <Badge count={deleting} showZero color="#ff4d4f" /></span>
          </div>

          <div css={styles.listContainer}>
            <Table
              dataSource={controller.state.model.people}
              rowKey="id"
              pagination={false}
              size="small"
              tableLayout="fixed"
              columns={[
                {
                  title: 'Name',
                  dataIndex: 'name',
                  key: 'name',
                  width: 240,
                  render: (name, _, index) => {
                    const isUpdating = controller.state.inspect.people[index].name.pending();
                    const isCreating = controller.state.inspect.people[index].is(Op.Add);
                    const isDeleting = controller.state.inspect.people[index].is(Op.Remove);
                    return (
                      <Space>
                        <Typography.Text css={isDeleting ? styles.creatingText : undefined}>
                          {name}
                        </Typography.Text>
                        {isUpdating && (
                          <Tag color="blue">→ {controller.state.inspect.people[index].name.draft()}</Tag>
                        )}
                        {isCreating && <Tag color="green">Creating</Tag>}
                        {isDeleting && <Tag color="red">Deleting</Tag>}
                      </Space>
                    );
                  },
                },
                {
                  title: 'Age',
                  dataIndex: 'age',
                  key: 'age',
                  width: 80,
                },
                {
                  title: '',
                  key: 'actions',
                  width: 180,
                  align: 'right',
                  render: (_, person, index) => {
                    const isUpdating = controller.state.inspect.people[index].name.pending();
                    const isCreating = controller.state.inspect.people[index].is(Op.Add);
                    const isDeleting = controller.state.inspect.people[index].is(Op.Remove);
                    const isPending = isUpdating || isCreating || isDeleting;
                    return (
                      <Space>
                        <Button
                          size="small"
                          disabled={isPending}
                          loading={isUpdating}
                          onClick={() => controller.handleUpdate(person.id)}
                        >
                          {isUpdating ? 'Updating…' : 'Update'}
                        </Button>
                        <Button
                          color="danger"
                          variant="filled"
                          size="small"
                          disabled={isPending}
                          loading={isDeleting}
                          onClick={() => controller.handleDelete(person.id)}
                        >
                          {isDeleting ? 'Deleting…' : 'Delete'}
                        </Button>
                      </Space>
                    );
                  },
                },
              ]}
            />
          </div>
        </div>
      </div>

      <div css={styles.cornerLinks}>
        <a href="/docs/" target="_blank" css={styles.cornerLink}>
          <FloatButton icon={<FileTextOutlined />} />
          <span>Docs</span>
        </a>
        <a href="https://github.com/Wildhoney/Immertation" target="_blank" css={styles.cornerLink}>
          <FloatButton icon={<GithubOutlined />} />
          <span>GitHub</span>
        </a>
      </div>
    </App>
  );
}

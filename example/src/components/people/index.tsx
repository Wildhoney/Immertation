import type { ReactElement } from 'react';
import { User, Loader2 } from 'lucide-react';
import { Button, Space, List, Typography, FloatButton, App } from 'antd';
import { SortAscendingOutlined, SortDescendingOutlined, PlusOutlined, GithubOutlined } from '@ant-design/icons';
import { Global } from '@emotion/react';
import 'antd/dist/reset.css';
import { Op } from '../../../../src';
import { useController } from './utils';
import * as styles from './styles';

export default function People(): ReactElement {
  const controller = useController();

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
              >
                Sort {controller.sortOrder === 'asc' ? 'Descending' : 'Ascending'}
              </Button>

              <Button variant="filled" icon={<PlusOutlined />} onClick={controller.handleCreate}>
                Create Person
              </Button>
            </Space>
          </div>

          <div css={styles.listContainer}>
            <List
              dataSource={controller.state.model.people}
              renderItem={(person, index) => {
                const isUpdating = controller.state.inspect.people[index].name.pending();
                const isCreating = controller.state.inspect.people[index].is(Op.Add);
                const isDeleting = controller.state.inspect.people[index].is(Op.Remove);
                const isPending = isUpdating || isCreating || isDeleting;

                return (
                  <List.Item
                    key={person.id}
                    actions={[
                      <Button
                        key="update"
                        size="small"
                        disabled={isPending}
                        loading={isUpdating}
                        onClick={() => controller.handleUpdate(person.id)}
                      >
                        {isUpdating ? 'Updating…' : 'Update'}
                      </Button>,

                      <Button
                        key="delete"
                        color="danger"
                        variant="filled"
                        size="small"
                        disabled={isPending}
                        loading={isDeleting}
                        onClick={() => controller.handleDelete(person.id)}
                      >
                        {isDeleting ? 'Deleting…' : 'Delete'}
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={
                        isPending ? (
                          <Loader2 size={20} css={styles.spinningLoader} />
                        ) : (
                          <User size={20} css={styles.userIcon} />
                        )
                      }
                      title={
                        <Space>
                          <Typography.Text css={isDeleting ? styles.creatingText : undefined}>
                            {person.name}
                          </Typography.Text>

                          {isUpdating && (
                            <Typography.Text type="secondary" css={styles.secondaryText}>
                              (Updating...)
                            </Typography.Text>
                          )}

                          {isCreating && (
                            <Typography.Text type="secondary" css={styles.creatingSecondaryText}>
                              (Creating...)
                            </Typography.Text>
                          )}

                          {isDeleting && (
                            <Typography.Text type="secondary" css={styles.creatingSecondaryText}>
                              (Deleting...)
                            </Typography.Text>
                          )}
                        </Space>
                      }
                    />
                  </List.Item>
                );
              }}
            />
          </div>
        </div>
      </div>

      <FloatButton
        css={styles.githubButton}
        icon={<GithubOutlined />}
        href="https://github.com/Wildhoney/Immertation"
        target="_blank"
        tooltip="View on GitHub"
      />
    </App>
  );
}

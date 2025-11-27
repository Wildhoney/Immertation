import type { ReactElement } from 'react';
import { App } from 'antd';
import { Global } from '@emotion/react';
import 'antd/dist/reset.css';
import { useController } from './utils';
import { Actions } from './components/actions';
import { Statistics } from './components/statistics';
import { Table } from './components/table';
import { Links } from './components/links';
import * as styles from './styles';

/**
 * Main People component demonstrating Immertation with optimistic UI.
 */
export default function People(): ReactElement {
  const controller = useController();

  return (
    <App>
      <Global styles={styles.reset} />

      <div css={styles.layout}>
        <h1 css={styles.title}>Immertation</h1>

        <div css={styles.container}>
          <Actions controller={controller} />
          <Statistics controller={controller} />
          <Table controller={controller} />
        </div>
      </div>

      <Links />
    </App>
  );
}

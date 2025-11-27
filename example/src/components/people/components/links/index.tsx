import type { ReactElement } from 'react';
import { FloatButton } from 'antd';
import { GithubOutlined, FileTextOutlined } from '@ant-design/icons';
import * as styles from '../../styles';

/**
 * Links component with documentation and GitHub links.
 */
export function Links(): ReactElement {
  return (
    <div css={styles.links}>
      <a href="docs/" target="_blank" css={styles.link}>
        <FloatButton icon={<FileTextOutlined />} />
        <span>API Docs</span>
      </a>
      <a href="https://github.com/Wildhoney/Immertation" target="_blank" css={styles.link}>
        <FloatButton icon={<GithubOutlined />} />
        <span>GitHub</span>
      </a>
    </div>
  );
}

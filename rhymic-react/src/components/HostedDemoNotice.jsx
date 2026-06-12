import React from 'react';
import { Link } from 'react-router-dom';
import { Info, Upload } from 'lucide-react';
import styles from './HostedDemoNotice.module.css';

const HostedDemoNotice = ({ compact = false }) => (
  <aside className={`${styles.notice} ${compact ? styles.compact : ''}`} aria-label="Hosted demo notice">
    <div className={styles.icon}>
      <Info size={20} />
    </div>
    <div className={styles.content}>
      <strong>Hosted demo notice</strong>
      <p>
        Third-party catalog playback is disabled in this public deployment to respect content licensing
        and platform distribution policies. RhyMic's local playback, playlists, audio tools, visualizer,
        and library experience remain available for evaluation.
      </p>
    </div>
    <Link className={styles.action} to="/upload">
      <Upload size={16} />
      Try Local Files
    </Link>
  </aside>
);

export default HostedDemoNotice;

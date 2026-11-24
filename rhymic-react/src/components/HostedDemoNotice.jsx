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
      <strong>Online Streaming Status</strong>
      <p>
        Online discovery is currently unavailable. Play bundled tracks like <em>Alone</em> and <em>Darkside</em> from your library, or upload your own audio files.
      </p>
    </div>
    <Link className={styles.action} to="/upload">
      <Upload size={16} />
      Upload Files
    </Link>
  </aside>
);

export default HostedDemoNotice;

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
        YouTube Music streaming is currently unavailable in this online deployment (due to server IP rate limits).
        Please try the <strong>preloaded offline songs</strong> already in your Library (such as <em>Alone</em>, <em>Darkside</em>, and more)
        to experience the Web Audio engine, 10-band EQ, and Visualizer, or upload your own files.
      </p>
    </div>
    <Link className={styles.action} to="/upload">
      <Upload size={16} />
      Upload Files
    </Link>
  </aside>
);

export default HostedDemoNotice;

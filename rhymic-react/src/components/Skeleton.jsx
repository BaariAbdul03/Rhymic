import React from 'react';
import styles from './Skeleton.module.css';

export const SkeletonBox = ({ width, height, borderRadius, style }) => {
  return (
    <div 
      className={styles.skeleton} 
      style={{ width, height, borderRadius: borderRadius || '8px', ...style }}
    />
  );
};

export const SkeletonText = ({ width, rows = 1 }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={styles.skeleton} style={{ height: '16px', borderRadius: '4px', width: i === rows - 1 && rows > 1 ? '70%' : '100%' }} />
      ))}
    </div>
  );
};

export const SongCardSkeleton = () => {
  return (
    <div className={styles.songCardSkeleton}>
      <SkeletonBox width="100%" height="auto" style={{ aspectRatio: '1', marginBottom: '12px' }} />
      <SkeletonText width="100%" rows={2} />
    </div>
  );
};

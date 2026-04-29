import React, { useState, useEffect } from 'react';
import styles from './SongCover.module.css';

/**
 * Universal Song Cover Component (v3 - Ultimate Resilience)
 * - Uses multi-stage retry logic.
 * - Stage 1: Backend Proxy (default)
 * - Stage 2: Direct URL (circuit breaker)
 * - Stage 3: High-res fallback (Google CDN tweak)
 */
const SongCover = ({ src, alt, className, size = 'large' }) => {
  const [imgSrc, setImgSrc] = useState(src);
  const [retryStage, setRetryStage] = useState(0); // 0: Proxy, 1: Direct/Fallback, 2: Final
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Reset state when source changes
  useEffect(() => {
    setImgSrc(src);
    setError(!src);
    setLoaded(false);
    setRetryStage(0);
  }, [src]);

  const handleImageError = () => {
    // STAGE 1 -> 2: If proxy fails, try direct fallback URL
    if (retryStage === 0 && imgSrc && imgSrc.includes('/api/stream/thumbnail')) {
      try {
        const urlParams = new URL(imgSrc, window.location.origin).searchParams;
        const fallback = urlParams.get('fallback');
        if (fallback) {
          console.warn("[SongCover] Stage 1 failed. Falling back to direct URL.");
          setImgSrc(fallback);
          setRetryStage(1);
          return;
        }
      } catch (e) { console.warn(e); }
    }

    // STAGE 2 -> 3: If direct URL fails and it's a google CDN, try to downgrade quality for stability
    if (retryStage === 1 && imgSrc && imgSrc.includes('googleusercontent.com')) {
      console.warn("[SongCover] Stage 2 failed. Attempting low-res fallback.");
      const lowRes = imgSrc.split('=')[0] + "=s120"; // Force small size instead of s0
      setImgSrc(lowRes);
      setRetryStage(2);
      return;
    }

    // FINAL: Give up
    setError(true);
  };

  const isLocal = imgSrc && (imgSrc.startsWith('/assets') || imgSrc.startsWith('blob:'));

  return (
    <div 
      className={`${styles.coverContainer} ${styles[size]} ${className || ''}`}
    >
      {!error && imgSrc && (
        <img
          src={imgSrc}
          alt={alt || 'Song Cover'}
          referrerPolicy="no-referrer"
          loading="lazy"
          className={`${styles.image} ${(loaded || isLocal) ? styles.loaded : styles.loading}`}
          onLoad={() => setLoaded(true)}
          onError={handleImageError}
        />
      )}
      
      {(error || !src || (!loaded && !isLocal)) && (
        <div className={`${styles.fallback} ${(!loaded && !isLocal && !error && src) ? styles.loadingOverlay : ''}`}>
          <div className={styles.liquidGold}></div>
          <div className={styles.initials}>
            {alt ? alt.charAt(0).toUpperCase() : '♫'}
          </div>
        </div>
      )}
    </div>
  );
};

export default SongCover;

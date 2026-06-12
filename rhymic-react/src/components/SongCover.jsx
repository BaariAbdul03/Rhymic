import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from './SongCover.module.css';

const brokenUrls = new Set();
const successfulUrls = new Set();

const SongCover = ({ src, alt, className, size = 'large' }) => {
  const [imgSrc, setImgSrc] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [retryStage, setRetryStage] = useState(0);
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const containerRef = useRef(null);
  const retryTimerRef = useRef(null);

  useEffect(() => {
    setIsVisible(false);
    setError(false);
    setLoaded(Boolean(src && successfulUrls.has(src)));
    setImgSrc(null);
    setRetryStage(0);

    if (!containerRef.current || !src) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '900px', threshold: 0.01 }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [src]);

  useEffect(() => {
    if (!isVisible || !src) return;

    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    if (brokenUrls.has(src)) {
      setError(true);
      return;
    }

    setImgSrc(src);
  }, [isVisible, src]);

  const handleImageError = useCallback(() => {
    if (retryStage === 0 && imgSrc?.includes('/api/stream/thumbnail')) {
      try {
        const urlParams = new URL(imgSrc, window.location.origin).searchParams;
        const fallback = urlParams.get('fallback');
        if (fallback) {
          retryTimerRef.current = setTimeout(() => {
            setImgSrc(fallback);
            setRetryStage(1);
          }, 120);
          return;
        }
      } catch {
        // Continue to the next fallback.
      }
    }

    if (retryStage === 1 && imgSrc?.includes('googleusercontent.com')) {
      const lowRes = imgSrc.split('=')[0] + '=s226';
      retryTimerRef.current = setTimeout(() => {
        setImgSrc(lowRes);
        setRetryStage(2);
      }, 120);
      return;
    }

    brokenUrls.add(src);
    setError(true);
  }, [retryStage, imgSrc, src]);

  const handleLoad = () => {
    setLoaded(true);
    if (src) successfulUrls.add(src);
  };

  const isLocal = imgSrc && (
    imgSrc.startsWith('/assets') ||
    imgSrc.startsWith('blob:') ||
    imgSrc.startsWith('data:')
  );
  const shouldShowImage = !error && imgSrc;
  const shouldShowFallback = error || !src || (!loaded && !isLocal);

  return (
    <div
      ref={containerRef}
      className={`${styles.coverContainer} ${styles[size]} ${className || ''}`}
    >
      {shouldShowImage && (
        <img
          src={imgSrc}
          alt={alt || 'Cover'}
          referrerPolicy="no-referrer"
          decoding="async"
          loading="eager"
          fetchPriority={size === 'small' ? 'auto' : 'high'}
          className={`${styles.image} ${(loaded || isLocal) ? styles.loaded : styles.loading}`}
          onLoad={handleLoad}
          onError={handleImageError}
        />
      )}

      {shouldShowFallback && (
        <div className={`${styles.fallback} ${(!loaded && !isLocal && !error && src) ? styles.loadingOverlay : ''}`}>
          <div className={styles.liquidGold}></div>
          <div className={styles.initials}>
            {alt && alt !== 'cover' ? alt.charAt(0).toUpperCase() : 'R'}
          </div>
        </div>
      )}
    </div>
  );
};

export default SongCover;

import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from './SongCover.module.css';

/**
 * Universal Song Cover Component (v5.2 - Final Ultra-Stability)
 * 
 * Improvements:
 * - Removed 'force-loaded' shortcut for successful URLs (caused broken icon flicker).
 * - Now ALWAYS waits for browser 'onLoad' before hiding the fallback.
 * - Prioritizes 'isVisible' state more reliably.
 */

const _brokenUrls = new Set();
const _successfulUrls = new Set();

const SongCover = ({ src, alt, className, size = 'large' }) => {
  const [imgSrc, setImgSrc] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [retryStage, setRetryStage] = useState(0);
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  
  const containerRef = useRef(null);
  const retryTimerRef = useRef(null);

  // Intersection Observer to trigger load only when visible
  useEffect(() => {
    // Reset state whenever src changes
    setIsVisible(false);
    setError(false);
    setLoaded(false);
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
      { rootMargin: '600px', threshold: 0.01 } // Increased margin to 600px for even smoother loading
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [src]);

  // Handle image loading logic once visible
  useEffect(() => {
    if (!isVisible || !src) return;

    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    if (_brokenUrls.has(src)) {
      setError(true);
      return;
    }

    // Set imgSrc immediately if visible, let onLoad handle the transition
    // (Wait a tiny bit to avoid main thread jank during rapid UI changes)
    const schedule = window.requestIdleCallback || ((cb) => setTimeout(cb, 10));
    const id = schedule(() => {
      setImgSrc(src);
    });

    return () => {
      const cancel = window.cancelIdleCallback || clearTimeout;
      cancel(id);
    };
  }, [isVisible, src]);

  const handleImageError = useCallback(() => {
    // If the image itself fails, try our fallback logic
    if (retryStage === 0 && imgSrc?.includes('/api/stream/thumbnail')) {
      try {
        const urlParams = new URL(imgSrc, window.location.origin).searchParams;
        const fallback = urlParams.get('fallback');
        if (fallback) {
          retryTimerRef.current = setTimeout(() => {
            setImgSrc(fallback);
            setRetryStage(1);
          }, 300);
          return;
        }
      } catch (e) {}
    }

    if (retryStage === 1 && imgSrc?.includes('googleusercontent.com')) {
      const lowRes = imgSrc.split('=')[0] + "=s226";
      retryTimerRef.current = setTimeout(() => {
        setImgSrc(lowRes);
        setRetryStage(2);
      }, 300);
      return;
    }

    // If all else fails, mark as broken and show fallback UI
    _brokenUrls.add(src);
    setError(true);
  }, [retryStage, imgSrc, src]);

  const handleLoad = () => {
    setLoaded(true);
    _successfulUrls.add(src);
  };

  const isLocal = imgSrc && (imgSrc.startsWith('/assets') || imgSrc.startsWith('blob:'));

  return (
    <div 
      ref={containerRef}
      className={`${styles.coverContainer} ${styles[size]} ${className || ''}`}
    >
      {!error && imgSrc && (
        <img
          src={imgSrc}
          alt={alt || 'Cover'}
          referrerPolicy="no-referrer"
          decoding="async"
          className={`${styles.image} ${(loaded || isLocal) ? styles.loaded : styles.loading}`}
          onLoad={handleLoad}
          onError={handleImageError}
        />
      )}
      
      {(error || !src || (!loaded && !isLocal)) && (
        <div className={`${styles.fallback} ${(!loaded && !isLocal && !error && src) ? styles.loadingOverlay : ''}`}>
          <div className={styles.liquidGold}></div>
          <div className={styles.initials}>
            {alt && alt !== 'cover' ? alt.charAt(0).toUpperCase() : '♫'}
          </div>
        </div>
      )}
    </div>
  );
};

export default SongCover;

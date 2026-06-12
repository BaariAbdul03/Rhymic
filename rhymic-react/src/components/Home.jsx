import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Play, Radio } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import styles from './Home.module.css';
import Hero from './Hero';
import TopSongs from './TopSongs';
import SongCover from './SongCover';
import HostedDemoNotice from './HostedDemoNotice';
import { useMusicStore } from '../store/musicStore';
import { streamApi } from '../services/api';
import { preloadImages } from '../utils/preloadImages';

const HOME_CHIPS = ['Hindi', 'English', 'Rap', 'Modern', 'Romantic', 'Retro Classics'];
const BLOCKED_ONLINE_TERMS = ['mashup', 'non stop', 'non-stop', 'jukebox', 'dj mix', 'mega mix', 'megamix', 'remix', 'slowed', 'reverb', 'nightcore', 'karaoke'];
const CATALOG_CARD_LIMIT = 14;
let cachedOnlineRanked = null;
const personalizedCache = new Map();

const isCleanOnlineSong = (song) => {
  const text = `${song?.title || ''} ${song?.artist || ''} ${song?.album || ''}`.toLowerCase();
  return !BLOCKED_ONLINE_TERMS.some((term) => text.includes(term));
};

const SongRail = ({ title, songs, status, onPlay }) => {
  const railRef = useRef(null);

  if (!songs || songs.length === 0) return null;

  const scrollRail = (direction) => {
    const rail = railRef.current;
    if (!rail) return;
    const amount = Math.max(rail.clientWidth * 0.82, 320);
    rail.scrollBy({ left: direction * amount, behavior: 'smooth' });
  };

  return (
    <section className={`${styles.railSection} ${status === 'active' ? styles.onlineRail : ''}`}>
      <div className={styles.sectionHeader}>
        <h2>{title}</h2>
        <div className={styles.railControls}>
          <button className={styles.railNavBtn} onClick={() => scrollRail(-1)} aria-label={`Scroll ${title} left`}>
            <ChevronLeft size={18} />
          </button>
          <button className={styles.railNavBtn} onClick={() => scrollRail(1)} aria-label={`Scroll ${title} right`}>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className={styles.songRail} ref={railRef}>
        {songs.slice(0, CATALOG_CARD_LIMIT).map((song, index) => (
          <button key={`${title}-${song.id}-${index}`} className={styles.railCard} onClick={() => onPlay(song, songs)}>
            <div className={styles.railCoverWrap}>
              <SongCover src={song.cover} alt={song.title} className={styles.railCover} />
              <span className={styles.railPlay}><Play size={16} fill="currentColor" /></span>
            </div>
            <span className={styles.railTitle}>{song.title}</span>
            <span className={styles.railArtist}>{song.artist}</span>
            {song.source === 'online' && <span className={styles.railBadge}>Online</span>}
          </button>
        ))}
      </div>
    </section>
  );
};

const Home = () => {
  const navigate = useNavigate();
  const songs = useMusicStore((state) => state.songs);
  const recentlyPlayed = useMusicStore((state) => state.recentlyPlayed);
  const likedSongs = useMusicStore((state) => state.likedSongs);
  const currentSong = useMusicStore((state) => state.currentSong);
  const setCurrentSong = useMusicStore((state) => state.setCurrentSong);
  const setQueue = useMusicStore((state) => state.setQueue);
  const [onlineRanked, setOnlineRanked] = useState(cachedOnlineRanked || []);
  const [personalizedOnline, setPersonalizedOnline] = useState([]);
  const [onlineStatus, setOnlineStatus] = useState(cachedOnlineRanked ? 'active' : 'checking');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    let ignore = false;

    const loadOnlineRanked = async () => {
      if (cachedOnlineRanked?.length) {
        setOnlineRanked(cachedOnlineRanked);
        setOnlineStatus('active');
        return;
      }

      try {
        const statusRes = await streamApi.status();
        if (statusRes.data?.enabled === false) {
          setOnlineStatus('disabled');
          return;
        }

        const res = await streamApi.getTrending();
        const cleanSongs = Array.isArray(res.data) ? res.data.filter(isCleanOnlineSong) : [];
        if (!ignore && cleanSongs.length > 0) {
          preloadImages(cleanSongs, 18);
          cachedOnlineRanked = cleanSongs;
          setOnlineRanked(cleanSongs);
          setOnlineStatus('active');
          return;
        }
        setOnlineStatus('fallback');
      } catch {
        if (!ignore) setOnlineStatus('fallback');
      }
    };

    loadOnlineRanked();
    return () => {
      ignore = true;
    };
  }, []);

  const preferenceSeed = useMemo(() => {
    const likedSet = new Set(likedSongs);
    const listeningPool = [
      currentSong,
      ...recentlyPlayed,
      ...songs.filter((song) => likedSet.has(song.id))
    ].filter(Boolean);

    const artistCounts = new Map();
    const genreCounts = new Map();
    listeningPool.forEach((song) => {
      if (song.artist) artistCounts.set(song.artist, (artistCounts.get(song.artist) || 0) + 1);
      if (song.genre) genreCounts.set(song.genre, (genreCounts.get(song.genre) || 0) + 1);
    });

    const topArtist = [...artistCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const topGenre = [...genreCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    return topArtist || topGenre || 'fresh new music';
  }, [currentSong, likedSongs, recentlyPlayed, songs]);

  useEffect(() => {
    if (!preferenceSeed || onlineStatus === 'disabled') return undefined;
    let ignore = false;
    const cacheKey = preferenceSeed.toLowerCase();

    const loadPersonalizedOnline = async () => {
      if (personalizedCache.has(cacheKey)) {
        setPersonalizedOnline(personalizedCache.get(cacheKey));
        return;
      }

      try {
        const res = await streamApi.search(`${preferenceSeed} latest official songs`);
        const cleanSongs = Array.isArray(res.data) ? res.data.filter(isCleanOnlineSong) : [];
        if (!ignore && cleanSongs.length > 0) {
          personalizedCache.set(cacheKey, cleanSongs);
          preloadImages(cleanSongs, 14);
          setPersonalizedOnline(cleanSongs);
        }
      } catch {
        if (!ignore) setPersonalizedOnline([]);
      }
    };

    loadPersonalizedOnline();
    return () => {
      ignore = true;
    };
  }, [onlineStatus, preferenceSeed]);

  const madeForYou = useMemo(() => {
    const likedSet = new Set(likedSongs);
    const freshOnline = personalizedOnline.length ? personalizedOnline : onlineRanked;
    const freshIds = new Set(freshOnline.map((song) => song.id));
    const liked = songs.filter((song) => likedSet.has(song.id));
    const localMatches = liked.length > 0
      ? songs.filter((song) => liked.some((likedSong) => likedSong.artist === song.artist) && !likedSet.has(song.id))
      : songs.slice(5, 13);

    const recentArtists = new Set(recentlyPlayed.map((song) => song.artist).filter(Boolean));
    const recentMatches = songs.filter((song) => recentArtists.has(song.artist));
    const secondaryOnline = onlineRanked.filter((song) => !freshIds.has(song.id));
    const merged = [...localMatches, ...recentMatches, ...songs, ...secondaryOnline];
    const seen = new Set();
    return merged
      .filter((song) => {
        if (!song || seen.has(song.id)) return false;
        seen.add(song.id);
        return true;
      })
      .slice(0, CATALOG_CARD_LIMIT);
  }, [likedSongs, onlineRanked, personalizedOnline, songs]);

  const handlePlayFromRail = (song, pool) => {
    setQueue(pool);
    setCurrentSong(song);
  };

  return (
    <div className={styles.homeContainer}>
      <Hero onlineSongs={onlineRanked} onlineStatus={onlineStatus} />

      {onlineStatus === 'disabled' && <HostedDemoNotice />}

      <div className={styles.quickStrip}>
        <div className={`${styles.statusPill} ${styles[onlineStatus] || ''}`}>
          <Radio size={14} />
          {onlineStatus === 'active' ? 'Online catalog active' : onlineStatus === 'checking' ? 'Checking online catalog' : 'Using local fallback'}
        </div>
        <div className={styles.chipRow}>
          {HOME_CHIPS.map((chip) => (
            <button key={chip} className={styles.genreChip} onClick={() => navigate(`/discover?category=${encodeURIComponent(chip)}`)}>
              {chip}
            </button>
          ))}
        </div>
      </div>

      <SongRail title="Fresh Online For You" songs={personalizedOnline.length ? personalizedOnline : onlineRanked} status={onlineStatus} onPlay={handlePlayFromRail} />
      <SongRail title="Recently Played" songs={recentlyPlayed} onPlay={handlePlayFromRail} />
      <SongRail title="Made For You" songs={madeForYou} onPlay={handlePlayFromRail} />

      <div className={styles.topSongsSection}>
        <div className={styles.sectionHeader}>
          <h2>Popular Songs</h2>
        </div>
        <TopSongs limit={8} hideHeader={true} />
      </div>
    </div>
  );
};

export default Home;

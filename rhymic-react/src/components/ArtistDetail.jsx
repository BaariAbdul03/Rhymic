import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, Heart, Users, Share2, ChevronLeft } from 'lucide-react';
import { useMusicStore } from '../store/musicStore';
import api from '../services/api';
import TopSongs from './TopSongs';
import styles from './ArtistDetail.module.css';

const ArtistDetail = () => {
  const { name } = useParams();
  const navigate = useNavigate();
  const decodedName = decodeURIComponent(name);
  
  const songs = useMusicStore((state) => state.songs);
  const setCurrentSong = useMusicStore((state) => state.setCurrentSong);
  
  const [artistImage, setArtistImage] = useState(null);
  const [loading, setLoading] = useState(true);

  const artistSongs = songs.filter(song => song.artist === decodedName);
  
  useEffect(() => {
    const fetchArtistImage = async () => {
      setLoading(true);
      try {
        // Find existing image from a song or fetch from API
        const songWithImage = artistSongs.find(s => s.cover);
        if (songWithImage) {
          setArtistImage(songWithImage.cover); // Fallback for now
        }
        
        // In a real scenario, we'd have a specific endpoint for artist details
        // const response = await api.get(`/artists/${encodeURIComponent(decodedName)}`);
      } catch (error) {
        console.error("Failed to fetch artist details", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchArtistImage();
    window.scrollTo(0, 0);
  }, [decodedName, artistSongs]);

  if (!artistSongs.length && !loading) {
    return (
      <div className={styles.notFound}>
        <h2>Artist not found in library</h2>
        <button onClick={() => navigate(-1)} className={styles.backBtn}>Go Back</button>
      </div>
    );
  }

  const handlePlayArtist = () => {
    if (artistSongs.length > 0) {
      setCurrentSong(artistSongs[0]);
    }
  };

  return (
    <div className={styles.artistContainer}>
      <div 
        className={styles.heroSection}
        style={{ backgroundImage: `url(${artistImage || '/assets/default_artist.jpg'})` }}
      >
        <div className={styles.heroOverlay}></div>
        <button className={styles.navBack} onClick={() => navigate(-1)}>
          <ChevronLeft size={24} />
        </button>
        
        <div className={styles.heroContent}>
          <div className={styles.verifiedBadge}>
            ✓ Verified Artist
          </div>
          <h1 className={styles.artistName}>{decodedName}</h1>
          <p className={styles.monthlyListeners}>{(artistSongs.length * 1250000).toLocaleString()} Monthly Listeners</p>
          
          <div className={styles.actionRow}>
            <button className={styles.playBtn} onClick={handlePlayArtist}>
              <Play size={24} fill="currentColor" className={styles.playIcon} />
            </button>
            <button className={styles.followBtn}>Follow</button>
            <button className={styles.iconBtn}><Heart size={24} /></button>
            <button className={styles.iconBtn}><Share2 size={24} /></button>
          </div>
        </div>
      </div>

      <div className={styles.contentSection}>
        <div className={styles.mainColumn}>
          <h2 className={styles.sectionTitle}>Popular</h2>
          {/* Reusing TopSongs component but passing filtered songs via props if it supported it.
              Since TopSongs uses store directly, we'll build a mini table here or refactor TopSongs.
              For speed, letting TopSongs show all or we can make a custom list. Let's make a custom mini list. */}
          
          <div className={styles.popularList}>
             {artistSongs.slice(0, 5).map((song, index) => (
                <div key={song.id} className={styles.popularRow} onClick={() => setCurrentSong(song)}>
                  <span className={styles.trackNum}>{index + 1}</span>
                  <img src={song.cover} alt="cover" className={styles.trackCover} />
                  <span className={styles.trackTitle}>{song.title}</span>
                  <span className={styles.trackPlays}>{(10000000 / (index+1)).toLocaleString()}</span>
                  <span className={styles.trackTime}>3:45</span>
                </div>
             ))}
          </div>
        </div>

        <div className={styles.sideColumn}>
          <h2 className={styles.sectionTitle}>About</h2>
          <div className={styles.bioCard}>
             <img src={artistImage} alt="bio" className={styles.bioImage} />
             <div className={styles.bioContent}>
               <p className={styles.bioText}>
                 {decodedName} is a featured artist on Rhymic. Explore their discography and discover top hits.
               </p>
             </div>
          </div>
          
          <h2 className={styles.sectionTitle} style={{marginTop: '32px'}}>Fans Also Like</h2>
          <div className={styles.similarArtists}>
            {/* Placeholder for similar artists */}
            {[1, 2, 3].map(i => (
               <div key={i} className={styles.similarCard}>
                 <div className={styles.similarAvatar}></div>
                 <span className={styles.similarName}>Similar Artist {i}</span>
               </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArtistDetail;

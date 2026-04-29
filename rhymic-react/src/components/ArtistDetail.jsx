import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, Heart, Share2, ChevronLeft } from 'lucide-react';
import { useMusicStore } from '../store/musicStore';
import SongCover from './SongCover';
import api from '../services/api';
import styles from './ArtistDetail.module.css';

const ArtistDetail = () => {
  const { name } = useParams();
  const navigate = useNavigate();
  const decodedName = decodeURIComponent(name);
  
  const songs = useMusicStore((state) => state.songs);
  const setCurrentSong = useMusicStore((state) => state.setCurrentSong);
  
  const [artistImage, setArtistImage] = useState(null);
  const [similarArtists, setSimilarArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);

  const artistSongs = songs.filter(song => song.artist === decodedName);
  
  useEffect(() => {
    // Prevent re-fetching on every render
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const fetchArtistProfile = async () => {
      setLoading(true);
      try {
        // Use the new local-only artist profile endpoint
        const response = await api.get(`/artists/${encodeURIComponent(decodedName)}/profile`);
        const data = response.data;
        
        if (data.image && data.image !== '/assets/default_cover.jpg') {
          setArtistImage(data.image);
        } else {
          // Fallback to first song's cover
          const songWithImage = artistSongs.find(s => s.cover);
          if (songWithImage) setArtistImage(songWithImage.cover);
        }
        
        if (data.similar && data.similar.length > 0) {
          setSimilarArtists(data.similar);
        }
      } catch (error) {
        console.error("Failed to fetch artist details", error);
        // Fallback to song cover
        const songWithImage = artistSongs.find(s => s.cover);
        if (songWithImage) setArtistImage(songWithImage.cover);
      } finally {
        setLoading(false);
      }
    };
    
    fetchArtistProfile();
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
      useMusicStore.getState().setQueue(artistSongs);
      setCurrentSong(artistSongs[0]);
    }
  };

  return (
    <div className={styles.artistContainer}>
      <div 
        className={styles.heroSection}
        style={{ backgroundImage: `url("${artistImage || '/assets/default_cover.jpg'}")` }}
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
          <p className={styles.monthlyListeners}>
            {artistSongs.length} {artistSongs.length === 1 ? 'Song' : 'Songs'} in Library
          </p>
          
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
          
          <div className={styles.popularList}>
             {artistSongs.slice(0, 10).map((song, index) => (
                <div key={song.id} className={styles.popularRow} onClick={() => setCurrentSong(song)}>
                  <span className={styles.trackNum}>{index + 1}</span>
                  <SongCover 
                    src={song.cover} 
                    alt="cover" 
                    size="small" 
                    className={styles.trackCover} 
                  />
                  <span className={styles.trackTitle}>{song.title}</span>
                </div>
             ))}
          </div>
        </div>

        <div className={styles.sideColumn}>
          <h2 className={styles.sectionTitle}>About</h2>
          <div className={styles.bioCard}>
             <SongCover 
               src={artistImage} 
               alt="bio" 
               size="large" 
               className={styles.bioImage} 
             />
             <div className={styles.bioContent}>
               <p className={styles.bioText}>
                 {decodedName} is a featured artist on Rhymic. Explore their discography and discover top hits.
               </p>
             </div>
          </div>
          
          {similarArtists.length > 0 && (
            <>
              <h2 className={styles.sectionTitle} style={{marginTop: '32px'}}>Fans Also Like</h2>
              <div className={styles.similarArtists}>
                {similarArtists.map((artistName, i) => (
                   <div 
                     key={i} 
                     className={styles.similarCard}
                     onClick={() => {
                       fetchedRef.current = false;
                       navigate(`/artist/${encodeURIComponent(artistName)}`);
                     }}
                     style={{ cursor: 'pointer' }}
                   >
                     <div className={styles.similarAvatar}></div>
                     <span className={styles.similarName}>{artistName}</span>
                   </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ArtistDetail;

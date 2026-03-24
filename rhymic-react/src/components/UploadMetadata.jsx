import React, { useRef, useState } from 'react';
import { useMusicStore } from '../store/musicStore';
import toast from 'react-hot-toast';
import { Play } from 'lucide-react';

const UploadMetadata = () => {
  const fileInputRef = useRef(null);
  const addToQueue = useMusicStore(state => state.addToQueue);
  const setCurrentSong = useMusicStore(state => state.setCurrentSong);
  
  const [localSongs, setLocalSongs] = useState([]);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const newSongs = [];
    files.forEach((file, index) => {
      const localUrl = URL.createObjectURL(file);
      const newSong = {
        id: `local-${Date.now()}-${file.name}`,
        title: file.name.replace(/\.[^/.]+$/, ""), // Remove extension for title
        artist: 'Unknown Artist',
        src: localUrl,
        cover: 'https://images.unsplash.com/photo-1614680376593-902f74a9cb0d?auto=format&fit=crop&w=150&q=80'
      };
      
      newSongs.push(newSong);
      addToQueue(newSong);
      
      if (index === 0 && !useMusicStore.getState().currentSong) {
        setCurrentSong(newSong);
      }
    });

    setLocalSongs(prev => [...prev, ...newSongs]);
    toast.success(`Successfully loaded ${files.length} local files!`);
  };

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '8px' }}>Local Files</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '40px' }}>Upload your own songs from your local computer and play them instantly.</p>
      
      <div style={{ backgroundColor: 'var(--bg-elevated)', padding: '40px', borderRadius: '12px', textAlign: 'center', border: '2px dashed var(--border-color)', marginBottom: '40px' }}>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>Drag and drop audio files here, or click to browse.</p>
        
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          accept="audio/*" 
          multiple 
          onChange={handleFileChange}
        />
        
        <button 
          onClick={() => fileInputRef.current.click()} 
          style={{ padding: '12px 24px', backgroundColor: 'var(--accent-primary)', color: 'var(--bg-primary)', border: 'none', borderRadius: '30px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          Select Files
        </button>
      </div>

      {localSongs.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '24px' }}>Uploaded Songs</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {localSongs.map((song, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 16px', backgroundColor: 'var(--bg-elevated)', borderRadius: '8px', transition: 'background-color 0.2s', border: '1px solid transparent' }}>
                <img src={song.cover} alt="Cover" style={{ width: '48px', height: '48px', borderRadius: '6px', objectFit: 'cover' }} />
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: 'var(--text-primary)' }}>{song.title}</h4>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{song.artist}</p>
                </div>
                <button 
                  onClick={() => setCurrentSong(song)}
                  style={{ background: 'var(--accent-primary)', border: 'none', color: 'var(--bg-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '50%', transition: 'transform 0.2s' }}
                  onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
                  onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                >
                  <Play size={20} fill="currentColor" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadMetadata;

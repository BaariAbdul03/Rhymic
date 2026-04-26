import React from 'react';
import { Play, MoreHorizontal, GripVertical, X, Circle } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useMusicStore } from '../store/musicStore';
import { useUIStore } from '../store/uiStore';
import SongCover from './SongCover';
import styles from './RightPanel.module.css';

const RightPanel = ({ isOverlay }) => {
  const { queue, currentSong, setCurrentSong, reorderQueue } = useMusicStore();
  const setRightPanelOpen = useUIStore(state => state.setRightPanelOpen);
  
  // Resize logic
  const [panelWidth, setPanelWidth] = React.useState(parseInt(localStorage.getItem('queueWidth')) || 400);
  const [isResizing, setIsResizing] = React.useState(false);

  const startResizing = React.useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = React.useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = React.useCallback((e) => {
    if (isResizing) {
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 300 && newWidth <= 600) {
        setPanelWidth(newWidth);
        localStorage.setItem('queueWidth', newWidth);
      }
    }
  }, [isResizing]);

  React.useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    } else {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    reorderQueue(result.source.index, result.destination.index);
  };

  const displayQueue = Array.isArray(queue) ? queue : [];
  // Only show songs that come AFTER the current song — this matches nextSong() behaviour
  const currentIndex = displayQueue.findIndex(s => s.id === currentSong?.id);
  const upcoming = currentIndex >= 0
    ? displayQueue.slice(currentIndex + 1, currentIndex + 31)
    : displayQueue.slice(0, 30);

  return (
    <aside 
      className={`${styles.rightPanel} ${isOverlay ? styles.desktopOverlay : ''}`}
      style={{ width: isOverlay || window.innerWidth >= 1024 ? `${panelWidth}px` : 'auto' }}
    >
      {(isOverlay || window.innerWidth >= 1024) && (
        <div 
          className={styles.resizeHandle} 
          onMouseDown={startResizing}
          title="Drag to resize queue"
          style={{ cursor: 'ew-resize' }}
        />
      )}
      {/* Drawer Header */}
      <div className={styles.drawerHeader}>
        <button 
          className={`${styles.iconBtn} ${isOverlay ? styles.forceShow : styles.mobileOnlyBtn}`} 
          onClick={() => setRightPanelOpen(false)}
        >
          <X size={24} />
        </button>
        <h3 className={styles.headerTitle}>Queue</h3>
      </div>

      <div className={styles.queueContainer}>
        {currentSong && (
          <div className={styles.sectionBlock}>
            <h4 className={styles.sectionTitle}>Now playing</h4>
            <div className={styles.queueItem} style={{ padding: '8px 0' }}>
              <SongCover 
                src={currentSong.cover} 
                alt="cover" 
                size="medium" 
                className={styles.queueCover} 
              />
              <div className={styles.queueInfo}>
                <p className={`${styles.queueTitle} ${styles.activeText}`}>{currentSong.title}</p>
                <p className={styles.queueArtist}>{currentSong.artist}</p>
              </div>
              <button className={styles.queueAction}>
                <MoreHorizontal size={20} />
              </button>
            </div>
          </div>
        )}

        {upcoming.length > 0 && (
          <div className={styles.sectionBlock}>
            <h4 className={styles.sectionTitle}>Next from Queue</h4>
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="queue-list">
                {(provided) => (
                  <div className={styles.queueList} {...provided.droppableProps} ref={provided.innerRef}>
                    {upcoming.map((song, index) => (
                      <Draggable key={`queue-${song.id}-${index}`} draggableId={`queue-${song.id}-${index}`} index={index}>
                        {(provided, snapshot) => (
                          <div 
                            className={`${styles.queueItem} ${snapshot.isDragging ? styles.dragging : ''}`}
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            style={{ padding: '8px 0', ...provided.draggableProps.style }}
                          >
                            <div className={styles.circleIcon}>
                              <Circle size={20} strokeWidth={1.5} color="var(--text-muted)" />
                            </div>
                            
                            <SongCover 
                              src={song.cover} 
                              alt="cover" 
                              size="small" 
                              className={styles.queueCoverSmall} 
                            />
                            
                            <div className={styles.queueInfo} onClick={() => setCurrentSong(song)}>
                              <p className={styles.queueTitle}>{song.title}</p>
                              <p className={styles.queueArtist}>{song.artist}</p>
                            </div>
                            
                            <button className={styles.queueAction} {...provided.dragHandleProps}>
                              <GripVertical size={20} />
                            </button>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>
        )}
      </div>
    </aside>
  );
};

export default RightPanel;

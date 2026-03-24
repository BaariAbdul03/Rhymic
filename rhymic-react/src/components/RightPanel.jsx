import React from 'react';
import { Play, MoreHorizontal, GripVertical, X, Circle } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useMusicStore } from '../store/musicStore';
import { useUIStore } from '../store/uiStore';
import styles from './RightPanel.module.css';

const RightPanel = ({ isOverlay }) => {
  const { queue, currentSong, setCurrentSong, reorderQueue } = useMusicStore();
  const setRightPanelOpen = useUIStore(state => state.setRightPanelOpen);

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    reorderQueue(result.source.index, result.destination.index);
  };

  const displayQueue = Array.isArray(queue) ? queue : [];
  // Exclude current track from upcoming
  const upcoming = displayQueue.filter(s => s.id !== currentSong?.id).slice(0, 30);

  return (
    <aside className={`${styles.rightPanel} ${isOverlay ? styles.desktopOverlay : ''}`}>
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
              <img src={currentSong.cover} alt="cover" className={styles.queueCover} />
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
                      <Draggable key={song.id + index} draggableId={song.id + index.toString()} index={index}>
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
                            
                            <img src={song.cover} alt="cover" className={styles.queueCoverSmall} />
                            
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

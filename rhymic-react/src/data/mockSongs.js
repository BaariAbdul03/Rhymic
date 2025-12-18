// src/data/mockSongs.js

// --- IMPORT ALL ASSETS ---
import song2 from '../assets/2.mp3';
import cover2 from '../assets/2.jpg'; // This is 'Alone' by Alan Walker

import song3 from '../assets/3.mp3';
import cover3 from '../assets/3.jpg'; // This is 'Darkside' by Alan Walker

import song4 from '../assets/4.mp3';
import cover4 from '../assets/4.jpg'; // This is 'Thala For A Reason'

import song12 from '../assets/12.mp3';
import cover12 from '../assets/12.jpg'; // This is 'Main Zindagi Ka Saath'

import song17 from '../assets/17.mp3';
import cover17 from '../assets/17.jpg'; // This is 'Dreams'

// --- EXPORT THE ARRAY USING THE IMPORTED ASSETS ---
export const songs = [
  {
    id: 1,
    title: 'Alone',
    artist: 'Alan Walker',
    cover: cover2,
    src: song2
  },
  {
    id: 2,
    title: 'Darkside',
    artist: 'Alan Walker',
    cover: cover3,
    src: song3
  },
  {
    id: 3,
    title: 'THALA FOR A REASON',
    artist: 'MC CHOKA',
    cover: cover4,
    src: song4
  },
  {
    id: 4,
    title: 'Main Zindagi Ka Saath',
    artist: 'Mohammed Rafi',
    cover: cover12,
    src: song12
  },
  {
    id: 5,
    title: 'Dreams',
    artist: 'SWAYYAM',
    cover: cover17,
    src: song17
  }
];
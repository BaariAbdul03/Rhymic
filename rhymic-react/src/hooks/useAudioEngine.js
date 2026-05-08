import { useEffect, useRef } from 'react';
import { useMusicStore } from '../store/musicStore';

const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

export const useAudioEngine = () => {
  const audioElement = useMusicStore((state) => state.audioElement);
  const isPlaying = useMusicStore((state) => state.isPlaying);

  // Store state for EQ / effects
  const eqBands = useMusicStore((state) => state.eqBands);
  const bassBoost = useMusicStore((state) => state.bassBoost);
  const setAudioContextNode = useMusicStore((state) => state.setAudioContextNode);

  // Audio Node Refs — persisted across renders
  const contextRef = useRef(null);
  const eqNodesRef = useRef([]);
  const bassNodeRef = useRef(null);

  // ─── FIX WA-1 + WA-3 ───────────────────────────────────────────────────────
  // Previously the function returned early inside the guard block if
  // _hasVisualizerSource was already set, leaving the audio graph disconnected
  // from destination and producing silence.
  // Also: AudioContext.resume() is now called on EVERY render where isPlaying
  // is true, not just when isPlaying changes — this handles the edge case where
  // the context is created after the first isPlaying=true event fires (autoplay
  // block scenario).
  // ────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!audioElement) return;

    if (!contextRef.current) {
      // Only create AudioContext once per audio element lifetime.
      // createMediaElementSource on the same element twice throws InvalidStateError.
      if (audioElement._hasVisualizerSource) {
        // Another hook already bound this element — do not proceed.
        return;
      }

      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      contextRef.current = ctx;

      // Mark the element so no other hook binds it again
      audioElement._hasVisualizerSource = true;

      // 1. Source Node
      const source = ctx.createMediaElementSource(audioElement);

      // 2. Bass Boost Node (LowShelf — boosts frequencies below 100Hz)
      const bassNode = ctx.createBiquadFilter();
      bassNode.type = 'lowshelf';
      bassNode.frequency.value = 100;
      bassNode.gain.value = 0;
      bassNodeRef.current = bassNode;

      // 3. 10-Band Parametric EQ Nodes (Peaking filters)
      const eqNodes = EQ_FREQUENCIES.map(freq => {
        const node = ctx.createBiquadFilter();
        node.type = 'peaking';
        node.frequency.value = freq;
        node.Q.value = 1.4;
        node.gain.value = 0;
        return node;
      });
      eqNodesRef.current = eqNodes;

      // 4. Analyser Node — shared with Visualizer via musicStore
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.85;

      // 5. Crossfade Master Gain Node (Phase 5)
      const crossfadeNode = ctx.createGain();
      crossfadeNode.gain.value = 1;

      // ── Connect the full graph ──────────────────────────────────────────────
      // Source → Bass → EQ[0..9] → Crossfade → Analyser → Destination
      // All nodes are chained; none float disconnected.
      source.connect(bassNode);

      let prevNode = bassNode;
      eqNodes.forEach(node => {
        prevNode.connect(node);
        prevNode = node;
      });

      // FIX WA-1 & Phase 5: Chain through analyser THEN crossfadeNode
      // Connecting analyser first ensures the visualizer NEVER disappears, 
      // even if the crossfade gain is stuck at 0 during a rapid pause/play.
      prevNode.connect(analyser);
      analyser.connect(crossfadeNode);
      crossfadeNode.connect(ctx.destination);

      // Publish analyser to store so Visualizer can consume it, and crossfade for transitions
      setAudioContextNode(ctx, analyser, crossfadeNode);
    }

    // FIX WA-3: Resume on every render where isPlaying is true — catches the
    // case where context was suspended before isPlaying changed to true.
    if (contextRef.current && contextRef.current.state === 'suspended' && isPlaying) {
      contextRef.current.resume();
    }

  }, [audioElement, setAudioContextNode, isPlaying]);

  // ─── FIX WA-2 ───────────────────────────────────────────────────────────────
  // Guard with contextRef.current check before calling setTargetAtTime.
  // Without this, any slider change before the audio element is set causes a
  // TypeError: Cannot read properties of null (reading 'currentTime').
  // ────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!contextRef.current || eqNodesRef.current.length !== 10) return;
    eqBands.forEach((gain, index) => {
      if (eqNodesRef.current[index]) {
        eqNodesRef.current[index].gain.setTargetAtTime(
          gain,
          contextRef.current.currentTime,
          0.05 // Faster ramp for more responsive slider feel
        );
      }
    });
  }, [eqBands]);

  useEffect(() => {
    if (!contextRef.current || !bassNodeRef.current) return;
    bassNodeRef.current.gain.setTargetAtTime(
      bassBoost,
      contextRef.current.currentTime,
      0.05
    );
  }, [bassBoost]);

  // FIX C-4: Removed empty virtualizer useEffect — it subscribed to state
  // changes and did nothing, causing unnecessary React diffing on every slider
  // move. The virtualizer slider remains in the UI for future HRTF implementation.

  return { audioContext: contextRef.current };
};

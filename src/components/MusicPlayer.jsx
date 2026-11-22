import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FiPlay, FiPause, FiVolume2, FiVolumeX, FiMusic, FiChevronDown } from 'react-icons/fi';

const TRACK_URL = 'https://pub-96832f03552d4052a99f7d048440437e.r2.dev/ClawdLobstermoney.mp3';
const TRACK_TITLE = 'Clawd — Lobster Money';
const TRACK_ARTIST = 'Train2Earn Radio';

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function MusicPlayer() {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [muted, setMuted] = useState(false);
  const [minimized, setMinimized] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    const onLoaded = () => { setDuration(audio.duration || 0); setReady(true); };
    const onTime = () => setCurrentTime(audio.currentTime || 0);
    const onEnd = () => setIsPlaying(false);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnd);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnd);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = muted ? 0 : volume;
  }, [volume, muted]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => setIsPlaying(false));
    } else {
      audio.pause();
    }
  }, []);

  const onSeek = (e) => {
    const audio = audioRef.current;
    if (!audio) return;
    const value = Number(e.target.value);
    audio.currentTime = value;
    setCurrentTime(value);
  };

  const progress = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`music-player ${minimized ? 'is-minimized' : ''}`} role="region" aria-label="Music player">
      <audio ref={audioRef} src={TRACK_URL} preload="metadata" />

      {minimized ? (
        <button
          type="button"
          className="music-fab"
          onClick={() => setMinimized(false)}
          aria-label="Open music player"
        >
          <span className={`eq ${isPlaying ? 'is-active' : ''}`}><i /><i /><i /><i /></span>
          <FiMusic />
        </button>
      ) : (
        <div className="music-panel">
          <div className="music-head">
            <span className={`eq ${isPlaying ? 'is-active' : ''}`}><i /><i /><i /><i /></span>
            <div className="music-meta">
              <strong>{TRACK_TITLE}</strong>
              <span>{TRACK_ARTIST}</span>
            </div>
            <button
              type="button"
              className="music-min"
              onClick={() => setMinimized(true)}
              aria-label="Minimize player"
            >
              <FiChevronDown />
            </button>
          </div>

          <div className="music-controls">
            <button
              type="button"
              className="music-play"
              onClick={togglePlay}
              disabled={!ready}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <FiPause /> : <FiPlay />}
            </button>

            <div className="music-progress">
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={currentTime}
                onChange={onSeek}
                aria-label="Seek"
                style={{ '--played': `${progress}%` }}
              />
              <div className="music-time">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            <div className="music-volume">
              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                aria-label={muted ? 'Unmute' : 'Mute'}
              >
                {muted || volume === 0 ? <FiVolumeX /> : <FiVolume2 />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={muted ? 0 : volume}
                onChange={(e) => { setVolume(Number(e.target.value)); setMuted(false); }}
                aria-label="Volume"
                style={{ '--played': `${(muted ? 0 : volume) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

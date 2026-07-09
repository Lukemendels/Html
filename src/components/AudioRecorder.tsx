/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Monitor,
  VolumeX,
  PlayCircle,
  Pause,
  Square,
  XCircle,
  Settings,
  HelpCircle,
  Clock,
  AudioLines,
} from 'lucide-react';
import { DbRecording, saveRecordingToDb } from '../utils/indexedDb';
import {
  getSupportedMimeType,
  isSystemAudioSupported,
  formatDuration,
} from '../utils/audioHelpers';
import AudioVisualizer from './AudioVisualizer';

interface AudioRecorderProps {
  onRecordingComplete: () => void;
}

export default function AudioRecorder({
  onRecordingComplete,
}: AudioRecorderProps) {
  const [sourceMode, setSourceMode] = useState<'mic' | 'system' | 'both'>('mic');
  const [recordingName, setRecordingName] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [duration, setDuration] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Web Audio Context & Node Refs
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);

  // Media Stream Refs (to stop tracks cleanly on finish/cancel)
  const micStreamRef = useRef<MediaStream | null>(null);
  const systemStreamRef = useRef<MediaStream | null>(null);

  // Format check
  const { mimeType, extension } = getSupportedMimeType();

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      stopAllTracks();
    };
  }, []);

  const stopAllTracks = () => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
    if (systemStreamRef.current) {
      systemStreamRef.current.getTracks().forEach((track) => track.stop());
      systemStreamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
  };

  const startTimer = () => {
    setDuration(0);
    timerIntervalRef.current = window.setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
  };

  const pauseTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  const resumeTimer = () => {
    timerIntervalRef.current = window.setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
  };

  const handleStartRecording = async () => {
    setErrorMessage(null);
    chunksRef.current = [];

    try {
      let combinedStream: MediaStream;
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioCtxRef.current = audioCtx;

      let micStream: MediaStream | null = null;
      let systemStream: MediaStream | null = null;

      const dest = audioCtx.createMediaStreamDestination();
      const analyserNode = audioCtx.createAnalyser();
      analyserNode.fftSize = 512;
      setAnalyser(analyserNode);

      // 1. Microphone capture
      if (sourceMode === 'mic' || sourceMode === 'both') {
        try {
          micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          micStreamRef.current = micStream;
          const micSource = audioCtx.createMediaStreamSource(micStream);
          micSource.connect(dest);
          micSource.connect(analyserNode);
        } catch (err) {
          throw new Error('Microphone access denied. Please grant microphone permissions and try again.');
        }
      }

      // 2. System Audio (Display Media Capture)
      if (sourceMode === 'system' || sourceMode === 'both') {
        if (!isSystemAudioSupported()) {
          throw new Error('System audio capturing is not supported on this browser/platform.');
        }

        try {
          systemStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              width: 1,
              height: 1,
              frameRate: 1,
            },
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
            },
          });
          systemStreamRef.current = systemStream;

          const systemTrack = systemStream.getAudioTracks()[0];
          if (!systemTrack) {
            // Stop whatever stream we grabbed
            systemStream.getTracks().forEach((track) => track.stop());
            throw new Error(
              "No system audio track detected. When choosing screen/tab, you MUST check the 'Share audio' or 'Also share tab audio' checkbox at the bottom left of the browser window."
            );
          }

          // Listen to when user clicks "Stop Sharing" on Chrome's native bar
          systemTrack.addEventListener('ended', () => {
            handleStopRecordingGracefully();
          });

          const systemSource = audioCtx.createMediaStreamSource(new MediaStream([systemTrack]));
          systemSource.connect(dest);
          systemSource.connect(analyserNode);
        } catch (err: any) {
          // If we had a mic stream active, shut it down
          if (micStream) micStream.getTracks().forEach((t) => t.stop());

          if (err.name === 'NotAllowedError') {
            throw new Error('System audio sharing was cancelled or denied.');
          }
          throw new Error(err.message || 'Failed to capture system audio.');
        }
      }

      // 3. Setup Media Recorder
      // We record from our AudioContext mixed destination stream!
      const recordingStream = dest.stream;
      
      const recorder = new MediaRecorder(recordingStream, {
        mimeType: mimeType || undefined,
      });

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const finalChunks = chunksRef.current;
        if (finalChunks.length === 0) return;

        const blob = new Blob(finalChunks, { type: mimeType });
        const finalDuration = duration;

        // Generate beautiful title
        const timeString = new Date().toLocaleTimeString(undefined, {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
        const dateString = new Date().toLocaleDateString(undefined, {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).replace(/\//g, '-');

        const defaultName = `Audio Recording [${dateString} ${timeString}]`;
        const finalName = recordingName.trim() || defaultName;

        const recordMetadata: DbRecording = {
          id: crypto.randomUUID(),
          name: finalName,
          timestamp: Date.now(),
          duration: finalDuration,
          blob: blob,
          format: extension,
          source: sourceMode,
          fileSize: blob.size,
        };

        try {
          // Save locally to IndexedDB first
          await saveRecordingToDb(recordMetadata);

          onRecordingComplete();
        } catch (dbErr) {
          console.error('Database save failed:', dbErr);
          setErrorMessage('Failed to save recording metadata to local storage.');
        }

        // Clean up
        stopAllTracks();
        setAnalyser(null);
        setIsRecording(false);
        setIsPaused(false);
        setDuration(0);
      };

      // Start recording chunks
      recorder.start(1000); // chunk every second
      setIsRecording(true);
      setIsPaused(false);
      startTimer();
    } catch (err: any) {
      console.error('Recording initialization failed:', err);
      setErrorMessage(err.message || 'An unexpected error occurred when initializing audio capture.');
      stopAllTracks();
    }
  };

  const handleStopRecordingGracefully = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      pauseTimer();
    }
  };

  const handlePauseToggle = () => {
    if (!mediaRecorderRef.current) return;

    if (isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      resumeTimer();
    } else {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      pauseTimer();
    }
  };

  const handleCancelRecording = () => {
    if (!confirm('Are you sure you want to discard the current active recording? This action cannot be undone.')) return;
    
    pauseTimer();
    stopAllTracks();
    setAnalyser(null);
    setIsRecording(false);
    setIsPaused(false);
    setDuration(0);
    chunksRef.current = [];
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col gap-6" id="recorder-engine-container">
      {/* Title */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${isRecording ? 'bg-rose-50 text-rose-600 animate-pulse' : 'bg-slate-50 text-slate-700'}`}>
            <AudioLines className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">System & Mic Privacy Recorder</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Secure local voice capture using WebM (Opus) compression — 100% private, client-side only.
            </p>
          </div>
        </div>

        {/* Encoding Badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full text-xs font-semibold">
          <Settings className="w-3.5 h-3.5" />
          Opus Audio Compressed
        </div>
      </div>

      {/* Input Source Choice */}
      {!isRecording && (
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
            Select Recording Capture Source
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Mic Button */}
            <button
              onClick={() => setSourceMode('mic')}
              className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 text-center transition-all ${
                sourceMode === 'mic'
                  ? 'bg-indigo-50 border-indigo-500 text-indigo-900 shadow-sm'
                  : 'bg-slate-50/50 hover:bg-slate-50 border-slate-200/60 text-slate-600 hover:text-slate-900'
              }`}
            >
              <Mic className={`w-6 h-6 ${sourceMode === 'mic' ? 'text-indigo-600' : 'text-slate-400'}`} />
              <div>
                <span className="text-xs font-bold block">Microphone Only</span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Record vocal notes or physical meetings</span>
              </div>
            </button>

            {/* System Audio Button */}
            <button
              onClick={() => setSourceMode('system')}
              className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 text-center transition-all ${
                sourceMode === 'system'
                  ? 'bg-indigo-50 border-indigo-500 text-indigo-900 shadow-sm'
                  : 'bg-slate-50/50 hover:bg-slate-50 border-slate-200/60 text-slate-600 hover:text-slate-900'
              }`}
            >
              <Monitor className={`w-6 h-6 ${sourceMode === 'system' ? 'text-indigo-600' : 'text-slate-400'}`} />
              <div>
                <span className="text-xs font-bold block">System Audio Only</span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Record screen audio, video players, or calls</span>
              </div>
            </button>

            {/* Dual Mixing Button */}
            <button
              onClick={() => setSourceMode('both')}
              className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 text-center transition-all ${
                sourceMode === 'both'
                  ? 'bg-indigo-50 border-indigo-500 text-indigo-900 shadow-sm'
                  : 'bg-slate-50/50 hover:bg-slate-50 border-slate-200/60 text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-1">
                <Mic className={`w-4 h-4 ${sourceMode === 'both' ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span className="text-slate-300 font-normal">+</span>
                <Monitor className={`w-4 h-4 ${sourceMode === 'both' ? 'text-indigo-600' : 'text-slate-400'}`} />
              </div>
              <div>
                <span className="text-xs font-bold block">Dual Source Mixer</span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Mix system audio and microphone stream</span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Recording Parameters / Optional Name input */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
          Recording Title / Prefix
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder={isRecording ? 'Naming locked while active...' : 'Optional custom name (e.g. Design Sync Walkthrough)'}
            value={recordingName}
            onChange={(e) => setRecordingName(e.target.value)}
            disabled={isRecording}
            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:bg-slate-100 disabled:text-slate-400"
          />
        </div>
      </div>

      {/* Live Waveform Visualizer */}
      <AudioVisualizer analyserNode={analyser} isRecording={isRecording} isPaused={isPaused} />

      {/* Control Console */}
      <div className="flex flex-col gap-4">
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 flex items-start gap-2.5 text-xs text-rose-700">
            <VolumeX className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-semibold">Error:</span> {errorMessage}
            </div>
          </div>
        )}

        {/* Buttons / Controls Panel */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50 border border-slate-200/40 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isRecording ? 'bg-rose-100 text-rose-600 animate-pulse' : 'bg-slate-200 text-slate-500'}`}>
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Duration</span>
              <span className="text-lg font-bold font-mono text-slate-800">{formatDuration(duration)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            {!isRecording ? (
              <button
                onClick={handleStartRecording}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs tracking-wider uppercase shadow-md hover:shadow-lg rounded-xl transition-all hover:scale-[1.02] active:scale-95"
              >
                <PlayCircle className="w-4 h-4 fill-white text-indigo-600" />
                Start Recording
              </button>
            ) : (
              <>
                <button
                  onClick={handleCancelRecording}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200/60 hover:border-rose-100 rounded-xl text-xs font-semibold transition-all"
                  title="Discard this recording completely"
                >
                  <XCircle className="w-4 h-4" />
                  Discard
                </button>

                <button
                  onClick={handlePauseToggle}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-200/60 hover:bg-slate-200 text-slate-700 border border-slate-300/40 rounded-xl text-xs font-semibold transition-all"
                >
                  <Pause className="w-4 h-4" />
                  {isPaused ? 'Resume' : 'Pause'}
                </button>

                <button
                  onClick={handleStopRecordingGracefully}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs tracking-wider uppercase shadow-md hover:shadow-lg rounded-xl transition-all"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  Save & Finish
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Guide section */}
      {sourceMode !== 'mic' && !isRecording && (
        <div className="bg-indigo-50/40 border border-indigo-100/60 rounded-xl p-3.5 text-[11px] text-indigo-800 leading-relaxed">
          <h4 className="font-semibold flex items-center gap-1.5 mb-1 text-xs">
            <HelpCircle className="w-3.5 h-3.5 text-indigo-500" /> Instructions for System Audio Recording:
          </h4>
          When you click <strong className="text-indigo-900">"Start Recording"</strong>, a browser popup will appear. Under any tab or window, select the one you want to record, and <strong className="text-indigo-900">MUST check the "Share audio" checkbox</strong> at the bottom left before clicking "Share". This allows the browser to pipe the system audio directly.
        </div>
      )}
    </div>
  );
}

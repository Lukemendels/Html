/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, ChangeEvent } from 'react';
import {
  FolderOpen,
  Volume2,
  Trash2,
  Play,
  Pause,
  Download,
  FileAudio,
  Folder,
  Check,
  RefreshCw,
  AlertCircle,
  FileCheck,
} from 'lucide-react';
import {
  DbRecording,
  getAllRecordingsFromDb,
  deleteRecordingFromDb,
  getSetting,
  saveSetting,
  removeSetting,
} from '../utils/indexedDb';
import {
  formatDuration,
  formatFileSize,
  audioBufferToWav,
  decodeAudioBlob,
  isFileSystemAccessSupported,
} from '../utils/audioHelpers';

interface PastRecordingsProps {
  refreshTrigger: number;
  onSetFolderHandle: (handle: any) => void;
  folderHandle: any;
}

export default function PastRecordings({
  refreshTrigger,
  onSetFolderHandle,
  folderHandle,
}: PastRecordingsProps) {
  const [recordings, setRecordings] = useState<DbRecording[]>([]);
  const [isConvertingId, setIsConvertingId] = useState<string | null>(null);
  const [conversionProgress, setConversionProgress] = useState<string>('');
  const [activePlayId, setActivePlayId] = useState<string | null>(null);
  const [playbackTime, setPlaybackTime] = useState<number>(0);
  const [playbackDuration, setPlaybackDuration] = useState<number>(0);

  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [folderPermission, setFolderPermission] = useState<'granted' | 'prompt' | 'denied'>('prompt');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressIntervalRef = useRef<number | null>(null);

  // Load recordings and folder handle on mount and when refreshTrigger changes
  useEffect(() => {
    loadRecordings();
    loadFolderHandle();
  }, [refreshTrigger]);

  const loadRecordings = async () => {
    try {
      const data = await getAllRecordingsFromDb();
      setRecordings(data);
    } catch (err) {
      console.error('Error loading recordings:', err);
    }
  };

  const loadFolderHandle = async () => {
    if (!isFileSystemAccessSupported()) return;
    try {
      const savedHandle = await getSetting<any>('directoryHandle');
      if (savedHandle) {
        setDirHandle(savedHandle);
        onSetFolderHandle(savedHandle);
        const status = await savedHandle.queryPermission({ mode: 'readwrite' });
        setFolderPermission(status);
      }
    } catch (err) {
      console.error('Failed to load directory handle from database:', err);
    }
  };

  const handleSelectFolder = async () => {
    if (!isFileSystemAccessSupported()) {
      alert('The File System Access API is not supported in this browser. Please use Chrome, Edge, or Opera.');
      return;
    }
    try {
      const handle = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
      });
      setDirHandle(handle);
      onSetFolderHandle(handle);
      setFolderPermission('granted');
      await saveSetting('directoryHandle', handle);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Directory picking failed:', err);
      }
    }
  };

  const handleRequestFolderPermission = async () => {
    if (!dirHandle) return;
    try {
      const status = await dirHandle.requestPermission({ mode: 'readwrite' });
      setFolderPermission(status);
    } catch (err) {
      console.error('Failed to request directory write permission:', err);
    }
  };

  const handleDisconnectFolder = async () => {
    try {
      await removeSetting('directoryHandle');
      setDirHandle(null);
      onSetFolderHandle(null);
      setFolderPermission('prompt');
    } catch (err) {
      console.error('Failed to disconnect directory:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this recording from internal storage?')) return;
    try {
      if (activePlayId === id) {
        handleStopPlayback();
      }
      await deleteRecordingFromDb(id);
      await loadRecordings();
    } catch (err) {
      console.error('Failed to delete recording:', err);
    }
  };

  // WAV Converter
  const handleExportWav = async (recording: DbRecording) => {
    try {
      setIsConvertingId(recording.id);
      setConversionProgress('1. Extracting audio payload...');

      // Decode on client side safely
      const audioBuffer = await decodeAudioBlob(recording.blob);

      setConversionProgress('2. Encoding high-fidelity 16-bit WAV...');
      const wavBlob = audioBufferToWav(audioBuffer);

      setConversionProgress('3. Triggering download...');
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${recording.name}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setIsConvertingId(null);
      setConversionProgress('');
    } catch (err) {
      console.error('WAV conversion failed:', err);
      alert('WAV conversion failed. The recording may be corrupted or unsupported.');
      setIsConvertingId(null);
      setConversionProgress('');
    }
  };

  const handleExportOriginal = (recording: DbRecording) => {
    const url = URL.createObjectURL(recording.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${recording.name}.${recording.format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Playback Engine
  const handlePlayToggle = (recording: DbRecording) => {
    if (activePlayId === recording.id) {
      if (audioRef.current?.paused) {
        audioRef.current.play();
      } else {
        audioRef.current?.pause();
      }
      return;
    }

    // Stop current play if any
    handleStopPlayback();

    const url = URL.createObjectURL(recording.blob);
    const audio = new Audio(url);
    audioRef.current = audio;
    setActivePlayId(recording.id);

    audio.addEventListener('loadedmetadata', () => {
      setPlaybackDuration(audio.duration || recording.duration);
    });

    audio.addEventListener('ended', () => {
      handleStopPlayback();
    });

    audio.play();

    progressIntervalRef.current = window.setInterval(() => {
      if (audioRef.current) {
        setPlaybackTime(audioRef.current.currentTime);
      }
    }, 100);
  };

  const handleStopPlayback = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setActivePlayId(null);
    setPlaybackTime(0);
  };

  const handleScrub = (e: ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
      setPlaybackTime(val);
    }
  };

  const triggerExportToLocalFolderOnTheFly = async (recording: DbRecording, extension: 'webm' | 'wav') => {
    if (!dirHandle || folderPermission !== 'granted') return;
    try {
      let fileBlob = recording.blob;
      let filename = `${recording.name}.${recording.format}`;

      if (extension === 'wav') {
        setIsConvertingId(recording.id);
        setConversionProgress('Encoding WAV for Sync Folder...');
        const audioBuffer = await decodeAudioBlob(recording.blob);
        fileBlob = audioBufferToWav(audioBuffer);
        filename = `${recording.name}.wav`;
      }

      const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(fileBlob);
      await writable.close();

      alert(`Successfully saved "${filename}" directly into your local folder!`);
      setIsConvertingId(null);
      setConversionProgress('');
    } catch (error) {
      console.error('Failed to write directly to directory:', error);
      alert('Failed to write to folder. Please make sure permissions are granted.');
      setIsConvertingId(null);
      setConversionProgress('');
    }
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col gap-6" id="recordings-panel">
      {/* Directory Sync Access Bar */}
      <div className="bg-slate-50 border border-slate-200/50 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-xl ${dirHandle ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
            <Folder className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
              Local Desktop Folder Sync
              {dirHandle && folderPermission === 'granted' && (
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-[10px] font-medium">
                  <Check className="w-2.5 h-2.5" /> Active
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {dirHandle
                ? `Syncing files directly with directory: "${dirHandle.name}"`
                : 'Connect a local folder to auto-export finished recordings directly to your computer.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          {dirHandle ? (
            <>
              {folderPermission === 'prompt' && (
                <button
                  onClick={handleRequestFolderPermission}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-medium transition-all"
                >
                  <AlertCircle className="w-3.5 h-3.5 animate-bounce" />
                  Grant Read/Write
                </button>
              )}
              <button
                onClick={handleDisconnectFolder}
                className="flex-1 sm:flex-initial text-center px-3 py-2 bg-slate-200/60 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-all"
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              onClick={handleSelectFolder}
              className="flex-1 sm:flex-auto flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow rounded-lg text-xs font-medium transition-all"
            >
              <FolderOpen className="w-4 h-4" />
              Choose Local Folder
            </button>
          )}
        </div>
      </div>

      {/* Recordings Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-indigo-500" />
          Past Local Recordings
          <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full font-normal">
            {recordings.length} total
          </span>
        </h2>
        <button
          onClick={loadRecordings}
          className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-slate-600 transition-all"
          title="Refresh recordings list"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Record List */}
      {recordings.length === 0 ? (
        <div className="text-center py-10 bg-slate-50/40 border border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center gap-3">
          <div className="p-3 bg-slate-100 text-slate-400 rounded-full">
            <FileAudio className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium text-slate-500">No recordings saved in database yet</p>
          <p className="text-xs text-slate-400 max-w-sm">
            Press the record button above to start your first session. Your files remain entirely private inside this browser instance.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 max-h-[500px] overflow-y-auto pr-1">
          {recordings.map((rec) => {
            const isPlaying = activePlayId === rec.id;
            const isConverting = isConvertingId === rec.id;
            const formattedDate = new Date(rec.timestamp).toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={rec.id}
                className={`border rounded-xl p-4 transition-all flex flex-col gap-3 ${
                  isPlaying ? 'bg-indigo-50/40 border-indigo-200' : 'bg-white border-slate-200/80 hover:border-slate-300'
                }`}
              >
                {/* Info and action row */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => handlePlayToggle(rec)}
                      className={`p-3 rounded-full flex-shrink-0 transition-all ${
                        isPlaying ? 'bg-indigo-600 text-white shadow-md scale-105' : 'bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600'
                      }`}
                    >
                      {isPlaying && !audioRef.current?.paused ? (
                        <Pause className="w-4 h-4 fill-current" />
                      ) : (
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      )}
                    </button>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800 line-clamp-1">{rec.name}</h4>
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-400 mt-1">
                        <span>{formattedDate}</span>
                        <span className="w-1 h-1 bg-slate-300 rounded-full" />
                        <span className="font-mono text-[11px] bg-slate-50 px-1.5 py-0.5 border border-slate-200/40 rounded uppercase text-slate-500">
                          {rec.source}
                        </span>
                        <span className="w-1 h-1 bg-slate-300 rounded-full" />
                        <span>{formatDuration(rec.duration)}</span>
                        <span className="w-1 h-1 bg-slate-300 rounded-full" />
                        <span>{formatFileSize(rec.fileSize)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions right side */}
                  <div className="flex items-center gap-1.5 self-end sm:self-center">
                    {/* Folder Sync Export On-Demand if directory picked */}
                    {dirHandle && folderPermission === 'granted' && (
                      <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
                        <span className="text-[10px] font-semibold text-slate-400 bg-slate-50 px-2 py-1 border-r border-slate-200 flex items-center gap-1">
                          <Folder className="w-3 h-3 text-indigo-400" /> SYNC TO FOLDER:
                        </span>
                        <button
                          onClick={() => triggerExportToLocalFolderOnTheFly(rec, 'webm')}
                          className="px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 transition-all"
                          title="Save native WebM/MP4 directly to synced folder"
                          disabled={isConverting}
                        >
                          {rec.format.toUpperCase()}
                        </button>
                        <button
                          onClick={() => triggerExportToLocalFolderOnTheFly(rec, 'wav')}
                          className="px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 border-l border-slate-200 transition-all"
                          title="Convert to WAV and save directly to synced folder"
                          disabled={isConverting}
                        >
                          WAV
                        </button>
                      </div>
                    )}

                    <button
                      onClick={() => handleExportOriginal(rec)}
                      className="p-2 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg text-xs font-medium border border-slate-200/50 flex items-center gap-1 bg-white shadow-sm"
                      title={`Download original ${rec.format.toUpperCase()} file`}
                      disabled={isConverting}
                    >
                      <Download className="w-3.5 h-3.5 text-slate-400" />
                      Original
                    </button>

                    <button
                      onClick={() => handleExportWav(rec)}
                      className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-medium border border-indigo-100/40 flex items-center gap-1 shadow-sm"
                      title="Convert to standard uncompressed 16-bit WAV"
                      disabled={isConverting}
                    >
                      <FileAudio className="w-3.5 h-3.5 text-indigo-400" />
                      WAV
                    </button>

                    <button
                      onClick={() => handleDelete(rec.id)}
                      className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg border border-transparent hover:border-rose-100"
                      title="Delete recording from database"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Loading / Progress Indicator for WAV Conversion */}
                {isConverting && (
                  <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-2.5 flex items-center gap-3 mt-1 text-xs text-indigo-700">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                    <span className="font-medium animate-pulse">{conversionProgress}</span>
                  </div>
                )}

                {/* Interactive scrub player if playing */}
                {isPlaying && (
                  <div className="mt-1 bg-indigo-50/50 rounded-xl p-3 border border-indigo-100/40 flex items-center gap-3">
                    <span className="text-[10px] font-mono text-indigo-600 w-10 text-right">
                      {formatDuration(playbackTime)}
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={playbackDuration || 0.1}
                      step={0.1}
                      value={playbackTime}
                      onChange={handleScrub}
                      className="flex-1 h-1.5 bg-indigo-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                    <span className="text-[10px] font-mono text-indigo-600 w-10">
                      {formatDuration(playbackDuration)}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

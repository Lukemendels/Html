/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { ShieldCheck, HardDrive, Cpu, HelpCircle, FileCheck } from 'lucide-react';
import AudioRecorder from './components/AudioRecorder';
import PastRecordings from './components/PastRecordings';
import PromptDownloader from './components/PromptDownloader';

export default function App() {
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [folderHandle, setFolderHandle] = useState<any>(null);

  const handleRecordingComplete = () => {
    // Increment trigger to notify PastRecordings to load new records from IndexedDB
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-800 flex flex-col font-sans selection:bg-indigo-100" id="app-root-container">
      {/* Top Professional Header */}
      <header className="bg-white border-b border-slate-200/60 sticky top-0 z-50 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-tr from-indigo-600 to-teal-500 rounded-xl flex items-center justify-center text-white shadow-sm">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-slate-900 text-sm tracking-tight block leading-none">Privacy Audio Suite</span>
              <span className="text-[10px] text-slate-400 font-mono mt-1 block">LOCAL-ONLY / OFFLINE SECURE</span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full font-semibold">
              <Cpu className="w-3.5 h-3.5" />
              Pure Browser Sandbox
            </div>
          </div>
        </div>
      </header>

      {/* Main Single-View Dashboard Layout */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">
        
        {/* Core Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Recorder Panel - Left Col (larger span on wide screens) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <AudioRecorder 
              onRecordingComplete={handleRecordingComplete} 
              folderHandle={folderHandle}
            />
            
            {/* Embedded Info Panel for security and workflow transparency */}
            <div className="bg-slate-100/60 border border-slate-200/50 rounded-2xl p-5 flex flex-col gap-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Zero-Cloud Privacy Guarantee
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                This recording application is built entirely inside your browser's execution context. All audio mixing, level meter analysis, compression encoding (WebM with Opus), and local folder writing happen **strictly on your CPU**.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                <div className="bg-white p-3 rounded-xl border border-slate-200/40 text-[11px] text-slate-600">
                  <strong className="text-slate-800 block mb-0.5">📁 Local File Access</strong>
                  Requires folder permission to write completed WebM/WAV files directly to your local file tree.
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200/40 text-[11px] text-slate-600">
                  <strong className="text-slate-800 block mb-0.5">💾 Browser Sandbox</strong>
                  Uses client-side IndexedDB database. Records remain securely saved even if you close the tab.
                </div>
              </div>
            </div>
          </div>

          {/* Recordings Dashboard & Prompt Downloader - Right Col */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <PastRecordings 
              refreshTrigger={refreshTrigger}
              folderHandle={folderHandle}
              onSetFolderHandle={setFolderHandle}
            />
          </div>
        </div>

        {/* Prompt Transcription Kit (Full width banner under grid) */}
        <div className="w-full">
          <PromptDownloader />
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200/60 mt-auto py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5 font-mono">
            <span>PLATFORM:</span>
            <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 border border-slate-200/40 rounded">CLIENT SPA</span>
          </div>
          <div>
            <span>© 2026 Privacy Audio Recorder. Open Source / Public Domain.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

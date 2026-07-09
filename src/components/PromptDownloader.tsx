/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { FileText, Clipboard, Check, Download, Info, Sparkles } from 'lucide-react';

type MeetingType = 'general' | 'technical' | 'interview' | 'journal';
type TranscriptStyle = 'clean' | 'strict';
type OutputFormat = 'full' | 'transcript_only';

export default function PromptDownloader() {
  const [meetingType, setMeetingType] = useState<MeetingType>('general');
  const [transcriptStyle, setTranscriptStyle] = useState<TranscriptStyle>('clean');
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('full');
  const [copied, setCopied] = useState(false);

  const getPromptText = () => {
    let customContext = '';
    if (meetingType === 'technical') {
      customContext = `- **Technical Focus**: This is a technical/coding discussion. Please ensure all programming jargon, library names, APIs, framework details, code files, and technical syntax are transcribed and spelled with high precision (e.g., camelCase, PascalCase, correct command commands).`;
    } else if (meetingType === 'interview') {
      customContext = `- **Interview Focus**: This is a qualitative interview. Pay close attention to speaker transitions, tone nuances, questions asked by the interviewer, and detailed reflections from the interviewee.`;
    } else if (meetingType === 'journal') {
      customContext = `- **Voice Journal/Note Focus**: This is a single-person stream-of-consciousness thought, brainstorm, or note. Render it as a cohesive, structured log of thoughts, correcting grammatical fragments where appropriate to make it highly legible.`;
    } else {
      customContext = `- **General Meeting Focus**: This is a business/general discussion. Identify decisions, milestones, open questions, and general project updates.`;
    }

    const verbatimRule = transcriptStyle === 'clean' 
      ? `- **Clean Verbatim**: Remove repetitive filler words, stuttering, and verbal tics (such as "um", "uh", "like", "you know", "right") to prioritize highly readable text while fully preserving the meaning and specific terms.` 
      : `- **Strict Verbatim**: Record exactly what is spoken, including all filler words ("um", "uh", "ah"), repetitions, false starts, and stutters. Do not edit, summarize, or correct grammatical errors.`;

    const layoutSection = outputFormat === 'full' 
      ? `## Required Output Structure

Your response should be structured into these distinct sections:

1. **Executive Summary**: A concise paragraph summary of the entire audio file.
2. **Metadata**:
   - Estimated Speaker Count:
   - Primary Subject Matter:
   - Tone and Dynamic:
3. **Key Decision Points & Milestones**: Bullet points of any concrete agreements, shifts, or conclusions.
4. **Action Items & Owners**: Clear task list with assigned personnel and deadlines (if discussed).
5. **Detailed Structured Transcript**: Chronological transcript divided by logical topic sections or speaker markers (e.g., **[Speaker A]**, **[Speaker B]**), with approximate markers if applicable.`
      : `## Required Output Structure

Your response should contain ONLY:

1. **Detailed Structured Transcript**: Chronological verbatim transcription divided by speaker markers (e.g., **[Speaker A]**, **[Speaker B]**). Do not add summaries, executive overviews, or action item lists.`;

    return `# Role: Expert Audio Transcription & Analysis Engine

You are a world-class, context-aware audio transcription and cognitive synthesis system. You will receive an attached audio file recorded locally. Your goal is to transcribe this audio file with absolute linguistic accuracy and, if requested, produce highly structured executive summaries and action steps.

## Core Directives

1. **Acoustic Integrity**: Listen carefully to the audio file. Pay close attention to accents, overlapping speech, soft tones, and specialized terminology.
2. **Speaker Diarization**: Even if names are not explicitly mentioned, consistently differentiate speakers by labeling them dynamically (e.g., **[Speaker 1]**, **[Speaker 2]** or by name if identified).
${verbatimRule}
${customContext}

${layoutSection}

## Guidance for Best Performance (Optional for User)
If using an LLM that supports local voice input (like Gemini 1.5 Pro / Flash in AI Studio or ChatGPT), upload this .md prompt together with the WebM or WAV recording. Since WebM/Opus is extremely compact and high fidelity, it contains all structural audio metadata necessary for perfect voice-to-text alignment.`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getPromptText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const text = getPromptText();
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcribe_instructions_${meetingType}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col gap-6" id="prompt-kit-container">
      <div className="flex items-start justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Local LLM Transcription Kit</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Generate fully customized system instructions to feed into any LLM with your recording.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-xs font-medium">
          <Info className="w-3.5 h-3.5" />
          100% Private & Local
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Toggle Controls */}
        <div className="flex flex-col gap-4 md:col-span-1">
          {/* Meeting Type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Recording Context
            </label>
            <div className="flex flex-col gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200/40">
              {(
                [
                  { id: 'general', label: 'General Discussion' },
                  { id: 'technical', label: 'Technical / Code' },
                  { id: 'interview', label: 'Qualitative Interview' },
                  { id: 'journal', label: 'Personal Voice Journal' },
                ] as const
              ).map((type) => (
                <button
                  key={type.id}
                  onClick={() => setMeetingType(type.id)}
                  className={`text-left px-3 py-2 text-xs font-medium rounded-lg transition-all ${
                    meetingType === type.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Verbatim Choice */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Transcription Style
            </label>
            <div className="grid grid-cols-2 gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200/40">
              <button
                onClick={() => setTranscriptStyle('clean')}
                className={`px-2.5 py-2 text-xs font-medium rounded-lg transition-all ${
                  transcriptStyle === 'clean'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                }`}
              >
                Clean Verbatim
              </button>
              <button
                onClick={() => setTranscriptStyle('strict')}
                className={`px-2.5 py-2 text-xs font-medium rounded-lg transition-all ${
                  transcriptStyle === 'strict'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                }`}
              >
                Strict Verbatim
              </button>
            </div>
            <p className="text-[10px] text-slate-400 px-1">
              {transcriptStyle === 'clean'
                ? 'Strips filler words ("um", "ah", stuttering) for high readability.'
                : 'Transcribes every single utterance exactly as spoken.'}
            </p>
          </div>

          {/* Output Format */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Required Analysis
            </label>
            <div className="grid grid-cols-2 gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200/40">
              <button
                onClick={() => setOutputFormat('full')}
                className={`px-2.5 py-2 text-xs font-medium rounded-lg transition-all ${
                  outputFormat === 'full'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                }`}
              >
                Summary + Action Items
              </button>
              <button
                onClick={() => setOutputFormat('transcript_only')}
                className={`px-2.5 py-2 text-xs font-medium rounded-lg transition-all ${
                  outputFormat === 'transcript_only'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                }`}
              >
                Transcript Only
              </button>
            </div>
          </div>
        </div>

        {/* Prompt Preview & Actions */}
        <div className="flex flex-col gap-3 md:col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              Generated Prompt Preview
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-lg text-xs font-medium transition-all"
                title="Copy prompt text"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Clipboard className="w-3.5 h-3.5" />
                    <span>Copy Prompt</span>
                  </>
                )}
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 rounded-lg text-xs font-medium transition-all"
                title="Download prompt as .md file"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .md</span>
              </button>
            </div>
          </div>

          <div className="relative flex-1 bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
            <pre className="p-4 text-[11px] font-mono text-slate-300 h-64 overflow-y-auto leading-relaxed select-all">
              {getPromptText()}
            </pre>
            <div className="absolute bottom-2 right-2 bg-slate-900/90 text-slate-400 text-[9px] px-2 py-0.5 rounded border border-slate-800 pointer-events-none">
              Markdown Format
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

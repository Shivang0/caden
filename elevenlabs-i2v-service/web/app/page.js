'use client';
import { useEffect, useRef, useState } from 'react';

const STATUS_TEXT = {
  queued: 'In queue',
  processing: 'Generating your video…',
  done: 'Done',
  failed: 'Failed',
};

export default function Home() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [drag, setDrag] = useState(false);
  const [job, setJob] = useState(null);      // {id,status,position,outputUrl,error}
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  function chooseFile(f) {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setError(null);
  }

  async function submit() {
    if (!file || !prompt.trim()) { setError('Add an image and a prompt.'); return; }
    setSubmitting(true); setError(null); setJob(null);
    try {
      const fd = new FormData();
      fd.append('image', file);
      fd.append('prompt', prompt.trim());
      const r = await fetch('/api/jobs', { method: 'POST', body: fd });
      const data = await r.json();
      if (!r.ok) { setError(data.error || 'Something went wrong.'); setSubmitting(false); return; }
      setJob({ id: data.id, status: 'queued', position: null });
    } catch (e) {
      setError('Network error — try again.');
      setSubmitting(false);
    }
  }

  // Poll job status.
  useEffect(() => {
    if (!job?.id || job.status === 'done' || job.status === 'failed') return;
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`/api/jobs/${job.id}`);
        const d = await r.json();
        if (r.ok) setJob(d);
        if (d.status === 'done' || d.status === 'failed') setSubmitting(false);
      } catch {}
    }, 3000);
    return () => clearInterval(pollRef.current);
  }, [job?.id, job?.status]);

  function reset() {
    setJob(null); setSubmitting(false); setError(null);
  }

  const busy = job && (job.status === 'queued' || job.status === 'processing');

  return (
    <main className="wrap">
      <h1>Image → Video</h1>
      <p className="sub">Upload a still, describe the motion, and a laptop in the corner renders it for you.</p>

      <div className="card">
        <label>Start frame</label>
        <div
          className={'drop' + (drag ? ' drag' : '')}
          onClick={() => document.getElementById('file').click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); chooseFile(e.dataTransfer.files[0]); }}
        >
          {preview
            ? <img src={preview} alt="preview" />
            : <div className="hint">Click or drop an image (jpg, png, webp — max 4 MB)</div>}
        </div>
        <input id="file" type="file" accept="image/jpeg,image/png,image/webp,image/heic"
          style={{ display: 'none' }} onChange={(e) => chooseFile(e.target.files[0])} />

        <label>Prompt (describe the motion)</label>
        <textarea value={prompt} maxLength={500}
          placeholder="e.g. slow cinematic push-in, gentle wind, volumetric light"
          onChange={(e) => setPrompt(e.target.value)} />

        {!busy && (
          <button className="primary" onClick={submit} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Generate video'}
          </button>
        )}

        {error && <div className="error">{error}</div>}

        {job && (
          <div className="status">
            {busy && (
              <div className="pill">
                <span className="spinner" />
                {job.status === 'queued'
                  ? (job.position ? `In queue — #${job.position}` : 'In queue…')
                  : STATUS_TEXT.processing}
              </div>
            )}
            {job.status === 'failed' && (
              <>
                <div className="error">Failed: {job.error || 'unknown error'}</div>
                <button className="primary" onClick={reset} style={{ marginTop: 12 }}>Try again</button>
              </>
            )}
            {job.status === 'done' && job.outputUrl && (
              <>
                <video src={job.outputUrl} controls autoPlay loop muted playsInline />
                <div>
                  <a className="dl" href={job.outputUrl} download>Download MP4 ↓</a>
                </div>
                <button className="primary" onClick={reset} style={{ marginTop: 12 }}>Make another</button>
              </>
            )}
          </div>
        )}
      </div>

      <p className="footnote">One at a time · runs on a real ElevenLabs Creator account · be kind to the credits 🙏</p>
    </main>
  );
}

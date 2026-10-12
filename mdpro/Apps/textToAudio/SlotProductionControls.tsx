import React, { useEffect, useRef, useState } from 'react';
import { generateLyriaMusic, generateVeoVideo, scheduleMusic } from './productionAudio';

export default function SlotProductionControls({ slot, updateSlot, apiKey, audioContextRef, toWav, isDarkMode, onUploadBackground, onGenerateVideo, isVideoGenerating, activeTab }) {
  const [musicBusy, setMusicBusy] = useState(false);
  const [veoBusy, setVeoBusy] = useState(false);
  const [musicStatus, setMusicStatus] = useState('');
  const [videoStatus, setVideoStatus] = useState('');
  const [preview, setPreview] = useState(null);
  const musicRequest = useRef(null), videoRequest = useRef(null);
  useEffect(() => () => { musicRequest.current?.abort(); videoRequest.current?.abort(); }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const set = patch => updateSlot(slot.id, patch);
  const duration = slot.musicDuration ?? slot.audioBuffer?.duration ?? 30;
  const number = (key, label, fallback, max = 600) => <label className="tts-production-field">
    {label}<input type="number" min="0" max={max} step="0.1" value={slot[key] ?? fallback}
      onChange={e => set({ [key]: Math.min(max, Math.max(0, Number(e.target.value) || 0)) })} />
  </label>;
  const volume = (key, label, fallback) => <label className="tts-production-field">
    {label} {Math.round((slot[key] ?? fallback) * 100)}%
    <input type="range" min="0" max="1" step="0.01" value={slot[key] ?? fallback} onChange={e => set({ [key]: Number(e.target.value) })} />
  </label>;
  const checkbox = (key, label, fallback) => <label><input type="checkbox" checked={slot[key] ?? fallback} onChange={e => set({ [key]: e.target.checked })} /> {label}</label>;
  const generateMusic = async () => {
    const controller = new AbortController(); musicRequest.current = controller;
    setMusicBusy(true); setMusicStatus('Lyria 연결 중…');
    try {
      const buffer = await generateLyriaMusic({ apiKey, prompt: slot.musicPrompt || '', duration, context: audioContextRef.current, signal: controller.signal,
        onProgress: seconds => setMusicStatus(`${seconds.toFixed(1)} / ${Number(duration).toFixed(1)}초 생성 중…`) });
      set({ musicBuffer: buffer, musicEnabled: true, musicDuration: duration });
      setPreview(null); setMusicStatus(`${buffer.duration.toFixed(1)}초 음악 생성 완료`);
    } catch (error) { setMusicStatus(error.name === 'AbortError' ? '음악 생성을 취소했습니다.' : error.message); }
    finally { musicRequest.current = null; setMusicBusy(false); }
  };
  const uploadMusic = async e => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    try {
      const buffer = await audioContextRef.current.decodeAudioData(await file.arrayBuffer());
      set({ musicBuffer: buffer, musicEnabled: true }); setPreview(null); setMusicStatus(`${file.name} · ${buffer.duration.toFixed(1)}초`);
    } catch { setMusicStatus('재생 가능한 오디오 파일을 선택해주세요.'); }
  };
  const previewMusic = async () => {
    try {
      const total = (slot.musicStart || 0) + duration;
      if (!(total > 0 && total <= 1200)) throw new Error('미리듣기 길이는 0초 초과, 1200초 이하로 설정해주세요.');
      const context = new OfflineAudioContext(2, Math.ceil(total * 48000), 48000);
      scheduleMusic(context, context.destination, slot.musicBuffer, { ...slot, musicDuration: duration, musicEnabled: true }, total, 0);
      const buffer = await context.startRendering();
      setPreview(URL.createObjectURL(new Blob([toWav(buffer)], { type: 'audio/wav' })));
      setMusicStatus('현재 시간·볼륨·페이드 설정을 반영한 미리듣기입니다.');
    } catch (error) { setMusicStatus(error.message); }
  };
  const generateVideo = async () => {
    const controller = new AbortController(); videoRequest.current = controller;
    setVeoBusy(true);
    try {
      const blob = await generateVeoVideo({ apiKey, model: slot.veoModel || 'veo-3.1-fast-generate-preview', prompt: slot.veoPrompt || '',
        duration: slot.veoDuration || 8, aspectRatio: slot.veoAspect || '16:9', signal: controller.signal, onProgress: setVideoStatus });
      set({ backgroundVideo: URL.createObjectURL(blob), backgroundImage: null });
      setVideoStatus('Veo 비디오를 배경에 적용했습니다. 미리보기 확인 후 MP4를 제작하세요.');
    } catch (error) { setVideoStatus(error.name === 'AbortError' ? '대기를 중단했습니다. 서버에 제출된 Veo 작업은 계속될 수 있습니다.' : error.message); }
    finally { videoRequest.current = null; setVeoBusy(false); }
  };
  return <div className={`tts-production ${isDarkMode ? 'is-dark' : ''}`}>
    <section role="tabpanel" id={`content-panel-music-${slot.id}`} aria-labelledby={`content-tab-music-${slot.id}`} hidden={activeTab !== 'music'}>
      <div className="tts-production-content">
        {checkbox('musicEnabled', 'MP4에 배경음악 사용', true)}
        <label>음악 파일 업로드<input type="file" accept="audio/*" onChange={uploadMusic} disabled={musicBusy} /></label>
        <label>음악 프롬프트<textarea rows={2} value={slot.musicPrompt || ''} onChange={e => set({ musicPrompt: e.target.value })} placeholder="예: Gentle ambient piano, warm strings, calm storytelling, instrumental" /></label>
        <p>Lyria RealTime · 지정한 길이만큼 생성합니다. 영어로 분위기와 악기를 묘사해주세요.</p>
        <div className="tts-production-grid">
          {number('musicStart', '영상에서 시작 (초)', 0)}
          {number('musicDuration', '음악 재생·생성 길이 (초)', duration)}
          {number('musicOffset', '음악 파일 시작 위치 (초)', 0)}
          {volume('musicVolume', '배경음악 볼륨', .2)}
        </div>
        <div className="tts-production-row">
          <button type="button" disabled={!slot.audioBuffer || musicBusy} onClick={() => set({ musicStart: 0, musicDuration: slot.audioBuffer.duration })}>음성 길이에 맞추기</button>
          {checkbox('musicLoop', '짧은 음악 반복', true)}
        </div>
        <div className="tts-production-grid">
          <div>{checkbox('musicFadeInEnabled', '페이드 인', true)}{number('musicFadeIn', '페이드 인 시간 (초)', 1)}</div>
          <div>{checkbox('musicFadeOutEnabled', '페이드 아웃', true)}{number('musicFadeOut', '페이드 아웃 시간 (초)', 1)}</div>
        </div>
        <div className="tts-production-row">
          <button type="button" disabled={musicBusy} onClick={generateMusic}>{musicBusy ? '음악 생성 중…' : 'Lyria로 음악 생성'}</button>
          {musicBusy && <button type="button" onClick={() => musicRequest.current?.abort()}>음악 생성 취소</button>}
          <button type="button" disabled={!slot.musicBuffer || musicBusy} onClick={previewMusic}>설정 적용 미리듣기</button>
          <button type="button" disabled={!slot.musicBuffer} onClick={() => { set({ musicBuffer: null }); setPreview(null); }}>음악 제거</button>
        </div>
        {preview && <><audio src={preview} controls /><a href={preview} download="background-music.wav">음악 저장</a></>}
        <p role="status">{musicStatus}</p>
      </div>
    </section>
    <section role="tabpanel" id={`content-panel-video-${slot.id}`} aria-labelledby={`content-tab-video-${slot.id}`} hidden={activeTab !== 'video'}>
      <div className="tts-production-content">
        <button type="button" onClick={onUploadBackground}>배경 이미지·비디오 업로드</button>
        {slot.backgroundVideo && <div className="tts-production-grid">
          {checkbox('originalMuted', '원본 비디오 오디오 끄기', true)}
          {volume('originalVolume', '원본 비디오 볼륨', 1)}
        </div>}
        <label>Veo 비디오 프롬프트<textarea rows={3} value={slot.veoPrompt || ''} onChange={e => set({ veoPrompt: e.target.value })} placeholder="장면, 움직임과 카메라 연출을 입력하세요." /></label>
        <button type="button" onClick={() => set({ veoPrompt: slot.imagePrompt || slot.text })}>대본·이미지 프롬프트 가져오기</button>
        <div className="tts-production-row">
          <label>Veo 모델<select value={slot.veoModel || 'veo-3.1-fast-generate-preview'} onChange={e => set({ veoModel: e.target.value })}>
            <option value="veo-3.1-fast-generate-preview">Veo 3.1 Fast</option><option value="veo-3.1-generate-preview">Veo 3.1</option>
          </select></label>
          <label>클립 길이<select value={slot.veoDuration || 8} onChange={e => set({ veoDuration: Number(e.target.value) })}>{[4, 6, 8].map(seconds => <option key={seconds} value={seconds}>{seconds}초</option>)}</select></label>
          <label>화면 비율<select value={slot.veoAspect || '16:9'} onChange={e => set({ veoAspect: e.target.value })}><option>16:9</option><option>9:16</option></select></label>
        </div>
        <div className="tts-production-row">
          <button type="button" disabled={veoBusy} onClick={generateVideo}>{veoBusy ? 'Veo 생성 중…' : 'Veo 비디오 생성'}</button>
          {veoBusy && <button type="button" onClick={() => videoRequest.current?.abort()}>Veo 대기 중단</button>}
          <button type="button" disabled={isVideoGenerating || !slot.audioBuffer || (!slot.backgroundImage && !slot.backgroundVideo)} onClick={onGenerateVideo}>{isVideoGenerating ? 'MP4 제작 중…' : '음성·배경음악 합쳐 MP4 제작'}</button>
        </div>
        <p>최종 영상은 대본 음성 길이로 제작하며 짧은 배경 비디오는 반복됩니다. 음악은 영상 종료 시 잘립니다.</p>
        <p role="status">{videoStatus}</p>
      </div>
    </section>
  </div>;
}

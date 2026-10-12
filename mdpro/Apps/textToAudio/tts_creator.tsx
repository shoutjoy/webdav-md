import React, { useState, useRef, useEffect } from 'react';
import SlotImageGenerator from './SlotImageGenerator';
import { listImageModels } from './imageGeneration';
import SlotProductionControls from './SlotProductionControls';
import { scheduleMusic } from './productionAudio';
import { slotImages, imageTimeline, imageAtTime, drawContained } from './imageTimeline';
import ProjectPanel from './ProjectPanel';
import { generateTtsAudio, runAudioBatch } from './ttsBatch';

// --- [데이터 설정] 캐릭터(목소리) 프리셋 ---
const AI_CHARACTERS = [
  { id: 'Kore', icon: '🎙️', name: '민희 (여자 성우)' },
  { id: 'Iapetus', icon: '👔', name: '성철 (남자 성우)' },
  { id: 'Leda', icon: '🎒', name: '혜은 (여대생)' },
  { id: 'Zephyr', icon: '🎧', name: '재형 (남대생)' },
  { id: 'Aoede', icon: '📺', name: '선영 (여성 아나운서)' },
  { id: 'Rasalgethi', icon: '📰', name: '현무 (남성 아나운서)' },
  { id: 'Gacrux', icon: '💼', name: '민아 (중년 여성 CEO)' },
  { id: 'Charon', icon: '🏢', name: '철수 (중년 남성 CEO)' },
  { id: 'Puck', icon: '👧', name: '지우 (어린 여자아이)' },
  { id: 'Fenrir', icon: '👦', name: '민준 (어린 남자아이)' },
  { id: 'Vindemiatrix', icon: '👵', name: '영희 (따뜻한 할머니)' },
  { id: 'Sulafat', icon: '👴', name: '덕배 (인자한 할아버지)' },
];

// Inject lamejs for MP3 encoding
const loadLameJS = () => {
    return new Promise((resolve, reject) => {
        if (window.lamejs) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.all.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
};

// Simple WAV encoder from AudioBuffer
const audioBufferToWav = (buffer, opt) => {
    opt = opt || {};
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = opt.float32 ? 3 : 1;
    const bitDepth = format === 3 ? 32 : 16;
    let result;

    if (numChannels === 2) {
        result = interleave(buffer.getChannelData(0), buffer.getChannelData(1));
    } else {
        result = buffer.getChannelData(0);
    }

    return encodeWAV(result, format, sampleRate, numChannels, bitDepth);
};

const interleave = (inputL, inputR) => {
    const length = inputL.length + inputR.length;
    const result = new Float32Array(length);
    let index = 0, inputIndex = 0;
    while (index < length) {
        result[index++] = inputL[inputIndex];
        result[index++] = inputR[inputIndex];
        inputIndex++;
    }
    return result;
};

const encodeWAV = (samples, format, sampleRate, numChannels, bitDepth) => {
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
    const view = new DataView(buffer);

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * bytesPerSample, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, samples.length * bytesPerSample, true);

    if (format === 1) { // Raw PCM
        floatTo16BitPCM(view, 44, samples);
    } else {
        writeFloat32(view, 44, samples);
    }

    return buffer;
};

const writeString = (view, offset, string) => {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
};

const floatTo16BitPCM = (output, offset, input) => {
    for (let i = 0; i < input.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, input[i]));
        output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
};

const writeFloat32 = (output, offset, input) => {
    for (let i = 0; i < input.length; i++, offset += 4) {
        output.setFloat32(offset, input[i], true);
    }
};

const audioBufferToMp3 = (buffer) => {
    if (!window.lamejs) {
        throw new Error("lamejs not loaded");
    }
    const channels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const kbps = 128;
    const mp3encoder = new window.lamejs.Mp3Encoder(channels, sampleRate, kbps);
    const mp3Data = [];

    const sampleBlockSize = 1152;
    const floatData = buffer.getChannelData(0); // Encode as mono
    const int16Data = new Int16Array(floatData.length);
    
    for (let i = 0; i < floatData.length; i++) {
        const s = Math.max(-1, Math.min(1, floatData[i]));
        int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    for (let i = 0; i < int16Data.length; i += sampleBlockSize) {
        const sampleChunk = int16Data.subarray(i, i + sampleBlockSize);
        const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
        if (mp3buf.length > 0) {
            mp3Data.push(new Int8Array(mp3buf));
        }
    }

    const mp3buf = mp3encoder.flush();
    if (mp3buf.length > 0) {
        mp3Data.push(new Int8Array(mp3buf));
    }

    return new Blob(mp3Data, { type: 'audio/mp3' });
};

const pcmToAudioBuffer = async (pcmBase64, sampleRate, audioContext) => {
    const binaryString = atob(pcmBase64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    
    const pcm16 = new Int16Array(bytes.buffer);
    const audioBuffer = audioContext.createBuffer(1, pcm16.length, sampleRate);
    const channelData = audioBuffer.getChannelData(0);
    
    for (let i = 0; i < pcm16.length; i++) {
        channelData[i] = pcm16[i] / 32768.0;
    }
    
    return audioBuffer;
}

const encodeWithMediaRecorder = async (audioBuffer, mimeType, audioContext) => {
    await audioContext.resume();
    return new Promise((resolve, reject) => {
        const dest = audioContext.createMediaStreamDestination();
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(dest);
        
        let actualMimeType = mimeType;
        if (!MediaRecorder.isTypeSupported(actualMimeType)) {
            actualMimeType = 'audio/webm'; // Fallback
            console.warn(`MIME type ${mimeType} not supported, falling back to ${actualMimeType}`);
        }

        const recorder = new MediaRecorder(dest.stream, { mimeType: actualMimeType });
        const chunks = [];

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: actualMimeType });
            resolve({ blob, extension: actualMimeType.includes('mp4') ? 'm4a' : 'webm' });
        };

        recorder.start();
        source.start(0);

        source.onended = () => {
            if (recorder.state !== 'inactive') recorder.stop();
        };
    });
};

// --- [컴포넌트] 개별 TTS 슬롯 ---
const TtsSlot = ({ slot, index, updateSlot, removeSlot, audioContextRef, isLameLoaded, browserVoices, isDarkMode, apiKey, imageModels, modelStatus, refreshModels, batchBusy, batchSlotId }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isVideoGenerating, setIsVideoGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [contentTab, setContentTab] = useState('image');
  const backgroundImages = slotImages(slot);
  const timeline = imageTimeline(backgroundImages, slot.audioBuffer?.duration || 0, slot.imageTimingMode);
  const imageWindows = useRef(new Map());
  const updateSlotRef = useRef(updateSlot);
  updateSlotRef.current = updateSlot;
  useEffect(() => {
    const receive = event => {
      if (event.origin !== location.origin) return;
      const session = imageWindows.current.get(event.source);
      if (!session) return;
      if (event.data?.type === 'tts-fma-ready' && session.kind === 'fma') {
        event.source.postMessage({ type: 'tts-fma-open', image: session.image }, location.origin);
      }
      if (event.data?.type === 'tts-image-preview-ready' && session.kind === 'preview') {
        event.source.postMessage({ type: 'tts-image-preview', image: session.image }, location.origin);
      }
      const dataUrl = String(event.data?.dataUrl || '');
      if (session.kind !== 'fma' || !/^data:image\/[a-z0-9.+-]+;base64,/i.test(dataUrl)) return;
      if (event.data.type === 'tts-fma-thumbnail') updateSlotRef.current(slot.id, { backgroundImage: dataUrl, backgroundVideo: null, backgroundImageId: session.imageId });
      if (event.data.type === 'tts-fma-document') window.parent.postMessage({ type: 'tts-fma-document', dataUrl, name: event.data.name }, location.origin);
    };
    window.addEventListener('message', receive);
    return () => {
      window.removeEventListener('message', receive);
      imageWindows.current.forEach((session, popup) => { if (!popup.closed) popup.close(); });
      imageWindows.current.clear();
    };
  }, [slot.id]);
  const openImageWindow = (image, kind) => {
    if (!image) return;
    for (const popup of imageWindows.current.keys()) if (popup.closed) imageWindows.current.delete(popup);
    const url = new URL(kind === 'fma' ? './fma-editor.html?v=20261013-2' : './imagePreview.html?v=20261013-1', location.href);
    const popup = window.open(url.href, '_blank', 'width=1200,height=850,resizable=yes,scrollbars=yes');
    if (!popup) { alert('새 창을 열 수 없습니다. 브라우저의 팝업 허용 설정을 확인해주세요.'); return; }
    imageWindows.current.set(popup, { kind, image, imageId: backgroundImages.find(item => item.src === image)?.id });
  };
  const [videoPreview, setVideoPreview] = useState(slot.videoResult || null);
  const videoMountedRef = useRef(true);
  useEffect(() => {
    videoMountedRef.current = true;
    return () => { videoMountedRef.current = false; };
  }, []);
  useEffect(() => {
    return () => { if (videoPreview) URL.revokeObjectURL(videoPreview.url); };
  }, [videoPreview]);
  const audioRef = useRef(null);
  const currentSourceRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageUploadMode = useRef('append');
  useEffect(() => {
    const url = slot.backgroundVideo;
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [slot.backgroundVideo]);

  // 1. 오디오 생성 기능 (API 호출)
  const handleGenerateAudio = async () => {
    if (!slot.text.trim()) {
      alert("대본을 입력해주세요.");
      return;
    }

    if (slot.ttsMode === 'browser') {
      alert("브라우저 모드에서는 즉시 재생만 지원됩니다. '들어보기'를 눌러주세요.");
      updateSlot(slot.id, { isGenerated: true });
      return;
    }

    setIsGenerating(true);
    
    try {
        const audioBuffer = await generateTtsAudio(slot, apiKey, audioContextRef.current);
        updateSlot(slot.id, { audioBuffer, isGenerated: true });
    } catch (error) {
        console.error("Generation failed:", error);
        alert("오디오 생성 중 오류가 발생했습니다: " + error.message);
    } finally {
        setIsGenerating(false);
    }
  };

  // 2. 오디오 들어보기/정지 기능
  const handlePlayAudio = async () => {
    if (slot.ttsMode === 'browser') {
      if (isPlaying) {
          window.speechSynthesis.cancel();
          setIsPlaying(false);
      } else {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(slot.text);
          if (slot.browserVoice) {
              const selectedVoice = browserVoices.find(v => v.voiceURI === slot.browserVoice);
              if (selectedVoice) utterance.voice = selectedVoice;
          }
          
          if (slot.isCustom) {
              utterance.rate = slot.speed || 1.0;
              utterance.pitch = slot.pitch || 1.0;
          }

          utterance.onend = () => setIsPlaying(false);
          setIsPlaying(true);
          window.speechSynthesis.speak(utterance);
      }
      return;
    }

    if (!slot.audioBuffer) return;
    await audioContextRef.current.resume();

    if (isPlaying) {
        if (currentSourceRef.current) {
            currentSourceRef.current.stop();
            currentSourceRef.current = null;
        }
        setIsPlaying(false);
    } else {
        if (currentSourceRef.current) {
            currentSourceRef.current.stop();
        }
        const source = audioContextRef.current.createBufferSource();
        source.buffer = slot.audioBuffer;
        
        if (slot.isCustom) {
            source.playbackRate.value = slot.speed || 1.0; // 적용: AI 오디오의 재생 속도 조절
        }

        source.connect(audioContextRef.current.destination);
        source.onended = () => setIsPlaying(false);
        source.start(0);
        currentSourceRef.current = source;
        setIsPlaying(true);
    }
  };

  // 3. 이미지 업로드 처리
  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    const file = files[0];
    const uploadMode = imageUploadMode.current;
    imageUploadMode.current = 'append';
    e.target.value = '';
    if (file) {
        if (files.length > 1 && files.some(item => !item.type.startsWith('image/'))) {
            alert('이미지는 여러 장, 비디오는 한 개씩 선택해주세요.'); return;
        }
        if (file.type.startsWith('video/')) {
            updateSlot(slot.id, { backgroundVideo: URL.createObjectURL(file), backgroundImage: null });
            return;
        }
        if (!file.type.startsWith('image/')) {
            alert('이미지 또는 비디오 파일을 선택해주세요.');
            return;
        }
        try {
            const added = await Promise.all(files.map(item => new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve({ id: crypto.randomUUID(), src: reader.result, name: item.name, duration: 3 });
                reader.onerror = () => reject(new Error('이미지 파일을 읽지 못했습니다.'));
                reader.readAsDataURL(item);
            })));
            const target = slot.selectedImageId || backgroundImages[0]?.id;
            const next = uploadMode === 'replace' && added.length === 1 && backgroundImages.length
                ? backgroundImages.map(item => item.id === target ? { ...item, src: added[0].src, name: added[0].name } : item)
                : [...backgroundImages, ...added];
            updateSlot(slot.id, { backgroundImages: next, backgroundVideo: null });
        } catch (error) { alert(error.message); }
    }
  };

  // 4. 오디오 다운로드
  const handleDownloadAudio = async () => {
      if (!slot.audioBuffer) return;
      setIsDownloading(true);

      try {
          let blob, filename;
          const safeText = slot.text.substring(0, 15).replace(/[^a-z0-9가-힣]/gi, '_') || 'audio';
          const format = slot.format;

          if (format === 'wav') {
              const wavBuffer = audioBufferToWav(slot.audioBuffer);
              blob = new Blob([wavBuffer], { type: 'audio/wav' });
              filename = `${safeText}.wav`;
          } else if (format === 'mp3') {
              if (!isLameLoaded) throw new Error("MP3 encoder not ready yet");
              blob = audioBufferToMp3(slot.audioBuffer);
              filename = `${safeText}.mp3`;
          } else if (format === 'm4a') {
              const result = await encodeWithMediaRecorder(slot.audioBuffer, 'audio/mp4', audioContextRef.current);
              blob = result.blob;
              filename = `${safeText}.${result.extension}`;
          }

          if (blob) {
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.style.display = 'none';
              a.href = url;
              a.download = filename;
              document.body.appendChild(a);
              a.click();
              setTimeout(() => {
                  document.body.removeChild(a);
                  window.URL.revokeObjectURL(url);
              }, 100);
          }
      } catch (error) {
          console.error("Download failed:", error);
          alert("다운로드 중 오류가 발생했습니다: " + error.message);
      } finally {
          setIsDownloading(false);
      }
  }

  // 5. 동영상 생성
  const handleGenerateVideo = async () => {
    if ((!slot.backgroundImage && !slot.backgroundVideo) || !slot.audioBuffer) {
      alert("배경 이미지 또는 비디오와 생성된 오디오가 모두 필요합니다.");
      return;
    }
    setIsVideoGenerating(true);
    let backgroundVideo, renderInterval, recordingStream, recordingSource, musicTrack, originalSource, originalGain;
    
    try {
        await audioContextRef.current.resume();
        const img = slot.backgroundVideo ? document.createElement('video') : new Image();
        if (slot.backgroundVideo) {
            backgroundVideo = img;
            img.muted = true;
            img.loop = true;
            img.playsInline = true;
            img.preload = 'auto';
        }
        await new Promise((resolve, reject) => {
            if (slot.backgroundVideo) img.onloadeddata = resolve;
            else img.onload = resolve;
            img.onerror = () => reject(new Error('배경 파일을 재생할 수 없습니다. 지원되는 이미지 또는 비디오를 선택해주세요.'));
            img.src = slot.backgroundVideo || slot.backgroundImage;
        });
        const loadedImages = new Map();
        if (!slot.backgroundVideo) {
            await Promise.all(backgroundImages.map(item => new Promise((resolve, reject) => {
                const image = new Image();
                image.onload = () => { loadedImages.set(item.id, image); resolve(); };
                image.onerror = () => reject(new Error(`${item.name || '배경 이미지'}를 불러올 수 없습니다.`));
                image.src = item.src;
            })));
        }

        const canvas = document.createElement('canvas');
        const width = slot.backgroundVideo ? img.videoWidth : img.width;
        const height = slot.backgroundVideo ? img.videoHeight : img.height;
        const scale = Math.min(1, 1920 / width, 1080 / height);
        canvas.width = Math.max(2, Math.floor(width * scale / 2) * 2);
        canvas.height = Math.max(2, Math.floor(height * scale / 2) * 2);
        const ctx = canvas.getContext('2d');
        const exportTimeline = imageTimeline(backgroundImages, slot.audioBuffer.duration, slot.imageTimingMode);
        const drawFrame = seconds => {
            const image = slot.backgroundVideo ? img : loadedImages.get(imageAtTime(exportTimeline, seconds)?.id) || img;
            drawContained(ctx, image, canvas.width, canvas.height);
        };
        drawFrame(0);

        const stream = canvas.captureStream(30);
        const dest = audioContextRef.current.createMediaStreamDestination();
        if (backgroundVideo) {
            originalSource = audioContextRef.current.createMediaElementSource(backgroundVideo);
            originalGain = audioContextRef.current.createGain();
            originalGain.gain.value = (slot.originalMuted ?? true) ? 0 : (slot.originalVolume ?? 1);
            originalSource.connect(originalGain).connect(dest);
            backgroundVideo.muted = false;
        }
        const source = audioContextRef.current.createBufferSource();
        recordingSource = source;
        source.buffer = slot.audioBuffer;
        source.connect(dest);

        const combinedStream = new MediaStream([
            ...stream.getVideoTracks(),
            ...dest.stream.getAudioTracks()
        ]);
        recordingStream = combinedStream;

        let mimeType = 'video/mp4';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'video/webm;codecs=vp8,opus';
            console.warn("video/mp4가 지원되지 않아 webm 형식으로 대체 렌더링됩니다.");
        }

        const recorder = new MediaRecorder(combinedStream, { mimeType });
        const chunks = [];
        recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

        let drawInterval;
        const recordPromise = new Promise((resolve, reject) => {
            recorder.onerror = () => reject(new Error('영상 인코딩에 실패했습니다.'));
            recorder.onstop = () => {
                clearInterval(drawInterval);
                const blob = new Blob(chunks, { type: mimeType });
                const url = URL.createObjectURL(blob);
                resolve({ url, ext: mimeType.includes('mp4') ? 'mp4' : 'webm' });
            };
        });

        if (backgroundVideo) await backgroundVideo.play();
        recorder.start();
        const startTime = audioContextRef.current.currentTime;
        musicTrack = scheduleMusic(audioContextRef.current, dest, slot.musicBuffer,
            { ...slot, musicDuration: slot.musicDuration ?? slot.audioBuffer.duration }, slot.audioBuffer.duration, startTime);
        source.start(startTime);

        // 오디오가 재생되는 동안 비디오 프레임을 캡처할 수 있도록 계속 그려줍니다.
        drawInterval = setInterval(() => {
            drawFrame(audioContextRef.current.currentTime - startTime);
        }, 1000 / 30);
        renderInterval = drawInterval;

        source.onended = () => {
            if (recorder.state !== 'inactive') recorder.stop();
        };

        const result = await recordPromise;
        combinedStream.getTracks().forEach(track => track.stop());
        source.disconnect();
        if (!videoMountedRef.current) {
            URL.revokeObjectURL(result.url);
            return;
        }
        
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = result.url;
        const safeText = slot.text.substring(0, 15).replace(/[^a-z0-9가-힣]/gi, '_') || 'video';
        a.download = `${safeText}.${result.ext}`;
        setVideoPreview({ url: result.url, filename: a.download, ext: result.ext });
        updateSlot(slot.id, { videoResult: { url: result.url, filename: a.download, ext: result.ext } });
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
        }, 100);

    } catch (e) {
        console.error("Video Generation Error:", e);
        alert("비디오 생성 중 오류가 발생했습니다: " + e.message);
    } finally {
        clearInterval(renderInterval);
        if (musicTrack) {
            try { musicTrack.source.stop(); } catch {}
            musicTrack.source.disconnect(); musicTrack.gain.disconnect();
        }
        originalSource?.disconnect(); originalGain?.disconnect();
        recordingStream?.getTracks().forEach(track => track.stop());
        if (recordingSource) {
            recordingSource.onended = null;
            try { recordingSource.stop(); } catch {}
            recordingSource.disconnect();
        }
        if (backgroundVideo) {
            backgroundVideo.pause();
            backgroundVideo.removeAttribute('src');
            backgroundVideo.load();
        }
        setIsVideoGenerating(false);
    }
  };

  return (
    <div className={`tts-slot p-5 border-2 rounded-2xl shadow-sm mb-6 transition-all relative overflow-hidden group ${isDarkMode ? 'bg-gray-800 border-gray-700 hover:shadow-gray-900/50' : 'bg-white border-pink-100 hover:shadow-md'}`}>
       {/* 장식용 띠 */}
      <div className={`absolute top-0 left-0 w-2 h-full bg-gradient-to-b ${isDarkMode ? 'from-purple-500 to-blue-500' : 'from-pink-300 to-purple-400'}`}></div>
      
      <div className="flex justify-between items-center mb-4 pl-4">
        <h3 className={`font-extrabold text-lg flex items-center gap-2 ${isDarkMode ? 'text-purple-300' : 'text-pink-600'}`}>
          <span>🎬</span> 슬롯 {index + 1}
        </h3>
        <button onClick={() => removeSlot(slot.id)} className={`transition-colors p-1 rounded-full ${isDarkMode ? 'text-gray-400 hover:text-red-400 hover:bg-gray-700' : 'text-gray-300 hover:text-red-500 hover:bg-red-50'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* 설정 영역 */}
      <div className={`tts-slot-settings flex flex-col gap-4 mb-4 p-4 rounded-xl border ml-4 ${isDarkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-pink-50/50 border-pink-100/50'}`}>
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <label className={`text-sm font-bold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>엔진:</label>
            <select 
              value={slot.ttsMode}
              onChange={(e) => updateSlot(slot.id, { ttsMode: e.target.value, isGenerated: false })}
              className={`p-2 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-pink-300 outline-none shadow-sm ${isDarkMode ? 'bg-gray-800 border-gray-600 text-gray-200' : 'bg-white border-gray-200 text-gray-700'}`}
            >
              <option value="ai">✨ 인공지능 (Gemini)</option>
              <option value="browser">🌐 브라우저 (로컬)</option>
            </select>
          </div>

          {slot.ttsMode === 'ai' ? (
            <div className="flex items-center gap-2">
              <label className={`text-sm font-bold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>캐릭터:</label>
              <select 
                value={slot.voice}
                onChange={(e) => updateSlot(slot.id, { voice: e.target.value, isGenerated: false })}
                className={`p-2 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-pink-300 outline-none shadow-sm ${isDarkMode ? 'bg-gray-800 border-gray-600 text-gray-200' : 'bg-white border-gray-200 text-gray-700'}`}
              >
                {AI_CHARACTERS.map(char => (
                  <option key={char.id} value={char.id}>{char.icon} {char.name}</option>
                ))}
              </select>
            </div>
          ) : (
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <label className={`text-sm font-bold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>음성:</label>
                  <select 
                      value={slot.browserVoice}
                      onChange={(e) => updateSlot(slot.id, { browserVoice: e.target.value, isGenerated: false })}
                      className={`w-full p-2 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-pink-300 outline-none shadow-sm ${isDarkMode ? 'bg-gray-800 border-gray-600 text-gray-200' : 'bg-white border-gray-200 text-gray-700'}`}
                  >
                      <option value="">기본 음성 선택</option>
                      {browserVoices.map((v, i) => (
                          <option key={i} value={v.voiceURI}>{v.name} ({v.lang})</option>
                      ))}
                  </select>
              </div>
          )}
          
          <div className={`flex items-center gap-2 ml-auto px-3 py-1.5 rounded-lg border shadow-sm ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'}`}>
            <input 
              type="checkbox" 
              id={`custom-${slot.id}`} 
              checked={slot.isCustom || false}
              onChange={(e) => updateSlot(slot.id, { isCustom: e.target.checked, isGenerated: false })}
              className="w-4 h-4 text-pink-500 rounded focus:ring-pink-400 cursor-pointer"
            />
            <label htmlFor={`custom-${slot.id}`} className={`text-sm font-bold cursor-pointer ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              ⚙️ 커스텀 설정 (속도/음정)
            </label>
          </div>
        </div>

        {slot.isCustom && (
          <div className={`flex flex-wrap gap-6 items-center p-4 rounded-lg border shadow-sm mt-1 transition-all ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-pink-100'}`}>
            <div className="flex flex-col gap-2 flex-1 min-w-[180px]">
              <div className="flex justify-between items-center">
                <label className={`text-xs font-bold flex items-center gap-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>🏃 속도 (Speed)</label>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${isDarkMode ? 'bg-gray-700 text-pink-400' : 'bg-pink-50 text-pink-500'}`}>{slot.speed?.toFixed(1) || '1.0'}x</span>
              </div>
              <input 
                type="range" min="0.5" max="2.0" step="0.1" 
                value={slot.speed || 1.0} 
                onChange={(e) => updateSlot(slot.id, { speed: parseFloat(e.target.value), isGenerated: false })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-pink-500"
              />
            </div>
            <div className="flex flex-col gap-2 flex-1 min-w-[180px]">
              <div className="flex justify-between items-center">
                <label className={`text-xs font-bold flex items-center gap-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>🎵 음정 (Pitch)</label>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${isDarkMode ? 'bg-gray-700 text-purple-400' : 'bg-purple-50 text-purple-500'}`}>{slot.pitch?.toFixed(1) || '1.0'}</span>
              </div>
              <input 
                type="range" min="0.5" max="2.0" step="0.1" 
                value={slot.pitch || 1.0} 
                onChange={(e) => updateSlot(slot.id, { pitch: parseFloat(e.target.value), isGenerated: false })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>
            <div className={`text-[11px] w-full flex items-start gap-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              <span className="text-pink-400">💡</span>
              인공지능 모드에서는 자연어 프롬프트와 오디오 재생 속도 조절로 반영되며, 목소리 모델에 따라 반영 폭이 미세하게 다를 수 있습니다.
            </div>
          </div>
        )}
      </div>

      {/* 대본 및 이미지 입력 영역 */}
      <div className="tts-slot-inputs tts-script-media">
        <textarea
          className={`w-full p-4 border rounded-xl resize-y focus:ring-2 focus:ring-pink-300 outline-none shadow-inner font-medium ${isDarkMode ? 'bg-gray-800 border-gray-600 text-gray-200' : 'bg-gray-50/30 border-gray-200 text-gray-700'}`}
          rows="5"
          value={slot.text}
          onChange={(e) => updateSlot(slot.id, { text: e.target.value, isGenerated: false })}
          placeholder="이 캐릭터가 읽어줄 아름다운 이야기를 적어주세요..."
        />
        <div className="tts-background-upload">
        <div 
          onClick={() => fileInputRef.current.click()}
          className={`w-full min-h-[160px] flex flex-col items-center justify-center border-2 border-dashed rounded-xl cursor-pointer overflow-hidden group transition-colors relative ${isDarkMode ? 'border-gray-600 bg-gray-700 hover:bg-gray-600' : 'border-pink-200 bg-pink-50/50 hover:bg-pink-100/50'}`}
        >
          {slot.backgroundVideo ? (
            <div className="tts-background-video" onClick={e => e.stopPropagation()}>
              <video src={slot.backgroundVideo} controls playsInline preload="metadata" aria-label="업로드한 배경 비디오 미리보기" />
              <button type="button" onClick={() => fileInputRef.current.click()}>배경 변경하기</button>
              <p>영상 배경은 음성 길이에 맞춰 반복됩니다. 원본 소리는 비디오 설정에서 조절하세요.</p>
            </div>
          ) : slot.backgroundImage ? (
             <div className="tts-background-image" onClick={event => event.stopPropagation()}>
               <button type="button" className="tts-image-open" title="이미지를 새창으로 크게 보기" onClick={() => openImageWindow(slot.backgroundImage, 'preview')}>
                 <img src={slot.backgroundImage} alt="배경 이미지 원본 보기" />
               </button>
               <div className="tts-image-tools">
                 <button type="button" onClick={() => openImageWindow(slot.backgroundImage, 'preview')}>새창으로 보기</button>
                 <button type="button" onClick={() => openImageWindow(slot.backgroundImage, 'fma')}>FMA로 편집</button>
                 <button type="button" onClick={() => { imageUploadMode.current = 'replace'; fileInputRef.current.click(); }}>변경하기</button>
               </div>
             </div>
          ) : (
             <div className={`text-center font-medium ${isDarkMode ? 'text-gray-400 group-hover:text-gray-300' : 'text-pink-400 group-hover:text-pink-500'}`}>
               <span className="text-3xl block mb-2 opacity-80">🖼️</span>
               배경 썸네일 업로드<br/><span className="text-xs opacity-70">(이미지 여러 장 · 비디오)</span>
             </div>
          )}
          <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*,video/*" multiple className="hidden" />
        </div>
      </div>
      </div>

      {!slot.backgroundVideo && backgroundImages.length > 0 && <details className="tts-image-sequence">
        <summary>이미지 순서·시간 ({backgroundImages.length}장)</summary>
        <div className="tts-sequence-controls">
          <button type="button" onClick={() => fileInputRef.current.click()}>이미지 추가</button>
          <label>시간 배분 <select value={slot.imageTimingMode || 'equal'} onChange={event => updateSlot(slot.id, { imageTimingMode: event.target.value })}>
            <option value="equal">음성 길이에 균등 배분</option><option value="custom">장당 시간 직접 설정</option>
          </select></label>
          <p>영상은 음성 길이에 맞춰 종료됩니다. 직접 설정 시 시간이 남으면 마지막 이미지를 유지합니다.</p>
        </div>
        <div className="tts-sequence-list">
          {backgroundImages.map((image, index) => <div className="tts-sequence-item" key={image.id}>
            <button type="button" onClick={() => updateSlot(slot.id, { selectedImageId: image.id })} aria-label={`${index + 1}번 이미지 선택`} aria-pressed={(slot.selectedImageId || backgroundImages[0].id) === image.id}>
              <img src={image.src} alt={`${index + 1}번 ${image.name || '이미지'}`} />
            </button>
            <span>{index + 1}. {image.name || '이미지'}</span>
            <div className="tts-sequence-controls">
              <button type="button" disabled={index === 0} onClick={() => { const next = [...backgroundImages]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; updateSlot(slot.id, { backgroundImages: next }); }} aria-label={`${index + 1}번 이미지 앞으로`}>←</button>
              <button type="button" disabled={index === backgroundImages.length - 1} onClick={() => { const next = [...backgroundImages]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; updateSlot(slot.id, { backgroundImages: next }); }} aria-label={`${index + 1}번 이미지 뒤로`}>→</button>
              <button type="button" onClick={() => updateSlot(slot.id, { backgroundImages: backgroundImages.filter(item => item.id !== image.id) })}>삭제</button>
            </div>
            {slot.imageTimingMode === 'custom' && <label>표시 시간 (초)<input type="number" min="0.1" step="0.1" value={image.duration || 3} onChange={event => updateSlot(slot.id, { backgroundImages: backgroundImages.map(item => item.id === image.id ? { ...item, duration: Math.max(.1, Number(event.target.value) || .1) } : item) })} /></label>}
            {slot.audioBuffer && <small>{timeline.find(item => item.id === image.id) ? `${timeline.find(item => item.id === image.id).start.toFixed(1)}–${timeline.find(item => item.id === image.id).end.toFixed(1)}초` : '음성 종료 후 · 영상에 표시되지 않음'}</small>}
          </div>)}
        </div>
      </details>}
      {/* 액션 버튼 영역 (생성 / 재생 철저히 분리) */}
      <div className={`tts-slot-actions mt-6 flex flex-wrap items-center justify-between border-t pt-5 ml-4 gap-4 ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={handleGenerateAudio}
            disabled={batchBusy || isGenerating || (slot.ttsMode === 'ai' && !slot.text.trim())}
            className={`px-6 py-2.5 rounded-xl font-bold text-white shadow-md transition-all flex items-center gap-2 ${
              isGenerating || (slot.ttsMode === 'ai' && !slot.text.trim()) ? 'bg-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 transform hover:-translate-y-0.5'
            }`}
          >
            {isGenerating || batchSlotId === slot.id ? (
                <><svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> 오디오 생성 중...</>
            ) : '✨ 1. 오디오 생성하기'}
          </button>

          {slot.isGenerated && (
            <button 
              onClick={handlePlayAudio}
              className={`px-6 py-2.5 rounded-xl font-bold text-white shadow-md transition-all flex items-center gap-2 ${
                isPlaying ? 'bg-rose-500 hover:bg-rose-600' : 'bg-emerald-500 hover:bg-emerald-600 transform hover:-translate-y-0.5'
              }`}
            >
              {isPlaying ? (
                  <><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" /></svg> ⏹ 정지</>
              ) : (
                  <><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg> ▶️ 들어보기</>
              )}
            </button>
          )}
        </div>

        {slot.isGenerated && slot.ttsMode === 'ai' && (
          <div className={`flex flex-wrap items-center gap-3 p-1.5 rounded-xl border ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-100'}`}>
             <div className={`flex items-center gap-1 rounded-lg border px-2 py-1 ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'}`}>
                <select 
                    value={slot.format}
                    onChange={(e) => updateSlot(slot.id, { format: e.target.value })}
                    className={`border-none bg-transparent text-sm font-bold outline-none focus:ring-0 cursor-pointer ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}
                >
                    <option value="mp3">MP3</option>
                    <option value="wav">WAV</option>
                    <option value="m4a">M4A</option>
                </select>
                <button 
                    onClick={handleDownloadAudio}
                    disabled={isDownloading || !slot.audioBuffer}
                    className={`ml-2 px-3 py-1.5 rounded-md text-sm font-bold flex items-center gap-1 transition-colors disabled:opacity-50 ${isDarkMode ? 'bg-indigo-900/50 text-indigo-300 hover:bg-indigo-800' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}
                >
                    {isDownloading ? '다운로드 중...' : `${slot.format.toUpperCase()} 오디오 다운로드`}
                </button>
             </div>

            {(
                <button 
                    onClick={handleGenerateVideo}
                    disabled={isVideoGenerating || !slot.audioBuffer}
                    className={`px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-all flex items-center gap-1.5 ${
                    isVideoGenerating ? (isDarkMode ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-gray-200 text-gray-500 cursor-not-allowed') : (isDarkMode ? 'bg-blue-900/50 text-blue-300 hover:bg-blue-800 border border-blue-800' : 'bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-200')
                    }`}
                >
                    {isVideoGenerating ? (
                        <><svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> 렌더링...</>
                    ) : (
                        <>🎞️ MP4 생성</>
                    )}
                </button>
            )}
          </div>
        )}
      </div>
      <details className={`tts-add-content ${isDarkMode ? 'is-dark' : ''}`}>
        <summary>Add content <span>이미지 · 배경음악 · 비디오</span></summary>
        <div className="tts-content-tabs" role="tablist" aria-label="추가 콘텐츠 작업">
          {[
            ['image', '🪄 대본으로 이미지 생성'],
            ['music', '🎵 배경음악 업로드 / Lyria 생성'],
            ['video', '🎞️ 비디오 업로드 / Veo 생성'],
          ].map(([tab, label], index) => <button type="button" key={tab} role="tab"
            id={`content-tab-${tab}-${slot.id}`} aria-controls={`content-panel-${tab}-${slot.id}`}
            aria-selected={contentTab === tab} tabIndex={contentTab === tab ? 0 : -1}
            onClick={() => setContentTab(tab)} onKeyDown={event => {
              const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
              if (!keys.includes(event.key)) return;
              event.preventDefault();
              const buttons = event.currentTarget.parentElement.querySelectorAll('[role="tab"]');
              const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (event.key === 'ArrowRight' ? 1 : 2)) % 3;
              buttons[next].focus(); buttons[next].click();
            }}>{label}</button>)}
        </div>
        <div className="tts-add-content-body">
        <div role="tabpanel" id={`content-panel-image-${slot.id}`} aria-labelledby={`content-tab-image-${slot.id}`} hidden={contentTab !== 'image'}>
      <SlotImageGenerator slot={slot} updateSlot={updateSlot} apiKey={apiKey} models={imageModels} modelStatus={modelStatus} refreshModels={refreshModels} isDarkMode={isDarkMode}
        onPreviewImage={image => openImageWindow(image, 'preview')} onEditImage={image => openImageWindow(image, 'fma')} />
        </div>
      <SlotProductionControls slot={slot} updateSlot={updateSlot} apiKey={apiKey} audioContextRef={audioContextRef}
        toWav={audioBufferToWav} isDarkMode={isDarkMode} onUploadBackground={() => fileInputRef.current.click()}
        onGenerateVideo={handleGenerateVideo} isVideoGenerating={isVideoGenerating} activeTab={contentTab} />
        </div>
      </details>

      {videoPreview && <section className="tts-video-preview" aria-label="생성 영상 미리보기">
        <div className="tts-video-preview-header">
          <span>🎞️ 생성 영상 미리보기 · {videoPreview.ext.toUpperCase()}</span>
          <a href={videoPreview.url} download={videoPreview.filename}>영상 다시 저장</a>
        </div>
        <video key={videoPreview.url} src={videoPreview.url} controls playsInline preload="metadata" aria-label="생성 영상 재생" />
      </section>}
    </div>
  );
};

// --- [메인 컴포넌트] 애플리케이션 ---
export default function App() {
  const [imageModels, setImageModels] = useState([]);
  const [modelStatus, setModelStatus] = useState('');
  const [modelRefresh, setModelRefresh] = useState(0);
  const refreshModels = () => setModelRefresh(current => current + 1);
  const [slots, setSlots] = useState([{ 
    id: Date.now(), text: '', ttsMode: 'ai', voice: 'Kore', browserVoice: '', format: 'mp3', 
    backgroundImage: null, isGenerated: false, audioBuffer: null,
    isCustom: false, speed: 1.0, pitch: 1.0
  }]);
  
  // 일괄 업로드 상태
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [delimiter, setDelimiter] = useState('page');
  const [dragActive, setDragActive] = useState(false);
  
  // 다크모드 상태
  const [isDarkMode, setIsDarkMode] = useState(true);

  // 시스템 리소스
  const [isLameLoaded, setIsLameLoaded] = useState(false);
  const audioContextRef = useRef(null);
  const [browserVoices, setBrowserVoices] = useState([]);
  const [apiKey, setApiKey] = useState('');
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchSlotId, setBatchSlotId] = useState(null);
  const [batchAudioStatus, setBatchAudioStatus] = useState('');
  const batchRequest = useRef(null);
  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  useEffect(() => () => batchRequest.current?.abort(), []);

  useEffect(() => {
    const controller = new AbortController();
    setImageModels([]);
    if (!apiKey) { setModelStatus('ENV에서 AI Studio 키를 연결하면 이미지 모델을 자동으로 불러옵니다.'); return; }
    setModelStatus('AI Studio 이미지 모델 목록을 불러오는 중…');
    listImageModels(apiKey, controller.signal).then(models => {
      if (controller.signal.aborted) return;
      setImageModels(models);
      setModelStatus(models.length ? `연결된 키로 조회한 이미지 모델 ${models.length}개` : '이 키로 조회되는 이미지 생성 모델이 없습니다.');
    }).catch(error => {
      if (!controller.signal.aborted) setModelStatus(`목록을 불러오지 못했습니다: ${error.message}`);
    });
    return () => controller.abort();
  }, [apiKey, modelRefresh]);

  useEffect(() => {
    loadLameJS().then(() => setIsLameLoaded(true)).catch(console.error);
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    
    const loadVoices = () => {
        const voices = window.speechSynthesis?.getVoices() || [];
        setBrowserVoices(voices.filter(v => v.lang.startsWith('ko') || v.lang.startsWith('en')));
    };
    loadVoices();
    if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    const receiveMdproContext = (event) => {
      const data = event && event.data;
      if (event.source !== window.parent || event.origin !== window.location.origin) return;
      if (!data || data.type !== 'mdpro-tts2audio-context') return;
      setApiKey(String(data.apiKey || '').trim());
    };
    window.addEventListener('message', receiveMdproContext);
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'tts2audio-request-context' }, window.location.origin);
    }
    return () => {
      window.removeEventListener('message', receiveMdproContext);
      if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = null;
      if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
    };
  }, []);

  const addSlot = () => {
    setSlots(current => [...current, { 
      id: Date.now(), text: '', ttsMode: 'ai', voice: 'Kore', browserVoice: '', format: 'mp3', 
      backgroundImage: null, isGenerated: false, audioBuffer: null,
      isCustom: false, speed: 1.0, pitch: 1.0
    }]);
  };

  const updateSlot = (id, updatedData) => {
    setSlots(current => current.map(slot => {
      if (slot.id !== id) return slot;
      const next = { ...slot, ...updatedData };
      if (updatedData.backgroundVideo) { next.backgroundImages = []; next.backgroundImage = null; }
      else {
        let images = slotImages(next);
        if (updatedData.backgroundImage && !updatedData.backgroundImages) {
          const target = updatedData.backgroundImageId || slot.selectedImageId || images[0]?.id;
          images = images.length ? images.map(item => item.id === target ? { ...item, src: updatedData.backgroundImage } : item)
            : [{ id: crypto.randomUUID(), src: updatedData.backgroundImage, name: '배경 이미지', duration: 3 }];
        }
        next.backgroundImages = images;
        const selected = images.find(item => item.id === next.selectedImageId) || images[0];
        next.selectedImageId = selected?.id;
        next.backgroundImage = selected?.src || null;
      }
      delete next.backgroundImageId;
      return next;
    }));
  };

  const removeSlot = (id) => {
    setSlots(current => current.filter(slot => slot.id !== id));
  };

  const handleBatchAudio = async () => {
    if (batchRequest.current) return;
    if (!apiKey) { setBatchAudioStatus('ENV에서 AI Studio API 키를 먼저 연결해주세요.'); return; }
    const controller = new AbortController();
    batchRequest.current = controller; setBatchBusy(true);
    const snapshot = [...slots];
    try {
      const result = await runAudioBatch(snapshot, async (slot, signal) => {
        const audioBuffer = await generateTtsAudio(slot, apiKey, audioContextRef.current, signal);
        const current = slotsRef.current.find(item => item.id === slot.id);
        if (!current || ['text', 'voice', 'ttsMode', 'isCustom', 'speed', 'pitch'].some(key => current[key] !== slot[key])) throw new Error('생성 중 슬롯 내용이 변경되어 결과를 적용하지 않았습니다.');
        updateSlot(slot.id, { audioBuffer, isGenerated: true });
      }, { signal: controller.signal, onProgress: progress => {
        setBatchSlotId(progress.slotId); setBatchAudioStatus(`슬롯 ${progress.index + 1} / ${progress.total} 오디오 생성 중…`);
      } });
      setBatchAudioStatus(`${result.cancelled ? '일괄 생성 중지' : '일괄 생성 완료'} · 성공 ${result.success}개 · 건너뜀 ${result.skipped.length}개 · 실패 ${result.failed.length}개` +
        [...result.skipped, ...result.failed].map(item => `\n슬롯 ${item.index}: ${item.reason}`).join(''));
    } catch (error) { setBatchAudioStatus(`일괄 생성 오류: ${error.message}`); }
    finally { batchRequest.current = null; setBatchBusy(false); setBatchSlotId(null); }
  };
  // 일괄 등록 (구분자로 분리하여 슬롯 자동 생성)
  const handleBatchProcess = () => {
    if (!batchText.trim()) return;
    if (!delimiter.trim()) {
      alert('구분자를 입력해주세요.');
      return;
    }
    const escapedDelimiter = delimiter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = batchText.split(new RegExp(`\\[?${escapedDelimiter}\\]?`, 'gi')).filter(text => text.trim() !== '');
    
    if (parts.length > 0) {
      const newSlots = parts.map((text, idx) => ({
        id: Date.now() + idx,
        text: text.trim(),
        ttsMode: 'ai',
        voice: slots[0]?.voice || 'Kore',
        browserVoice: slots[0]?.browserVoice || '',
        format: 'mp3',
        backgroundImage: null,
        isGenerated: false,
        audioBuffer: null,
        isCustom: slots[0]?.isCustom || false, 
        speed: slots[0]?.speed || 1.0, 
        pitch: slots[0]?.pitch || 1.0
      }));
      setSlots(newSlots);
      setIsBatchOpen(false);
      setBatchText('');
      alert(`${parts.length}개의 대본 슬롯이 생성되었습니다.`);
    }
  };

  // 파일 업로드 (txt) 처리
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setBatchText(event.target.result);
      reader.readAsText(file);
    }
  };

  // Drag and drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
        setDragActive(true);
    } else if (e.type === "dragleave") {
        setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        const file = e.dataTransfer.files[0];
        const reader = new FileReader();
        reader.onload = (event) => setBatchText(event.target.result);
        reader.readAsText(file);
    }
  };

  return (
    <div className={`tts-app min-h-screen p-4 sm:p-8 font-sans transition-colors duration-300 ${isDarkMode ? 'bg-gray-900 text-gray-200' : 'bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 text-gray-800'}`}>
      <div className="max-w-5xl mx-auto">
        <header className="tts-header mb-10 text-center pt-8 relative">
          <div className="flex justify-center items-center gap-4 mb-4">
             <div className={`inline-block px-6 py-2 backdrop-blur-md rounded-full shadow-sm border text-sm font-semibold tracking-wide transition-colors ${isDarkMode ? 'bg-gray-800/60 border-gray-700 text-purple-400' : 'bg-white/60 border-white/40 text-purple-600'}`}>
               캐릭터와 함께 만드는 스토리텔링
             </div>
             <button
               onClick={() => setIsDarkMode(!isDarkMode)}
               className={`p-2 rounded-full shadow-sm border transition-colors flex items-center justify-center w-10 h-10 ${isDarkMode ? 'bg-gray-800 border-gray-700 text-yellow-300' : 'bg-white border-gray-200 text-gray-600'}`}
               title="테마 변경"
             >
               {isDarkMode ? '☀️' : '🌙'}
             </button>
          </div>
          <h1 className={`text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r ${isDarkMode ? 'from-purple-400 to-blue-400' : 'from-pink-500 to-violet-500'} mb-4 drop-shadow-sm transition-colors`}>
            TTS to Audio & Video Tools ✨
          </h1>
          <p className={`font-medium text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>대본을 넣고 캐릭터를 선택하면 생생한 오디오북과 영상이 완성됩니다.</p>
          <p className={`mt-3 text-sm font-semibold ${apiKey ? 'text-emerald-500' : 'text-amber-500'}`} role="status">
            {apiKey ? '● AI Studio 연결됨' : '● ENV에서 AI Studio API 키를 연결해주세요'}
          </p>
        </header>

        <ProjectPanel slots={slots} settings={{ isDarkMode, batchText, delimiter, isBatchOpen }} audioContextRef={audioContextRef}
          applyProject={project => {
            setSlots(project.slots);
            setIsDarkMode(project.settings.isDarkMode !== false);
            setBatchText(String(project.settings.batchText || ''));
            setDelimiter(String(project.settings.delimiter || 'page'));
            setIsBatchOpen(project.settings.isBatchOpen === true);
          }} />
        {/* 일괄 등록 아코디언 */}
        <div className={`tts-batch backdrop-blur-xl rounded-3xl shadow-lg mb-10 overflow-hidden border transition-all duration-300 ${isDarkMode ? 'bg-gray-800/90 border-gray-700' : 'bg-white/90 border-white/50'}`}>
          <button 
            onClick={() => setIsBatchOpen(!isBatchOpen)}
            className={`w-full p-5 flex justify-between items-center transition-colors ${isDarkMode ? 'bg-gradient-to-r from-gray-700/80 to-gray-800/80 hover:bg-gray-700' : 'bg-gradient-to-r from-pink-50/80 to-purple-50/80 hover:bg-pink-100/80'}`}
          >
            <div className="flex items-center gap-3">
               <div className={`p-2 rounded-xl shadow-sm ${isDarkMode ? 'bg-gray-600 text-purple-300' : 'bg-purple-100 text-purple-600'}`}>
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
               </div>
               <span className={`font-extrabold text-lg ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>📚 일괄 대본 등록 (구분자로 쪼개기)</span>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 transition-transform duration-300 ${isBatchOpen ? 'rotate-180' : ''} ${isDarkMode ? 'text-gray-400' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          
          {isBatchOpen && (
            <div className={`p-6 sm:p-8 border-t ${isDarkMode ? 'border-gray-700' : 'border-pink-100/50'}`}>
              <div 
                className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all mb-6 ${dragActive ? (isDarkMode ? 'border-purple-400 bg-gray-700' : 'border-purple-500 bg-purple-50') : (isDarkMode ? 'border-gray-600 bg-gray-800 hover:border-purple-400' : 'border-gray-300 bg-white hover:border-purple-300')}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                  <label className="cursor-pointer flex flex-col items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-12 w-12 mb-4 ${isDarkMode ? 'text-purple-400' : 'text-purple-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <span className={`font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>.txt 텍스트 파일을 이곳에 드래그하거나 클릭하여 업로드하세요.</span>
                    <span className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors mt-2 ${isDarkMode ? 'bg-gray-700 text-purple-300 hover:bg-gray-600' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}`}>파일 찾기</span>
                    <input type="file" accept=".txt" onChange={handleFileUpload} className="hidden" />
                  </label>
              </div>

              <div className="mb-4">
                <textarea
                  className={`w-full p-5 border rounded-2xl resize-y focus:ring-4 focus:outline-none shadow-inner min-h-[120px] ${isDarkMode ? 'bg-gray-700 border-gray-600 text-gray-200 focus:ring-gray-600 focus:border-gray-500' : 'border-gray-200 focus:ring-pink-100 focus:border-pink-300 text-gray-700'}`}
                  value={batchText}
                  onChange={(e) => setBatchText(e.target.value)}
                  placeholder="또는 여기에 전체 대본을 직접 붙여넣기 하세요."
                />
              </div>

              <div className={`flex flex-col sm:flex-row gap-4 items-center justify-between p-4 rounded-2xl border ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-100'}`}>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <label className={`text-sm font-bold whitespace-nowrap ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>구분자 입력:</label>
                  <input 
                    type="text" 
                    value={delimiter} 
                    onChange={(e) => setDelimiter(e.target.value)}
                    className={`w-24 p-2 border rounded-lg outline-none focus:ring-2 focus:ring-purple-400 text-center font-bold shadow-sm ${isDarkMode ? 'bg-gray-800 border-gray-600 text-purple-300' : 'border-gray-300 text-purple-600 bg-white focus:ring-pink-300'}`}
                    placeholder="예: page"
                  />
                  <span className={`text-xs hidden md:inline ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>(이 단어를 기준으로 슬롯이 나뉩니다)</span>
                </div>
                <div className="tts-batch-audio-actions">
                <button 
                  onClick={handleBatchProcess}
                  className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-bold rounded-xl transition-all shadow-md transform hover:-translate-y-0.5"
                >
                  🚀 슬롯 자동 분할하기
                </button>
                <button type="button" disabled={batchBusy} onClick={handleBatchAudio} className="tts-batch-audio-button">{batchBusy ? '오디오 일괄 생성 중…' : '🎙️ 오디오 일괄 생성'}</button>
                {batchBusy && <button type="button" onClick={() => batchRequest.current?.abort()}>일괄 생성 중지</button>}
                </div>
              </div>
              <p className="tts-batch-audio-status" role="status">{batchAudioStatus}</p>
            </div>
          )}
        </div>

        {/* 슬롯 리스트 */}
        <div className="space-y-8">
          {slots.map((slot, index) => (
            <TtsSlot 
              key={slot.id} 
              slot={slot} 
              index={index} 
              updateSlot={updateSlot} 
              removeSlot={removeSlot}
              audioContextRef={audioContextRef}
              isLameLoaded={isLameLoaded}
              browserVoices={browserVoices}
              isDarkMode={isDarkMode}
              apiKey={apiKey}
              batchBusy={batchBusy}
              batchSlotId={batchSlotId}
              imageModels={imageModels}
              modelStatus={modelStatus}
              refreshModels={refreshModels}
            />
          ))}
        </div>

        {/* 슬롯 추가 버튼 */}
        <div className="tts-add-scene mt-12 mb-20 text-center">
            <button 
            onClick={addSlot}
            className={`w-full sm:w-auto px-10 py-5 border-2 border-dashed font-extrabold text-lg rounded-3xl hover:shadow-xl hover:-translate-y-1 transition-all flex items-center justify-center gap-3 mx-auto ${isDarkMode ? 'bg-gray-800/60 border-purple-500 text-purple-400 hover:bg-gray-800' : 'bg-white/60 backdrop-blur-md border-purple-300 text-purple-600 hover:bg-white hover:border-purple-400'}`}
            >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" /></svg>
            새로운 씬(Scene) 추가하기
            </button>
        </div>
      </div>
    </div>
  );
}

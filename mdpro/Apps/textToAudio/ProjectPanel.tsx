import React, { useEffect, useRef, useState } from 'react';
import { createTavProject, restoreTavProject, saveTavProject, readTavProject, listTavProjects } from './tavProject';

export default function ProjectPanel({ slots, settings, audioContextRef, applyProject }) {
  const [name, setName] = useState('TTS2Audio 프로젝트');
  const [projectId, setProjectId] = useState('');
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const importInput = useRef(null);
  const refresh = async () => { const list = await listTavProjects(); setProjects(list); return list; };
  useEffect(() => { refresh().catch(error => setStatus(`저장소를 열지 못했습니다: ${error.message}`)); }, []);
  const run = async action => {
    setBusy(true); setStatus('');
    try { await action(); } catch (error) { setStatus(`프로젝트 처리 실패: ${error.message}`); }
    finally { setBusy(false); }
  };
  const save = async exporting => {
    const project = await createTavProject({ id: projectId, name, slots, settings });
    await saveTavProject(project);
    setProjectId(project.id); setSelected(project.id);
    await refresh();
    if (exporting) {
      const url = URL.createObjectURL(new Blob([JSON.stringify(project)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url;
      link.download = `${project.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')}.tav`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
    setStatus(exporting ? 'IndexedDB 저장 및 .tav 내보내기 완료' : 'IndexedDB에 프로젝트를 저장했습니다.');
  };
  const load = async project => {
    const restored = restoreTavProject(project, audioContextRef.current);
    try { await saveTavProject(project); }
    catch (error) {
      restored.slots.forEach(slot => { if (slot.backgroundVideo) URL.revokeObjectURL(slot.backgroundVideo); if (slot.videoResult) URL.revokeObjectURL(slot.videoResult.url); });
      throw error;
    }
    applyProject(restored); setProjectId(restored.id); setName(restored.name); setSelected(restored.id);
    await refresh(); setStatus(`프로젝트를 불러왔습니다 · 슬롯 ${restored.slots.length}개`);
  };
  return <details className={`tts-project-panel ${settings.isDarkMode ? 'is-dark' : ''}`}>
    <summary>
      <span className="tts-project-symbol" aria-hidden="true">▱</span>
      <span className="tts-project-heading"><strong>프로젝트 관리</strong><span>저장 · 내보내기 · 불러오기</span></span>
      <span className="tts-project-badge">{busy ? '처리 중' : '.tav'}</span>
      <span className="tts-project-chevron" aria-hidden="true">⌄</span>
    </summary>
    <div className="tts-project-content">
    <div className="tts-project-card">
      <h2>현재 프로젝트</h2>
      <p className="tts-project-hint">작업을 저장하거나 미디어가 포함된 파일로 내보내세요.</p>
      <label className="tts-project-name">프로젝트 이름<input aria-label="프로젝트 이름" value={name} onChange={e => setName(e.target.value)} disabled={busy} /></label>
      <div className="tts-project-row">
      <button className="tts-project-primary" type="button" disabled={busy} onClick={() => run(() => save(false))}>프로젝트 저장</button>
      <button type="button" disabled={busy} onClick={() => run(() => save(true))}>.tav 내보내기 <span aria-hidden="true">↗</span></button>
      </div>
    </div>
    <div className="tts-project-card">
      <div className="tts-project-card-heading"><h2>프로젝트 불러오기</h2><button className="tts-project-refresh" type="button" disabled={busy} onClick={() => run(refresh)}>목록 새로고침</button></div>
      <p className="tts-project-hint">이 브라우저에 저장한 작업 또는 .tav 파일을 여세요.</p>
      <select aria-label="IndexedDB 저장 프로젝트" value={selected} onChange={e => setSelected(e.target.value)} disabled={busy}>
        <option value="">{projects.length ? '저장된 프로젝트 선택' : '저장된 프로젝트가 없습니다'}</option>
        {projects.map(project => <option key={project.id} value={project.id}>{project.name} · {project.slotCount}개 슬롯 · {new Date(project.updatedAt).toLocaleString()}</option>)}
      </select>
      <div className="tts-project-row">
      <button type="button" disabled={busy || !selected} onClick={() => run(async () => { const project = await readTavProject(selected); if (!project) throw new Error('저장된 프로젝트를 찾지 못했습니다.'); await load(project); })}>저장 프로젝트 불러오기</button>
      <button type="button" disabled={busy} onClick={() => importInput.current.click()}>.tav 불러오기</button>
      <input ref={importInput} type="file" accept=".tav,application/json" hidden disabled={busy} onChange={e => {
        const file = e.target.files[0]; e.target.value = '';
        if (file) run(async () => load(JSON.parse(await file.text())));
      }} />
      </div>
    </div>
    </div>
    <p className="tts-project-status" role="status">{busy ? '프로젝트 처리 중…' : status}</p>
  </details>;
}

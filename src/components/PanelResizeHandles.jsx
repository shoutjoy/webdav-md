export default function PanelResizeHandles() {
  const edges = { left: '왼쪽', right: '오른쪽', top: '위쪽', bottom: '아래쪽', 'top-right': '오른쪽 위 모서리', 'bottom-right': '오른쪽 아래 모서리' };
  return <>{Object.entries(edges).map(([edge, label]) => <div key={edge} data-panel-edge={edge} className={`panel-resize-handle is-${edge}`} title={`${label}를 드래그하여 크기 조절`}><span /></div>)}</>;
}

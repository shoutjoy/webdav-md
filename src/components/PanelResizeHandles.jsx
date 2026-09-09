const EDGE_LABELS = { left: '왼쪽', right: '오른쪽', top: '위쪽', bottom: '아래쪽', 'top-right': '오른쪽 위 모서리', 'bottom-right': '오른쪽 아래 모서리' };

export default function PanelResizeHandles({ edges = Object.keys(EDGE_LABELS) }) {
  return <>{edges.map((edge) => <div key={edge} data-panel-edge={edge} className={`panel-resize-handle is-${edge}`} title={`${EDGE_LABELS[edge]}를 드래그하여 크기 조절`} role="separator" aria-orientation="vertical" aria-label={`MDPRO ${EDGE_LABELS[edge]} 크기 조절`}><span /></div>)}</>;
}

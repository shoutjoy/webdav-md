let pending;
export function loadCore() {
    if (!pending) pending = import('./vendor/core/rhwp.js').then(async core => {
        await core.default();
        return core;
    }).catch(error => { pending = null; throw error; });
    return pending;
}
export const MAX_FILE_BYTES = 256 * 1024 * 1024;
export function checkInput(bytes, name) {
    if (!bytes.length) throw new Error('빈 한글 파일입니다.');
    if (bytes.length > MAX_FILE_BYTES) throw new Error('한글 파일은 256MB 이하만 열 수 있습니다.');
    const ext = String(name).split('.').pop().toLowerCase();
    const cfb = [208,207,17,224,161,177,26,225].every((v,i) => bytes[i] === v);
    const zip = bytes[0] === 80 && bytes[1] === 75 && bytes[2] === 3 && bytes[3] === 4;
    if ((ext === 'hwp' && !cfb) || (ext === 'hwpx' && !zip) || !['hwp','hwpx'].includes(ext)) {
        throw new Error('확장자와 파일 내용이 다르거나 지원하지 않는 형식입니다. HWP 5.x / HWPX 파일을 선택하세요.');
    }
    if (zip) checkZipDirectory(bytes);
    // ZIP and CFB member validation is performed by the native parser, not the extension.
}
function checkZipDirectory(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let end = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
        if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
    }
    if (end < 0) throw new Error('손상된 ZIP/HWPX 파일입니다.');
    const count = view.getUint16(end + 10, true);
    let pos = view.getUint32(end + 16, true), total = 0;
    if (count > 10000 || count === 65535 || view.getUint16(end+4,true) !== 0) throw new Error('ZIP64 또는 분할/과대 ZIP은 지원하지 않습니다.');
    const names = new Set();
    for (let i = 0; i < count; i++) {
        if (pos + 46 > end || view.getUint32(pos,true) !== 0x02014b50) throw new Error('손상된 ZIP 디렉터리입니다.');
        const size = view.getUint32(pos+24,true), length = view.getUint16(pos+28,true);
        const next = pos + 46 + length + view.getUint16(pos+30,true) + view.getUint16(pos+32,true);
        if (next > end) throw new Error('잘린 ZIP 디렉터리입니다.');
        total += size;
        if (size === 0xffffffff || total > 256 * 1024 * 1024) throw new Error('HWPX 압축 해제 용량은 256MB 이하만 지원합니다.');
        names.add(new TextDecoder().decode(bytes.subarray(pos+46,pos+46+length)));
        pos = next;
    }
    if (!['Contents/header.xml','Contents/section0.xml','Contents/content.hpf'].every(name => names.has(name))) throw new Error('일반 ZIP 파일입니다. HWPX 문서 구조가 없습니다.');
}
export function serialize(doc, format = 'hwpx') {
    const output = format === 'hwp' ? doc.exportHwpWithReport() : doc.exportHwpxWithReport();
    try {
        const report = JSON.parse(output.contentLoss());
        if (report.count !== 0 || !Array.isArray(report.losses) || report.losses.length) {
            throw new Error('내용 손실로 저장을 중단했습니다: ' + JSON.stringify(report));
        }
        const bytes = output.takeBytes();
        if (!bytes.length) throw new Error('빈 파일은 저장할 수 없습니다.');
        return bytes;
    } finally { output.free(); }
}

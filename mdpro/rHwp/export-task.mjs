// Bound every asynchronous read so a hung image/storage/module read cannot
// leave the export lock held forever. This does not interrupt synchronous WASM.
export function waitForExportStep(task, {signal, timeoutMs = 20000, label = '변환'} = {}) {
    return new Promise((resolve,reject) => {
        let timer;
        const finish = (callback,value) => {
            clearTimeout(timer);
            signal?.removeEventListener('abort',abort);
            callback(value);
        };
        const abort = () => finish(reject,signal.reason || new DOMException('내보내기를 중지했습니다.','AbortError'));
        if (signal?.aborted) {abort();return;}
        signal?.addEventListener('abort',abort,{once:true});
        timer = setTimeout(() => finish(reject,new Error(label+' 작업이 지연되어 중단했습니다. 다시 시도하세요.')),timeoutMs);
        Promise.resolve(task).then(value=>finish(resolve,value),error=>finish(reject,error));
    });
}

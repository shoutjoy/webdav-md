export class HwpReader {
    constructor(){
        this.worker=new Worker(new URL('./hwp-reader.worker.mjs?v=20261104-large-1',import.meta.url),{type:'module'});
        this.jobs=new Map();this.sequence=0;
        this.worker.onmessage=({data})=>{
            const job=this.jobs.get(data.id);if(!job)return;
            if(data.type==='progress'){job.progress?.(data.phase);return;}
            clearTimeout(job.timer);this.jobs.delete(data.id);
            if(data.type==='error')job.reject(new Error(data.error));else job.resolve(data.result);
        };
        this.worker.onerror=event=>this.close(new Error(event.message||'한글 작업 스레드를 불러오지 못했습니다.'));
    }
    request(action,payload={},progress){
        if(!this.worker)return Promise.reject(new Error('닫힌 한글 문서입니다.'));
        const id=++this.sequence;
        return new Promise((resolve,reject)=>{
            const timer=setTimeout(()=>this.close(new Error('한글 문서 처리가 지연되어 중단했습니다. 다시 열어주세요.')),120000);
            this.jobs.set(id,{resolve,reject,timer,progress});
            try{this.worker.postMessage({id,action,...payload});}catch(error){clearTimeout(timer);this.jobs.delete(id);reject(error);}
        });
    }
    open(file,progress){return this.request('open',{file},progress);}
    page(page){return this.request('page',{page});}
    export(format){return this.request('export',{format});}
    close(error=new DOMException('한글 문서 열기를 중지했습니다.','AbortError')){
        this.worker?.terminate();this.worker=null;
        for(const job of this.jobs.values()){clearTimeout(job.timer);job.reject(error);}this.jobs.clear();
    }
}

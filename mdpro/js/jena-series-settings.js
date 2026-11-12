(function (root) {
    'use strict';
    const key='mdpro_webdav_macro_jena_enabled_v1';
    root.advancedAiFeatureFlags=Object.assign({},root.advancedAiFeatureFlags,{macroJena:root.localStorage.getItem(key)==='true'});
    function apply(enabled) {
        root.advancedAiFeatureFlags.macroJena=enabled===true;
        const input=document.getElementById('macro-jena-enabled');
        if(input)input.checked=enabled===true;
        if(!enabled && root.MacroJena)root.MacroJena.disable();
    }
    root.setWebdavMacroJenaEnabled=function(enabled){
        root.localStorage.setItem(key,String(enabled===true)); apply(enabled);
        if(typeof root.setAiSettings==='function') root.setAiSettings({macroJenaEnabled:enabled===true}).catch(error=>{
            if(root.showToast)root.showToast('Jena Macro 설정은 현재 브라우저에 보관했습니다. inDB 저장 실패: '+error.message);
        });
    };
    if(root.localStorage.getItem(key)===null && typeof root.getAiSettings==='function') {
        root.getAiSettings().then(settings=>{
            if(root.localStorage.getItem(key)!==null || !settings || typeof settings.macroJenaEnabled!=='boolean')return;
            root.localStorage.setItem(key,String(settings.macroJenaEnabled));apply(settings.macroJenaEnabled);
        }).catch(()=>{});
    }
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>apply(root.advancedAiFeatureFlags.macroJena));
    else apply(root.advancedAiFeatureFlags.macroJena);
})(window);

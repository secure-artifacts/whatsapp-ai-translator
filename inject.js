// 核心拦截器：必须在主世界 (Main World) 运行才能拦截到真实的 window.URL
const originalCreateObjectURL = window.URL.createObjectURL;

window.URL.createObjectURL = function(obj) {
    const url = originalCreateObjectURL.apply(this, arguments);
    
    if (obj && obj instanceof Blob) {
        const mime = obj.type || '';
        const size = obj.size || 0;
        
        // 严格过滤：只处理真正的音频文件
        // 1. MIME 类型必须包含 audio（排除图片、视频缩略图、UI 资源等）
        // 2. 文件大小必须 >= 5KB（排除空 Blob 和微型 UI 资源）
        const isAudio = mime.startsWith('audio/');
        const isLargeEnough = size >= 5 * 1024; // 5KB
        
        if (isAudio && isLargeEnough) {
            const reader = new FileReader();
            reader.onloadend = () => {
                window.postMessage({ 
                    type: 'WA_BLOB_CAPTURED', 
                    url: url, 
                    mimeType: mime,
                    size: size,
                    base64: reader.result
                }, '*');
            };
            reader.readAsDataURL(obj);
        }
    }
    
    return url;
};

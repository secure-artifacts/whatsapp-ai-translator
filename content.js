// 🚀 核心黑科技：通过外部文件注入脚本到主世界，绕过 WhatsApp 的严格安全策略 (CSP)
const interceptorScript = document.createElement('script');
interceptorScript.src = chrome.runtime.getURL('inject.js');
interceptorScript.onload = function() {
    this.remove(); // 注入完成后即刻销毁标签，做到无痕潜入
};
(document.head || document.documentElement).appendChild(interceptorScript);

// 音频存储：始终保存最新截获的语音（无任何条件门控，绝不丢弃）
let latestAudioBase64 = null;
// 容器→音频 映射表：记住每个气泡容器对应的音频（防止串台）
const containerAudioMap = new Map();
let lastClickedContainer = null;

// 1. 监听点击，记录最近点击的消息容器
document.addEventListener('click', (e) => {
    const c = e.target.closest('[data-testid="msg-container"]') 
           || e.target.closest('div.message-in') 
           || e.target.closest('div.message-out');
    if (c) lastClickedContainer = c;
}, true);

// 2. 接收主世界拦截到的底层语音数据
window.addEventListener('message', (event) => {
    if (event.source === window && event.data && event.data.type === 'WA_BLOB_CAPTURED') {
        if (event.data.base64) {
            // 无条件存入全局，绝不丢弃！
            latestAudioBase64 = event.data.base64;
            // 同时尝试绑定到最近点击的容器（用于精准匹配）
            if (lastClickedContainer) {
                containerAudioMap.set(lastClickedContainer, event.data.base64);
            }
        }
    }
});

// 全局状态管理
let translationState = {
  text: "",
  translated: "",
  isOpen: false
};

// ... skipping middle lines to keep them intact ...

// 核心初始化：监听页面 DOM 变化，寻找底部栏并注入专属的独立翻译输入框
const observer = new MutationObserver(() => {
  injectAIFooter();
  injectVoiceButtons();
});
observer.observe(document.body, { childList: true, subtree: true });

// =============================================
//  ✨ 划词翻译功能：选中文字后出现翻译小气泡
// =============================================
(function initSelectionTranslate() {
    // 创建悬浮图标按钮
    const floatingBtn = document.createElement('div');
    floatingBtn.id = 'ai-selection-btn';
    floatingBtn.innerHTML = `<img src="${chrome.runtime.getURL('icon32.png')}" style="width:20px;height:20px;vertical-align:middle;margin-right:5px;border-radius:4px;">译`;
    floatingBtn.style.cssText = `
        position: fixed; z-index: 2147483647; display: none;
        background: linear-gradient(135deg, #00a884, #007a63);
        color: #fff; font-size: 13px; font-weight: bold;
        padding: 5px 11px; border-radius: 20px;
        box-shadow: 0 3px 12px rgba(0,168,132,0.5);
        cursor: pointer; user-select: none;
        align-items: center;
        white-space: nowrap;
        transition: transform 0.1s ease, box-shadow 0.1s ease;
    `;
    document.body.appendChild(floatingBtn);

    // 创建翻译结果弹窗
    const resultPopup = document.createElement('div');
    resultPopup.id = 'ai-selection-popup';
    resultPopup.style.cssText = `
        position: fixed; z-index: 2147483646; display: none;
        background: #fff; color: #111b21;
        padding: 12px 16px; border-radius: 12px;
        box-shadow: 0 6px 24px rgba(0,0,0,0.2);
        max-width: 320px; min-width: 160px;
        font-size: 14px; line-height: 1.6;
        border-left: 4px solid #00a884;
    `;
    document.body.appendChild(resultPopup);

    let pendingSelection = '';
    let hideTimer = null;

    // 监听鼠标抬起事件：判断是否有文字被选中
    document.addEventListener('mouseup', (e) => {
        // 防止点击我们自己的按钮时触发
        if (e.target.closest('#ai-selection-btn') || e.target.closest('#ai-selection-popup')) return;

        setTimeout(() => {
            const sel = window.getSelection();
            const selectedText = sel ? sel.toString().trim() : '';

            if (selectedText.length > 1) {
                pendingSelection = selectedText;
                // 定位到鼠标抬起的位置附近
                const x = Math.min(e.clientX + 8, window.innerWidth - 100);
                const y = Math.max(e.clientY - 40, 10);
                floatingBtn.style.left = x + 'px';
                floatingBtn.style.top = y + 'px';
                floatingBtn.style.display = 'flex';
                resultPopup.style.display = 'none'; // 每次选新文字时收起旧结果
            } else {
                hideAll();
            }
        }, 10);
    });

    // 点击其他地方时收起
    document.addEventListener('mousedown', (e) => {
        if (e.target.closest('#ai-selection-btn') || e.target.closest('#ai-selection-popup')) return;
        hideAll();
    });

    function hideAll() {
        floatingBtn.style.display = 'none';
        resultPopup.style.display = 'none';
        pendingSelection = '';
    }

    // 点击翻译图标
    floatingBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!pendingSelection) return;

        const textToTranslate = pendingSelection;
        floatingBtn.style.display = 'none';

        // 展示加载中状态
        resultPopup.innerHTML = `<span style="color:#00a884;font-weight:bold;">🤖 翻译中...</span>`;
        const btnRect = floatingBtn.getBoundingClientRect();
        resultPopup.style.left = floatingBtn.style.left;
        resultPopup.style.top = (parseInt(floatingBtn.style.top) + 36) + 'px';
        resultPopup.style.display = 'block';

        chrome.runtime.sendMessage({ action: 'translate', text: textToTranslate, isBackTranslation: true }, (resp) => {
            if (resp && resp.success) {
                resultPopup.innerHTML = `
                    <div style="color:#8696a0;font-size:11px;margin-bottom:6px;">原文</div>
                    <div style="color:#111b21;font-size:13px;font-style:italic;border-bottom:1px solid #f0f2f5;padding-bottom:8px;margin-bottom:8px;">"${textToTranslate.length > 80 ? textToTranslate.slice(0,80)+'…' : textToTranslate}"</div>
                    <div style="color:#8696a0;font-size:11px;margin-bottom:4px;">译文</div>
                    <div style="color:#00a884;font-weight:bold;font-size:15px;">${resp.data.text}</div>
                    <div style="margin-top:8px;text-align:right;">
                        <span id="ai-sel-copy" style="font-size:11px;color:#8696a0;cursor:pointer;padding:2px 8px;border:1px solid #e9edef;border-radius:10px;">📋 复制</span>
                    </div>
                `;
                document.getElementById('ai-sel-copy')?.addEventListener('click', () => {
                    navigator.clipboard.writeText(resp.data.text);
                    document.getElementById('ai-sel-copy').textContent = '✅ 已复制';
                });
            } else {
                resultPopup.innerHTML = `<span style="color:#ff5252;">❌ 翻译失败: ${resp?.error || '未知错误'}</span>`;
            }
        });
    });

    // 鼠标悬停按钮效果
    floatingBtn.addEventListener('mouseenter', () => {
        floatingBtn.style.transform = 'scale(1.08)';
        floatingBtn.style.boxShadow = '0 5px 16px rgba(0,168,132,0.7)';
    });
    floatingBtn.addEventListener('mouseleave', () => {
        floatingBtn.style.transform = 'scale(1)';
        floatingBtn.style.boxShadow = '0 3px 12px rgba(0,168,132,0.5)';
    });
})();



// 注入独立的 AI 翻译输入区域 (彻底与 WhatsApp 原生输入框物理隔离)
function injectAIFooter() {
  const footer = document.querySelector('#main footer') || document.querySelector('footer');
  if (footer && !document.getElementById('ai-translator-root')) {
    
    // 破解 WhatsApp 的 CSS Grid 布局：
    // 我们强制原生 footer 允许“多行换行 (flex-wrap)”。
    // 这样，当我们把 100% 宽度的 AI 框塞进去时，它会被原生挤到新的一行（即最底下），而不会破坏排版。
    footer.style.flexWrap = 'wrap';

    // 创建一个完全独立的输入区块
    const root = document.createElement('div');
    root.id = 'ai-translator-root';
    root.className = 'ai-translator-root';
    root.innerHTML = `
      <div style="display:flex; align-items:center; width:100%; gap:6px; box-sizing:border-box;">
        <input type="text" class="ai-fake-input" id="ai-fake-input" placeholder="💡 在此输入或点击🎙️录音 (回车翻译，再回车发送)" autocomplete="off" style="flex:1; min-width:0;" />
        <button id="ai-mic-btn" title="点击录音，说完后再点停止" style="
          flex-shrink:0; width:36px; height:36px; border-radius:50%; border:none; cursor:pointer;
          background: #00a884; color:#fff; font-size:18px; display:flex; align-items:center; justify-content:center;
          box-shadow: 0 2px 8px rgba(0,168,132,0.4); transition: background 0.2s, transform 0.1s;
        ">🎙️</button>
      </div>
      <div id="ai-recording-bar" style="display:none; align-items:center; gap:8px; padding:4px 0; color:#ff5252; font-size:12px; font-weight:bold;">
        <span style="width:8px;height:8px;border-radius:50%;background:#ff5252;display:inline-block;animation:ai-pulse 1s infinite;"></span>
        <span id="ai-rec-timer">● 录音中 0s (再次点击🎙️停止录音并翻译)</span>
      </div>
      <div class="ai-inline-panel" id="ai-inline-panel" style="display:none;">
        <div class="ai-inline-status ai-status-text"></div>
        <div class="ai-inline-text ai-translation-text" style="font-weight:bold;"></div>
        
        <div class="backtrans-box" style="display:none; margin-top: 5px;">
          <div class="ai-inline-status">安全回译 (中文):</div>
          <div class="ai-inline-text ai-backtranslation-text" style="color: #888;"></div>
        </div>
        
        <div class="ai-inline-actions">
          <button class="ai-pill-btn ai-copy-btn">复制翻译</button>
          <button class="ai-pill-btn ai-save-btn">保存到词库</button>
        </div>
      </div>
    `;
    
    // 注入 CSS 动画（录音脉冲）
    if (!document.getElementById('ai-pulse-style')) {
      const style = document.createElement('style');
      style.id = 'ai-pulse-style';
      style.textContent = `@keyframes ai-pulse { 0%,100%{opacity:1;} 50%{opacity:0.2;} }`;
      document.head.appendChild(style);
    }
    
    // 把我们的框注入到原生 footer 内部，利用 flex-wrap 自动折行到原生输入框的下方
    footer.appendChild(root);

    const fakeInput = root.querySelector('#ai-fake-input');
    const panel = root.querySelector('#ai-inline-panel');
    const micBtn = root.querySelector('#ai-mic-btn');
    const recordingBar = root.querySelector('#ai-recording-bar');
    const recTimer = root.querySelector('#ai-rec-timer');

    // ============================================================
    //  🎙️ 麦克风录音逻辑
    // ============================================================
    let mediaRecorder = null;
    let audioChunks = [];
    let recSeconds = 0;
    let recInterval = null;

    micBtn.addEventListener('click', async () => {
      // 如果正在录音，点击就停止
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        return;
      }

      // 请求麦克风权限
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        alert('⚠️ 麦克风权限被拒绝！\n\n请在浏览器地址栏左侧点击🔒图标，将麦克风权限设置为"允许"，然后刷新页面。');
        return;
      }

      // 开始录音
      audioChunks = [];
      recSeconds = 0;
      
      // 优先使用 ogg/opus (适配 Groq Whisper)，降级到 webm
      const mimeType = MediaRecorder.isTypeSupported('audio/ogg;codecs=opus') 
          ? 'audio/ogg;codecs=opus' 
          : 'audio/webm;codecs=opus';
      
      mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
      
      mediaRecorder.onstop = async () => {
        // 停止麦克风流
        stream.getTracks().forEach(t => t.stop());
        clearInterval(recInterval);
        
        // 更新UI：停止录音状态
        micBtn.innerHTML = '🎙️';
        micBtn.style.background = '#00a884';
        micBtn.style.animation = '';
        recordingBar.style.display = 'none';

        if (audioChunks.length === 0) return;

        // 把录音 Blob 转成 base64
        const audioBlob = new Blob(audioChunks, { type: mimeType });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Audio = reader.result;
          
          // 展示"翻译中"状态
          panel.style.display = 'block';
          root.querySelector('.ai-status-text').innerText = '🎤 识别语音中... (Groq Whisper)';
          root.querySelector('.ai-translation-text').innerText = '';
          root.querySelector('.backtrans-box').style.display = 'none';
          translationState.isOpen = false;

          // 发给 background.js 处理 — isOutgoing:true 表示这是"发出"方向，要翻成目标外语
          chrome.runtime.sendMessage({ action: 'transcribe_audio', audioData: base64Audio, isOutgoing: true }, (resp) => {
            if (resp && resp.success) {
              const original = resp.data.original;
              const translated = resp.data.translated;
              
              // 填充输入框（方便用户看到/修改）
              fakeInput.value = original;
              
              // 展示双语对照
              translationState.translated = translated;
              translationState.isOpen = true;
              root.querySelector('.ai-status-text').innerText = `🎤 原文识别: "${original.length > 60 ? original.slice(0,60)+'…' : original}"`;
              root.querySelector('.ai-translation-text').innerText = `📝 ${translated}`;
              root.querySelector('.backtrans-box').style.display = 'none';
              root.querySelector('.ai-status-text').style.color = '#00a884';
              root.querySelector('.ai-status-text').insertAdjacentHTML('beforeend', 
                `<span style="color:#667781;margin-left:8px;font-size:11px;">↩ 按回车发送</span>`);
              
              // 自动聚焦输入框（方便直接回车发送）
              fakeInput.focus();
            } else {
              panel.style.display = 'block';
              root.querySelector('.ai-status-text').innerText = `❌ 识别失败: ${resp?.error || '请检查 Groq API Key 是否配置'}`;
              root.querySelector('.ai-status-text').style.color = '#ff5252';
            }
          });
        };
      };

      mediaRecorder.start(100); // 每 100ms 收集一次数据块

      // 更新UI：录音中状态
      micBtn.innerHTML = '⏹';
      micBtn.style.background = '#ff5252';
      recordingBar.style.display = 'flex';
      recTimer.textContent = `● 录音中 0s (再次点击 ⏹ 停止录音并翻译)`;
      
      recInterval = setInterval(() => {
        recSeconds++;
        recTimer.textContent = `● 录音中 ${recSeconds}s (再次点击 ⏹ 停止录音并翻译)`;
        // 超过 60 秒自动停止 (Groq Whisper 限制)
        if (recSeconds >= 60) {
          mediaRecorder.stop();
          clearInterval(recInterval);
        }
      }, 1000);
    });



    // 监听我们自己专属输入框的回车事件
    fakeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        
        if (translationState.isOpen && translationState.translated) {
          // ==============================
          // 第二次回车：执行写入原生框并发送！
          // ==============================
          sendToWhatsApp(translationState.translated);
          
          // 发送完毕后，重置我们的假输入框
          fakeInput.value = '';
          panel.style.display = 'none';
          translationState = { text: "", translated: "", isOpen: false };
        } else {
          // ==============================
          // 第一次回车：执行翻译！
          // ==============================
          const text = fakeInput.value.trim();
          if (text) {
            translationState.text = text;
            translationState.isOpen = true;
            panel.style.display = 'block';
            root.querySelector('.ai-status-text').innerText = '翻译中...';
            root.querySelector('.ai-translation-text').innerText = '';
            root.querySelector('.backtrans-box').style.display = 'none';

            // 发起主翻译
            chrome.runtime.sendMessage({ action: 'translate', text: text, isBackTranslation: false }, (res) => {
              if (res && res.success) {
                translationState.translated = res.data.text;
                root.querySelector('.ai-status-text').innerText = '翻译完成 (再次回车直接发送)';
                root.querySelector('.ai-translation-text').innerText = res.data.text;

                // 发起回译
                root.querySelector('.backtrans-box').style.display = 'block';
                root.querySelector('.ai-backtranslation-text').innerText = "回译中...";
                chrome.runtime.sendMessage({ action: 'translate', text: res.data.text, isBackTranslation: true }, (backRes) => {
                  if (backRes && backRes.success) {
                    root.querySelector('.ai-backtranslation-text').innerText = backRes.data.text;
                  }
                });
              } else {
                root.querySelector('.ai-status-text').innerText = '翻译失败，请检查日志';
                translationState.isOpen = false;
              }
            });
          }
        }
      }
    });

    // 如果用户修改了输入框的文字，自动折叠翻译面板
    fakeInput.addEventListener('input', () => {
      if (translationState.isOpen) {
        panel.style.display = 'none';
        translationState = { text: "", translated: "", isOpen: false };
      }
    });

    // 绑定按钮
    root.querySelector('.ai-copy-btn').onclick = () => {
      navigator.clipboard.writeText(translationState.translated);
      root.querySelector('.ai-copy-btn').innerText = '已复制';
    };
  }
}

// 终极发送方案：直接把翻译好的外文扔进完全空白的 WhatsApp 原生输入框，然后点击发送
function sendToWhatsApp(text) {
  const realInput = document.querySelector('footer div[contenteditable="true"]');
  if (!realInput) return;
  
  // 1. 获取 WhatsApp 原生输入框的焦点
  realInput.focus();
  
  // 2. 原生输入框此刻是100%纯净空白的！我们直接无脑插入文字即可，React 绝对不会报错
  document.execCommand('insertText', false, text);
  
  // 3. 等待极短时间让 React 更新内部数据，然后点击真实的发送按钮
  setTimeout(() => {
    let sendBtn = document.querySelector('footer button[aria-label="Send"]') || 
                  document.querySelector('footer button[aria-label="发送"]') || 
                  document.querySelector('footer button[aria-label="傳送"]');
    
    if (!sendBtn) {
      const sendIcon = document.querySelector('footer span[data-icon="send"]');
      if (sendIcon) sendBtn = sendIcon.closest('button') || sendIcon.parentElement;
    }

    if (sendBtn) {
      // 模拟物理鼠标点击
      sendBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      sendBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      sendBtn.click();
    } else {
      // 兜底回车
      realInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
    }
  }, 100); 
}

// 语音翻译按钮 (适配最新版 WhatsApp Web 的极简 DOM 结构)
function injectVoiceButtons() {
  // 极其暴力的查询：囊括所有可能的播放按钮、语音容器属性
  const playSelectors = [
    'span[data-icon="audio-play"]',
    'span[data-icon="audio-pause"]',
    'button[aria-label*="Play"]',
    'button[aria-label*="播放"]',
    'div[data-testid="audio-message"]',
    'div[data-testid="msg-audio"]'
  ];
  
  const elements = document.querySelectorAll(playSelectors.join(', '));
  
  elements.forEach(el => {
    // 向上寻找整个消息气泡的最外层容器
    let container = el.closest('[data-testid="msg-container"]') || el.closest('div.message-in, div.message-out');
    
    // 如果实在找不到标准气泡，就往上找 3 层作为兜底
    if (!container) {
      container = el.parentElement?.parentElement?.parentElement;
    }
    
    if (!container) return;

    // 避免重复注入
    if (!container.querySelector('.ai-voice-btn')) {
      container.style.position = 'relative';
      
      const btn = document.createElement('button');
      btn.className = 'ai-voice-btn';
      btn.innerHTML = '🤖 翻译语音';
      
      btn.style.cssText = 'position: absolute; right: -85px; top: 50%; transform: translateY(-50%); background: #00a884; color: #fff; border: none; border-radius: 20px; padding: 6px 12px; cursor: pointer; font-size: 13px; font-weight: bold; box-shadow: 0 2px 5px rgba(0,0,0,0.2); z-index: 9999; white-space: nowrap; width: max-content; display: flex; align-items: center; justify-content: center;';
      btn.title = '转录并翻译这段语音';

      const msgNode = el.closest('[data-id]');
      let closureMsgId = msgNode ? msgNode.getAttribute('data-id') : null;

      btn.onclick = async () => {
        let base64Audio = null;

        // 策略1：精准匹配——从容器Map里找这个气泡专属的音频
        if (containerAudioMap.has(container)) {
            base64Audio = containerAudioMap.get(container);
        }

        // 策略2：兜底——用最近一次截获的全局音频
        // （适用于：切换聊天框后回来，WhatsApp 用缓存播放，没有触发新的截获）
        if (!base64Audio) {
            base64Audio = latestAudioBase64;
        }

        if (!base64Audio) {
            alert('⚠️ 尚未截获到语音！\n\n请先点击一下 ▶️ 播放键，声音一响后立刻点击翻译按钮！');
            return;
        }

        let resultDiv = container.querySelector('.ai-voice-result');
        if (!resultDiv) {
            resultDiv = document.createElement('div');
            resultDiv.className = 'ai-voice-result';
            resultDiv.style.cssText = 'margin-top: 8px; padding: 10px; background: rgba(0, 168, 132, 0.1); border-left: 4px solid #00a884; border-radius: 4px; font-size: 13px; line-height: 1.5; clear: both; width: 100%; box-sizing: border-box;';
            container.appendChild(resultDiv);
        }
        resultDiv.innerHTML = '<span style="color:#00a884; font-weight:bold;">🤖 正在提取并翻译语音，请耐心等待...</span>';

        try {
            // 直接发送给后台，彻底跳过容易被跨域/跨世界隔离拦截的 fetch(blob)
            chrome.runtime.sendMessage({ action: 'transcribe_audio', audioData: base64Audio }, (resp) => {
                if (resp && resp.success) {
                    resultDiv.innerHTML = `
                        <div style="color:#667781; font-size:12px; margin-bottom:6px; font-style:italic; border-bottom: 1px dashed #ccc; padding-bottom: 4px;">🎤 原文: "${resp.data.original}"</div>
                        <div style="color:#111b21; font-weight:bold; font-size:14px;">📝 译文: ${resp.data.translated}</div>
                    `;
                } else {
                    resultDiv.innerHTML = `<span style="color:#ff5252; font-weight:bold;">❌ 翻译失败: ${resp ? resp.error : '未知错误'}</span>`;
                }
            });
        } catch (e) {
            resultDiv.innerHTML = `<span style="color:#ff5252; font-weight:bold;">❌ 发送请求失败: ${e.message}</span>`;
        }
      };

      container.appendChild(btn);
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const urlInput = document.getElementById('api-url');
  const keysInput = document.getElementById('api-keys');
  const modelInput = document.getElementById('model-name');
  const targetLangSelect = document.getElementById('target-lang');
  const groqKeyInput = document.getElementById('groq-key');
  const useEmojiCheckbox = document.getElementById('use-emoji');
  const logContent = document.getElementById('log-content');

  // 打开新手教程
  document.getElementById('open-guide').addEventListener('click', () => {
    chrome.tabs.create({ url: 'guide.html' });
  });

  // 切换高级设置
  document.getElementById('toggle-advanced').addEventListener('click', (e) => {
    e.preventDefault();
    const adv = document.getElementById('advanced-settings');
    if (adv.style.display === 'none') {
      adv.style.display = 'block';
      e.target.innerText = '⚙️ 收起高级设置';
    } else {
      adv.style.display = 'none';
      e.target.innerText = '⚙️ 展开高级设置 (用于切换云端中转 API)';
    }
  });

  // 载入已有配置
  chrome.storage.local.get(['apiUrl', 'apiKeys', 'modelName', 'targetLang', 'groqApiKey', 'useEmoji', 'appLogs'], (result) => {
    urlInput.value = result.apiUrl || '';
    keysInput.value = (result.apiKeys || []).join('\n');
    modelInput.value = result.modelName || '';
    targetLangSelect.value = result.targetLang || 'Portuguese';
    groqKeyInput.value = result.groqApiKey || '';
    useEmojiCheckbox.checked = result.useEmoji || false;

    renderLogs(result.appLogs || []);
  });

  // 保存配置
  document.getElementById('save-btn').addEventListener('click', () => {
    const keysArray = keysInput.value.split('\n').map(k => k.trim()).filter(k => k);
    
    chrome.storage.local.set({
      apiUrl: urlInput.value.trim(),
      apiKeys: keysArray,
      modelName: modelInput.value.trim(),
      targetLang: targetLangSelect.value,
      groqApiKey: groqKeyInput.value.trim(),
      useEmoji: useEmojiCheckbox.checked
    }, () => {
      const status = document.getElementById('status');
      status.textContent = '设置已保存！';
      status.style.display = 'block';
      setTimeout(() => { status.style.display = 'none'; }, 2000);
    });
  });

  // 刷新日志
  document.querySelector('.log-title').addEventListener('click', () => {
    chrome.storage.local.get(['appLogs'], (res) => {
      renderLogs(res.appLogs || []);
    });
  });

  // 清空日志
  document.getElementById('clear-log-btn').addEventListener('click', () => {
    chrome.storage.local.set({ appLogs: [] }, () => {
      renderLogs([]);
    });
  });

  function renderLogs(logs) {
    if (logs.length === 0) {
      logContent.innerHTML = '<div style="color:#666;">暂无日志...</div>';
      return;
    }
    logContent.innerHTML = logs.map(log => {
      let color = '#ccc';
      if (log.type === 'error') color = '#ff5252';
      if (log.type === 'success') color = '#00e676';
      return `<div style="color:${color}; margin-bottom:4px; word-wrap: break-word;">[${log.time}] ${log.msg}</div>`;
    }).join('');
    logContent.scrollTop = logContent.scrollHeight;
  }
});

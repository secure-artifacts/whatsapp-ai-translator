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

  // =============================================
  //  📚 专属词库管理
  // =============================================
  const glossaryList = document.getElementById('glossary-list');
  const addForm = document.getElementById('add-glossary-form');

  function renderGlossary(glossary) {
    if (!glossary || glossary.length === 0) {
      glossaryList.innerHTML = '<div style="color:#666; text-align:center; padding:8px 0;">暂无词条，翻译后点击「✏️ 纠错」添加</div>';
      return;
    }
    glossaryList.innerHTML = glossary.map((g, i) => `
      <div style="display:flex; align-items:center; justify-content:space-between;
                  padding: 7px 10px; margin-bottom:5px;
                  background: rgba(255,255,255,0.05); border-radius:8px;
                  border-left: 3px solid #00a884;">
        <!-- 浏览模式 -->
        <div style="flex:1; min-width:0;" id="glossary-view-${i}">
          <span style="color:#00a884; font-weight:bold;">${escHtml(g.source)}</span>
          <span style="color:#667781; margin: 0 5px;">→</span>
          <span style="color:#e0e0e0;">${escHtml(g.target)}</span>
        </div>
        <!-- 编辑模式 -->
        <div style="flex:1; min-width:0; display:none; gap:4px; margin-right:6px;" id="glossary-edit-box-${i}">
          <input type="text" id="edit-src-${i}" value="${escHtml(g.source)}" style="width:40%; padding:3px 5px; font-size:12px; border:1px solid #00a884; border-radius:4px; outline:none;">
          <input type="text" id="edit-tgt-${i}" value="${escHtml(g.target)}" style="width:60%; padding:3px 5px; font-size:12px; border:1px solid #00a884; border-radius:4px; outline:none;">
        </div>
        
        <!-- 浏览模式按钮 -->
        <div style="flex-shrink:0; display:flex; gap:10px;" id="glossary-actions-view-${i}">
          <button data-idx="${i}" class="edit-glossary-btn" style="background:transparent; border:none; color:#00a884; font-size:14px; cursor:pointer; padding:0;" title="编辑">✏️</button>
          <button data-idx="${i}" class="del-glossary-btn" style="background:transparent; border:none; color:#ff5252; font-size:15px; cursor:pointer; padding:0; line-height:1;" title="删除">✕</button>
        </div>
        <!-- 编辑模式按钮 -->
        <div style="flex-shrink:0; display:none; gap:6px;" id="glossary-actions-edit-${i}">
          <button data-idx="${i}" class="save-edit-btn" style="background:#00a884; border:none; color:#fff; border-radius:4px; padding:3px 8px; font-size:12px; cursor:pointer; font-weight:bold;">保存</button>
          <button data-idx="${i}" class="cancel-edit-btn" style="background:transparent; border:1px solid #888; color:#aaa; border-radius:4px; padding:3px 8px; font-size:12px; cursor:pointer;">取消</button>
        </div>
      </div>
    `).join('');

    // 绑定删除按钮
    glossaryList.querySelectorAll('.del-glossary-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        chrome.storage.local.get(['customGlossary'], (res) => {
          const arr = res.customGlossary || [];
          arr.splice(idx, 1);
          chrome.storage.local.set({ customGlossary: arr }, () => renderGlossary(arr));
        });
      });
    });

    // 绑定编辑按钮 (进入编辑状态)
    glossaryList.querySelectorAll('.edit-glossary-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        document.getElementById(`glossary-view-${idx}`).style.display = 'none';
        document.getElementById(`glossary-actions-view-${idx}`).style.display = 'none';
        document.getElementById(`glossary-edit-box-${idx}`).style.display = 'flex';
        document.getElementById(`glossary-actions-edit-${idx}`).style.display = 'flex';
      });
    });

    // 绑定取消编辑按钮
    glossaryList.querySelectorAll('.cancel-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        document.getElementById(`glossary-view-${idx}`).style.display = 'block';
        document.getElementById(`glossary-actions-view-${idx}`).style.display = 'flex';
        document.getElementById(`glossary-edit-box-${idx}`).style.display = 'none';
        document.getElementById(`glossary-actions-edit-${idx}`).style.display = 'none';
      });
    });

    // 绑定保存编辑按钮
    glossaryList.querySelectorAll('.save-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        const newSrc = document.getElementById(`edit-src-${idx}`).value.trim();
        const newTgt = document.getElementById(`edit-tgt-${idx}`).value.trim();
        
        if (!newSrc || !newTgt) {
          if (!newSrc) document.getElementById(`edit-src-${idx}`).style.borderColor = '#ff5252';
          if (!newTgt) document.getElementById(`edit-tgt-${idx}`).style.borderColor = '#ff5252';
          return;
        }

        chrome.storage.local.get(['customGlossary'], (res) => {
          const arr = res.customGlossary || [];
          if (arr[idx]) {
            arr[idx].source = newSrc;
            arr[idx].target = newTgt;
            chrome.storage.local.set({ customGlossary: arr }, () => renderGlossary(arr));
          }
        });
      });
    });
  }

  function escHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // 首次加载词库
  chrome.storage.local.get(['customGlossary'], (res) => renderGlossary(res.customGlossary || []));

  // 显示/隐藏手动添加表单
  document.getElementById('add-glossary-btn').addEventListener('click', () => {
    addForm.style.display = addForm.style.display === 'none' ? 'block' : 'none';
  });
  document.getElementById('cancel-add-glossary').addEventListener('click', () => {
    addForm.style.display = 'none';
    document.getElementById('new-source').value = '';
    document.getElementById('new-target').value = '';
  });

  // 确认手动添加
  document.getElementById('confirm-add-glossary').addEventListener('click', () => {
    const src = document.getElementById('new-source').value.trim();
    const tgt = document.getElementById('new-target').value.trim();
    if (!src || !tgt) {
      if (!src) document.getElementById('new-source').style.borderColor = '#ff5252';
      if (!tgt) document.getElementById('new-target').style.borderColor = '#ff5252';
      return;
    }
    chrome.storage.local.get(['customGlossary'], (res) => {
      const arr = res.customGlossary || [];
      const existingIdx = arr.findIndex(g => g.source === src);
      const entry = { source: src, target: tgt, addedAt: Date.now() };
      if (existingIdx >= 0) arr[existingIdx] = entry;
      else arr.push(entry);
      chrome.storage.local.set({ customGlossary: arr }, () => {
        renderGlossary(arr);
        addForm.style.display = 'none';
        document.getElementById('new-source').value = '';
        document.getElementById('new-target').value = '';
        document.getElementById('new-source').style.borderColor = '';
        document.getElementById('new-target').style.borderColor = '';
      });
    });
  });

  // 清空全部词条
  document.getElementById('clear-glossary-btn').addEventListener('click', () => {
    if (!confirm('确定要清空全部专属词库吗？此操作不可撤销。')) return;
    chrome.storage.local.set({ customGlossary: [] }, () => renderGlossary([]));
  });
});


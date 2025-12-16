// AI quiz generation logic
(function () {
  'use strict';

  function initAiQuizSections() {
    const sections = document.querySelectorAll('[data-ai-quiz-root]');
    if (!sections.length) return;

    // 检测是否是主页，如果是主页则隐藏浮动按钮
    const isHomePage = window.location.pathname === '/' || window.location.pathname === '/index.html';

    sections.forEach(section => {
      // 获取并解码 HTML 实体编码的 URL
      let baseEndpoint = section.getAttribute('data-ai-quiz-endpoint');
      if (baseEndpoint) {
        // 解码 HTML 实体（如 &amp; -> &）
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = baseEndpoint;
        baseEndpoint = tempDiv.textContent || tempDiv.innerText || baseEndpoint;
      }

      const button = section.querySelector('[data-ai-quiz-trigger]');
      const statusEl = section.querySelector('[data-ai-quiz-status]');
      const resultsEl = section.querySelector('[data-ai-quiz-results]');
      const difficultySelect = section.querySelector('[data-ai-quiz-param="difficulty"]');
      const countSelect = section.querySelector('[data-ai-quiz-param="count"]');

      if (!button || !baseEndpoint || !resultsEl) return;

      // 如果是主页，隐藏浮动按钮
      if (isHomePage && button.classList.contains('ai-quiz-floating-button')) {
        button.style.display = 'none';
        return;
      }

      // 只在非主页页面初始化浮动按钮
      if (button.classList.contains('ai-quiz-floating-button')) {
        initFloatingButton(button);
      }

      // 页面加载时尝试加载已保存的内容
      loadQuizContent(baseEndpoint, resultsEl).catch(err => {
        console.warn('[AI Quiz] 加载已保存内容失败:', err);
      });

      button.addEventListener('click', async function () {
        button.disabled = true;
        setStatus(statusEl, '正在生成考题，请稍候…');

        try {
          // 获取用户选择的难度和数量
          const difficulty = difficultySelect ? difficultySelect.value : '中等';
          const count = countSelect ? countSelect.value : '3';

          // 构建完整的请求参数
          const requestParams = {
            mode: 'exam',
            query: '',
            difficulty: difficulty,
            count: count
          };

          // 输出调试信息
          console.log('[AI Quiz] 请求参数:', requestParams);
          console.log('[AI Quiz] 基础 URL:', baseEndpoint);

          const payload = await requestQuiz(baseEndpoint, requestParams);
          const content = payload?.data?.choices?.[0]?.message?.content;
          if (!content) {
            throw new Error('后端未返回考题内容');
          }
          appendQuizContent(resultsEl, content);
          setStatus(statusEl, `生成成功，已生成 ${count} 道${difficulty}难度的题目。`);

          // 自动保存生成的内容
          try {
            await saveQuizContent(baseEndpoint, content, { difficulty, count });
            console.log('[AI Quiz] 内容已保存到服务器');
          } catch (saveError) {
            console.warn('[AI Quiz] 保存失败（不影响使用）:', saveError);
          }
        } catch (error) {
          console.error('[AI Quiz]', error);
          setStatus(statusEl, '生成失败：' + error.message);
        } finally {
          button.disabled = false;
        }
      });
    });
  }

  function initFloatingButton(button) {
    if (!button || button.dataset.draggable === 'true') return;
    button.dataset.draggable = 'true';

    let isDragging = false;
    let dragMoved = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    let suppressClick = false;

    const onPointerDown = (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      isDragging = true;
      dragMoved = false;
      button.classList.add('is-dragging');
      // 开始拖动时，去掉 transform，改用 left/top 绝对定位，避免位置跳动
      button.style.transform = 'none';
      startX = event.clientX;
      startY = event.clientY;
      const rect = button.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      button.setPointerCapture?.(event.pointerId);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    };

    const onPointerMove = (event) => {
      if (!isDragging) return;
      dragMoved = true;
      event.preventDefault();
      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;
      const maxLeft = window.innerWidth - button.offsetWidth;
      const maxTop = window.innerHeight - button.offsetHeight;
      const nextLeft = clamp(startLeft + deltaX, 0, Math.max(0, maxLeft));
      const nextTop = clamp(startTop + deltaY, 0, Math.max(0, maxTop));
      button.style.left = `${nextLeft}px`;
      button.style.top = `${nextTop}px`;
      button.style.right = 'auto';
      button.style.bottom = 'auto';
    };

    const onPointerUp = (event) => {
      if (!isDragging) return;
      isDragging = false;
      button.classList.remove('is-dragging');
      button.releasePointerCapture?.(event.pointerId);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      if (dragMoved) {
        suppressClick = true;
        dragMoved = false;
        setTimeout(() => {
          suppressClick = false;
        }, 0);
      }
    };

    button.addEventListener('pointerdown', onPointerDown);
    button.addEventListener('click', (event) => {
      if (suppressClick) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function buildEndpointWithParams(baseEndpoint, difficulty, count) {
    if (!baseEndpoint) {
      throw new Error('基础 URL 不能为空');
    }

    try {
      // 清理 URL，移除可能的 HTML 标签或编码问题
      let cleanUrl = baseEndpoint.trim();
      // 移除 URL 中可能存在的 HTML 标签
      cleanUrl = cleanUrl.replace(/<[^>]*>/g, '');
      // 确保 URL 是完整的
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        throw new Error('URL 格式不正确');
      }

      const url = new URL(cleanUrl);
      // 设置新参数，会覆盖同名参数
      url.searchParams.set('difficulty', difficulty);
      url.searchParams.set('count', count);
      return url.toString();
    } catch (e) {
      console.error('[AI Quiz] URL 解析失败:', e, '原始 URL:', baseEndpoint);
      // 如果 URL 解析失败，使用字符串拼接方式
      let cleanUrl = baseEndpoint.trim().replace(/<[^>]*>/g, '');
      const separator = cleanUrl.includes('?') ? '&' : '?';
      // 移除末尾可能存在的无效字符
      cleanUrl = cleanUrl.replace(/[<>"']/g, '');
      return `${cleanUrl}${separator}difficulty=${encodeURIComponent(difficulty)}&count=${encodeURIComponent(count)}`;
    }
  }

  // 构建完整的 API URL
  function buildApiUrl(baseEndpoint, endpoint) {
    let cleanUrl = baseEndpoint.trim();
    cleanUrl = cleanUrl.replace(/<[^>]*>/g, '');

    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      throw new Error('URL 格式不正确: ' + cleanUrl);
    }

    const url = new URL(cleanUrl);
    // 确保 pathname 以 / 结尾，然后拼接 endpoint
    let pathname = url.pathname;
    if (!pathname.endsWith('/')) {
      pathname += '/';
    }
    // 移除末尾的 /，然后拼接 endpoint
    pathname = pathname.replace(/\/$/, '') + '/' + endpoint;

    return url.origin + pathname;
  }

  async function requestQuiz(endpoint, params) {
    try {
      // 构建 chat 端点的完整 URL
      const chatUrl = buildApiUrl(endpoint, 'chat');

      // 构建请求体，所有参数都在 POST 请求体中
      const requestBody = params || {};

      console.log('[AI Quiz] ====== 开始发送请求 ======');
      console.log('[AI Quiz] 请求方法: POST');
      console.log('[AI Quiz] 请求 URL:', chatUrl);
      console.log('[AI Quiz] 请求体:', requestBody);

      const fetchOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody)
      };

      console.log('[AI Quiz] Fetch 配置:', fetchOptions);

      const response = await fetch(chatUrl, fetchOptions);

      if (!response.ok) {
        throw new Error('服务返回错误状态：' + response.status);
      }

      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.message || '生成失败');
      }
      return payload;
    } catch (e) {
      console.error('[AI Quiz] POST 请求失败:', e);
      throw new Error('请求失败: ' + e.message);
    }
  }

  function setStatus(el, text) {
    if (el) {
      el.textContent = text;
    }
  }

  function appendQuizContent(container, rawContent) {
    const normalized = extractContent(rawContent);
    const nodes = normalized ? buildQuizNodes(normalized) : [];
    if (!nodes.length) {
      const fallback = document.createElement('div');
      fallback.className = 'ai-quiz-item';
      fallback.textContent = normalized || stringifySafe(rawContent);
      container.appendChild(fallback);
      return;
    }
    nodes.forEach(node => {
      container.appendChild(node);
      if (window.QuizApp && typeof window.QuizApp.init === 'function') {
        window.QuizApp.init(node);
      }
    });
    container.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function buildQuizNodes(rawContent) {
    const nodes = [];
    const trimmed = rawContent.trim();

    if (trimmed.startsWith('<')) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = trimmed;
      wrapper.querySelectorAll('.quiz-container').forEach(container => {
        const item = document.createElement('div');
        item.className = 'ai-quiz-item';
        item.appendChild(container);
        nodes.push(item);
      });
      if (nodes.length) return nodes;
    }

    const quizzes = parseQuizShortcodes(rawContent);
    quizzes.forEach(data => {
      const item = document.createElement('div');
      item.className = 'ai-quiz-item';
      item.appendChild(renderQuiz(data));
      nodes.push(item);
    });
    return nodes;
  }

  function parseQuizShortcodes(content) {
    const quizzes = [];
    const quizRegex = /{{<\s*quiz([^>]*)>}}([\s\S]*?){{<\s*\/quiz\s*>}}/g;
    let quizMatch;

    while ((quizMatch = quizRegex.exec(content)) !== null) {
      const attrs = parseAttributes(quizMatch[1]);
      const body = quizMatch[2];
      const options = [];
      const optionRegex = /{{<\s*quizoption([^>]*)>}}([\s\S]*?){{<\s*\/quizoption\s*>}}/g;
      let optionMatch;

      while ((optionMatch = optionRegex.exec(body)) !== null) {
        const optionAttrs = parseAttributes(optionMatch[1]);
        options.push({
          value: optionAttrs.value || '',
          explanation: optionAttrs.explanation || '',
          content: optionMatch[2].trim()
        });
      }

      quizzes.push({
        id: attrs.id || '',
        question: attrs.question || '',
        correct: attrs.correct || '',
        options
      });
    }

    return quizzes;
  }

  function parseAttributes(raw) {
    const attrs = {};
    const regex = /([a-zA-Z0-9_-]+)\s*=\s*"([^"]*)"/g;
    let match;
    while ((match = regex.exec(raw)) !== null) {
      attrs[match[1]] = match[2];
    }
    return attrs;
  }

  function renderQuiz(data) {
    const container = document.createElement('div');
    container.className = 'quiz-container';
    container.id = data.id || `quiz-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const questionWrap = document.createElement('div');
    questionWrap.className = 'quiz-question';
    const title = document.createElement('h3');
    title.className = 'quiz-title';
    title.textContent = data.question || '未命名题目';
    questionWrap.appendChild(title);
    container.appendChild(questionWrap);

    const optionsWrap = document.createElement('div');
    optionsWrap.className = 'quiz-options';

    data.options.forEach(option => {
      const optionDiv = document.createElement('div');
      optionDiv.className = 'quiz-option';
      optionDiv.dataset.value = option.value || '';
      optionDiv.dataset.explanation = option.explanation || '';

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = container.id;
      input.id = `${container.id}-${option.value || ('opt-' + Math.random().toString(16).slice(2))}`;
      input.value = option.value || '';

      const label = document.createElement('label');
      label.setAttribute('for', input.id);

      const labelSpan = document.createElement('span');
      labelSpan.className = 'quiz-option-label';
      labelSpan.textContent = `${option.value || ''}.`;

      const textSpan = document.createElement('span');
      textSpan.className = 'quiz-option-text';
      textSpan.innerHTML = option.content || '';

      label.appendChild(labelSpan);
      label.appendChild(textSpan);
      optionDiv.appendChild(input);
      optionDiv.appendChild(label);
      optionsWrap.appendChild(optionDiv);
    });

    container.appendChild(optionsWrap);

    const actions = document.createElement('div');
    actions.className = 'quiz-actions';

    const submitBtn = document.createElement('button');
    submitBtn.className = 'quiz-btn quiz-submit';
    submitBtn.textContent = '提交答案';
    submitBtn.dataset.correct = data.correct || '';

    const answerBtn = document.createElement('button');
    answerBtn.className = 'quiz-btn quiz-show-answer';
    answerBtn.textContent = '查看答案';
    answerBtn.dataset.correct = data.correct || '';

    const resetBtn = document.createElement('button');
    resetBtn.className = 'quiz-btn quiz-reset';
    resetBtn.textContent = '重置';

    actions.appendChild(submitBtn);
    actions.appendChild(answerBtn);
    actions.appendChild(resetBtn);
    container.appendChild(actions);

    const resultDiv = document.createElement('div');
    resultDiv.className = 'quiz-result';
    resultDiv.id = `${container.id}-result`;

    const explanationDiv = document.createElement('div');
    explanationDiv.className = 'quiz-explanation';
    explanationDiv.id = `${container.id}-explanation`;

    container.appendChild(resultDiv);
    container.appendChild(explanationDiv);

    return container;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAiQuizSections);
  } else {
    initAiQuizSections();
  }

  function extractContent(raw) {
    if (!raw) return '';
    if (typeof raw === 'string') return raw.trim();

    if (Array.isArray(raw)) {
      for (const item of raw) {
        const result = extractContent(item);
        if (result) return result;
      }
      return '';
    }

    if (typeof raw === 'object') {
      if (typeof raw.content === 'string' && raw.content.trim()) {
        return raw.content.trim();
      }
      if (raw.message) {
        const messageContent = extractContent(raw.message);
        if (messageContent) return messageContent;
      }
      if (raw.delta) {
        const deltaContent = extractContent(raw.delta);
        if (deltaContent) return deltaContent;
      }
      if (raw.result) {
        const resultContent = extractContent(raw.result);
        if (resultContent) return resultContent;
      }
      if (raw.output) {
        const outputContent = extractContent(raw.output);
        if (outputContent) return outputContent;
      }
      if (raw.choices) {
        const choiceContent = extractContent(raw.choices);
        if (choiceContent) return choiceContent;
      }
      if (raw.answer) {
        const answerContent = extractContent(raw.answer);
        if (answerContent) return answerContent;
      }
      if (raw.data) {
        const dataContent = extractContent(raw.data);
        if (dataContent) return dataContent;
      }
    }
    return '';
  }

  function stringifySafe(value) {
    try {
      return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    } catch (error) {
      return String(value);
    }
  }

  // 保存生成的 quiz 内容到服务器
  async function saveQuizContent(baseEndpoint, content, metadata) {
    try {
      // 构建 save 端点的完整 URL
      const saveUrl = buildApiUrl(baseEndpoint, 'save');

      const saveData = {
        content: content,
        metadata: {
          difficulty: metadata.difficulty,
          count: metadata.count,
          timestamp: new Date().toISOString(),
          pageUrl: window.location.href,
          pageTitle: document.title
        }
      };

      console.log('[AI Quiz] 保存内容到:', saveUrl);

      const response = await fetch(saveUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(saveData)
      });

      if (!response.ok) {
        throw new Error(`保存失败: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('[AI Quiz] 保存失败:', error);
      throw error;
    }
  }

  // 从服务器加载已保存的 quiz 内容
  async function loadQuizContent(baseEndpoint, resultsEl) {
    try {
      // 构建 load 端点的完整 URL
      const loadUrl = buildApiUrl(baseEndpoint, 'load') + '?pageUrl=' + encodeURIComponent(window.location.href);

      console.log('[AI Quiz] 加载已保存内容:', loadUrl);

      const response = await fetch(loadUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.log('[AI Quiz] 未找到已保存的内容');
          return null;
        }
        throw new Error(`加载失败: ${response.status}`);
      }

      const result = await response.json();
      if (result.success && result.data && result.data.content) {
        console.log('[AI Quiz] 加载到已保存内容');
        appendQuizContent(resultsEl, result.data.content);
        return result.data;
      }
      return null;
    } catch (error) {
      console.warn('[AI Quiz] 加载已保存内容失败（不影响使用）:', error);
      return null;
    }
  }
})();


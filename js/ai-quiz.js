// AI quiz generation logic
(function () {
  'use strict';

  function initAiQuizSections() {
    const sections = document.querySelectorAll('[data-ai-quiz-root]');
    if (!sections.length) return;

    sections.forEach(section => {
      const endpoint = section.getAttribute('data-ai-quiz-endpoint');
      const button = section.querySelector('[data-ai-quiz-trigger]');
      const statusEl = section.querySelector('[data-ai-quiz-status]');
      const resultsEl = section.querySelector('[data-ai-quiz-results]');

      if (!button || !endpoint || !resultsEl) return;

      initFloatingButton(button);

      button.addEventListener('click', async function () {
        button.disabled = true;
        setStatus(statusEl, '正在生成考题，请稍候…');

        try {
          const payload = await requestQuiz(endpoint);
          const content = payload?.data?.choices?.[0]?.message?.content;
          if (!content) {
            throw new Error('后端未返回考题内容');
          }
          appendQuizContent(resultsEl, content);
          setStatus(statusEl, '生成成功，内容已追加。');
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

  async function requestQuiz(endpoint) {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) {
      throw new Error('服务返回错误状态：' + response.status);
    }
    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.message || '生成失败');
    }
    return payload;
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
})();


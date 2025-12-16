// 答题系统 JavaScript
(function() {
  'use strict';

  function bindQuizContainer(container) {
    if (!container) {
      console.warn('[Quiz] bindQuizContainer: container is null');
      return;
    }
    if (container.dataset.quizBound === 'true') {
      console.log('[Quiz] bindQuizContainer: container already bound', container.id);
      return;
    }
    container.dataset.quizBound = 'true';

    const submitBtn = container.querySelector('.quiz-submit');
    const showAnswerBtn = container.querySelector('.quiz-show-answer');
    const resetBtn = container.querySelector('.quiz-reset');
    const options = container.querySelectorAll('.quiz-option');
    const resultDiv = container.querySelector('.quiz-result');
    const explanationDiv = container.querySelector('.quiz-explanation');

    console.log('[Quiz] bindQuizContainer:', {
      containerId: container.id,
      hasSubmitBtn: !!submitBtn,
      hasShowAnswerBtn: !!showAnswerBtn,
      hasResetBtn: !!resetBtn,
      optionsCount: options.length
    });

    if (submitBtn) {
      submitBtn.addEventListener('click', function() {
        const correctAnswer = this.getAttribute('data-correct');
        const selectedOptionDiv = container.querySelector('.quiz-option.selected');

        if (!selectedOptionDiv) {
          alert('请先选择一个答案！');
          return;
        }

        const selectedValue = selectedOptionDiv.getAttribute('data-value');
        const isCorrect = selectedValue === correctAnswer;

        showResult(container, isCorrect, correctAnswer);
        markOptions(options, selectedValue, correctAnswer);
        showExplanation(container, selectedOptionDiv, correctAnswer);

        submitBtn.disabled = true;
        if (showAnswerBtn) {
          showAnswerBtn.disabled = true;
        }
      });
    }

    if (showAnswerBtn) {
      showAnswerBtn.addEventListener('click', function() {
        const correctAnswer = this.getAttribute('data-correct');
        showResult(container, true, correctAnswer, true);
        markOptions(options, null, correctAnswer);
        showAllExplanations(container, options, correctAnswer);

        this.disabled = true;
        if (submitBtn) {
          submitBtn.disabled = true;
        }
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', function() {
        options.forEach(option => {
          option.classList.remove('correct', 'incorrect', 'selected');
        });

        if (resultDiv) {
          resultDiv.classList.remove('show', 'correct', 'incorrect');
          resultDiv.textContent = '';
        }

        if (explanationDiv) {
          explanationDiv.classList.remove('show');
          explanationDiv.innerHTML = '';
        }

        if (submitBtn) submitBtn.disabled = false;
        if (showAnswerBtn) showAnswerBtn.disabled = false;
      });
    }

    options.forEach(option => {
      option.addEventListener('click', function() {
        // 单选效果：同一题目中只保留一个选中项
        options.forEach(o => o.classList.remove('selected'));
        this.classList.add('selected');
      });
    });
  }

  function initQuiz(root) {
    let containers = [];
    if (!root || root === document) {
      containers = document.querySelectorAll('.quiz-container');
    } else if (root.classList && root.classList.contains('quiz-container')) {
      containers = [root];
    } else if (root.querySelectorAll) {
      containers = root.querySelectorAll('.quiz-container');
    }
    
    console.log('[Quiz] initQuiz: found', containers.length, 'quiz containers');
    containers.forEach(function(container, index) {
      console.log('[Quiz] initializing container', index + 1, container.id || '(no id)');
      bindQuizContainer(container);
    });
  }
  
  // 显示结果
  function showResult(container, isCorrect, correctAnswer, isShowAnswer) {
    const resultDiv = container.querySelector('.quiz-result');
    if (!resultDiv) return;
    
    resultDiv.classList.add('show');
    resultDiv.classList.remove('correct', 'incorrect');
    
    if (isCorrect) {
      resultDiv.classList.add('correct');
      resultDiv.innerHTML = '<span class="quiz-result-icon">✓</span>回答正确！';
    } else {
      resultDiv.classList.add('incorrect');
      if (isShowAnswer) {
        resultDiv.innerHTML = '<span class="quiz-result-icon">✓</span>正确答案是：' + correctAnswer;
      } else {
        resultDiv.innerHTML = '<span class="quiz-result-icon">✗</span>回答错误！正确答案是：' + correctAnswer;
      }
    }
  }
  
  // 标记选项
  function markOptions(options, selectedValue, correctAnswer) {
    options.forEach(option => {
      const value = option.getAttribute('data-value');
      option.classList.remove('correct', 'incorrect');
      
      if (value === correctAnswer) {
        option.classList.add('correct');
      } else if (value === selectedValue && selectedValue !== correctAnswer) {
        option.classList.add('incorrect');
      }
    });
  }
  
  // 显示解释
  function showExplanation(container, selectedOptionDiv, correctAnswer) {
    const explanationDiv = container.querySelector('.quiz-explanation');
    if (!explanationDiv) return;

    const selectedExplanation = selectedOptionDiv ? selectedOptionDiv.getAttribute('data-explanation') : '';
    
    const correctOption = container.querySelector(`.quiz-option[data-value="${correctAnswer}"]`);
    const correctExplanation = correctOption ? correctOption.getAttribute('data-explanation') : '';
    
    let html = '<div class="quiz-explanation-title">📖 解析：</div>';

    const selectedValue = selectedOptionDiv ? selectedOptionDiv.getAttribute('data-value') : '';

    if (selectedValue === correctAnswer) {
      if (correctExplanation) {
        html += '<div class="quiz-explanation-content">' + correctExplanation + '</div>';
      }
    } else {
      if (selectedExplanation) {
        html += '<div class="quiz-explanation-content"><strong>您选择的选项：</strong>' + selectedExplanation + '</div>';
      }
      if (correctExplanation) {
        html += '<div class="quiz-explanation-content" style="margin-top: 0.5em;"><strong>正确答案：</strong>' + correctExplanation + '</div>';
      }
    }
    
    explanationDiv.innerHTML = html;
    explanationDiv.classList.add('show');
  }
  
  // 显示所有解释
  function showAllExplanations(container, options, correctAnswer) {
    const explanationDiv = container.querySelector('.quiz-explanation');
    if (!explanationDiv) return;
    
    let html = '<div class="quiz-explanation-title">📖 解析：</div>';
    
    options.forEach(option => {
      const value = option.getAttribute('data-value');
      const explanation = option.getAttribute('data-explanation');
      
      if (explanation) {
        const isCorrect = value === correctAnswer;
        const prefix = isCorrect ? '<strong style="color: #27ae60;">✓ ' + value + '（正确答案）：</strong>' : '<strong>' + value + '：</strong>';
        html += '<div class="quiz-explanation-content" style="margin-top: 0.5em;">' + prefix + explanation + '</div>';
      }
    });
    
    explanationDiv.innerHTML = html;
    explanationDiv.classList.add('show');
  }
  
  // 页面加载完成后初始化
  function initializeQuiz() {
    initQuiz();
  }

  // 使用多种方式确保初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeQuiz);
  } else {
    // DOM 已经加载，立即初始化
    initializeQuiz();
  }

  // 也监听 load 事件作为备用（处理动态内容）
  window.addEventListener('load', initializeQuiz);

  window.QuizApp = window.QuizApp || {};
  window.QuizApp.init = initQuiz;
  window.QuizApp.bindContainer = bindQuizContainer;
})();


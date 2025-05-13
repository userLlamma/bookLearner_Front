const { createApp, ref, computed, onMounted, watch } = Vue;

// API基地址
const API_BASE_URL = window.location.origin;

const app = createApp({
  setup() {
    // 视图状态
    const currentView = ref('home');

    // 书籍管理
    const books = ref([]);
    const newBook = ref({
      title: '',
      author: '',
      description: ''
    });
    const selectedBookId = ref('');
    const newPage = ref({
      pageNumber: 1,
      content: ''
    });
    const bookPages = ref([]);
    const bookPagesModal = ref(null);
    const currentViewingBookId = ref(null); // 用于存储当前查看页面的书籍ID
    
    // 文本上传
    const uploadText = ref('');
    const isUploading = ref(false);
    const texts = ref([]);
    
    // 问题管理
    const questions = ref([]);
    const questionFilter = ref('all');
    const editingQuestion = ref(null);
    const fillBlankAnswerText = ref('');
    const editQuestionModal = ref(null);
    
    // 考试设置
    const examSettings = ref({
      singleChoiceCount: 5,
      multipleChoiceCount: 3,
      fillBlankCount: 2
    });
    const examStarted = ref(false);
    const examFinished = ref(false);
    const examQuestions = ref([]);
    const currentQuestionIndex = ref(0);
    const userAnswers = ref([]);
    const examScore = ref(0);
    
    // 计算属性
    const canUploadPage = computed(() => {
      return selectedBookId.value && 
            newPage.value.pageNumber > 0 && 
            newPage.value.content.trim().length > 0;
    });

    const filteredQuestions = computed(() => {
      if (questionFilter.value === 'all') {
        return questions.value;
      } else {
        return questions.value.filter(q => q.type === questionFilter.value);
      }
    });
    
    const currentQuestion = computed(() => {
      if (examQuestions.value.length > 0 && currentQuestionIndex.value < examQuestions.value.length) {
        return examQuestions.value[currentQuestionIndex.value];
      }
      return null;
    });
    
    const examProgress = computed(() => {
      return Math.round(((currentQuestionIndex.value + 1) / examQuestions.value.length) * 100);
    });
    
    const canStartExam = computed(() => {
      const total = examSettings.value.singleChoiceCount + 
                    examSettings.value.multipleChoiceCount + 
                    examSettings.value.fillBlankCount;
      return total > 0;
    });
    
    const examTotalScore = computed(() => {
      return examQuestions.value.length * 10;
    });
    
    // 方法
    async function loadTexts() {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/text`);
        texts.value = response.data.data;
      } catch (error) {
        console.error('Error loading texts:', error);
        alert('加载文本列表失败');
      }
    }
    
    async function loadQuestions() {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/questions`);
        questions.value = response.data.data;
      } catch (error) {
        console.error('Error loading questions:', error);
        alert('加载问题列表失败');
      }
    }
    
    // 书籍管理方法
    async function loadBooks() {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/books`);
        books.value = response.data.map(book => ({
          ...book,
          isGenerating: false
        }));
      } catch (error) {
        console.error('Error loading books:', error);
        alert('加载书籍列表失败');
      }
    }
    async function createBook() {
      if (!newBook.value.title.trim()) {
        alert('请输入书籍标题');
        return;
      }
      
      try {
        await axios.post(`${API_BASE_URL}/api/books`, newBook.value);
        alert('书籍创建成功');
        // 重置表单
        newBook.value = {
          title: '',
          author: '',
          description: ''
        };
        // 刷新列表
        loadBooks();
      } catch (error) {
        console.error('Error creating book:', error);
        alert('创建书籍失败: ' + (error.response?.data?.message || error.message));
      }
    }
    async function uploadPage() {
      if (!canUploadPage.value) {
        alert('请完善页面信息');
        return;
      }
      
      try {
        await axios.post(`${API_BASE_URL}/api/pages`, {
          bookId: selectedBookId.value,
          pageNumber: newPage.value.pageNumber,
          content: newPage.value.content
        });
        
        alert('页面上传成功');
        // 重置内容，保留书籍选择和增加页码
        newPage.value = {
          pageNumber: newPage.value.pageNumber + 1,
          content: ''
        };
        // 刷新书籍列表
        loadBooks();
      } catch (error) {
        console.error('Error uploading page:', error);
        alert('上传页面失败: ' + (error.response?.data?.message || error.message));
      }
    }
    async function viewBookPages(bookId) {
      currentViewingBookId.value = bookId; // 保存当前书籍ID
      try {
        // 根据 API 文档，接口 URL 是 /api/books/:id/pages
        const response = await axios.get(`${API_BASE_URL}/api/books/${bookId}/pages`);
        // API 返回的数据结构中，页面列表在 response.data.pages
        bookPages.value = response.data.pages.sort((a, b) => a.pageNumber - b.pageNumber);
        // 确保 bookPagesModal.value 已经被正确初始化
        if (bookPagesModal.value && typeof bookPagesModal.value.show === 'function') {
          bookPagesModal.value.show();
        } else {
          // 如果尚未初始化，尝试获取并初始化
          const modalElement = document.getElementById('bookPagesModal');
          if (modalElement) {
            bookPagesModal.value = new bootstrap.Modal(modalElement);
            bookPagesModal.value.show();
          } else {
            console.error('Book pages modal element not found.');
            alert('无法打开页面列表模态框。');
          }
        }
      } catch (error) {
        console.error('Error loading book pages:', error);
        alert('加载书籍页面失败: ' + (error.response?.data?.message || error.message));
      }
    }
    async function generateBookQuestions(bookId) {
      const book = books.value.find(b => b._id === bookId);
      if (!book) return;
      
      if (!confirm(`确定要为《${book.title}》生成考试题目吗？此过程可能需要几分钟时间，并且可能会生成大量题目。`)) {
        return;
      }
      
      try {
        // 标记当前书籍为处理中
        book.isGenerating = true;
        
        const response = await axios.post(`${API_BASE_URL}/api/books/${bookId}/generate-questions`);
        alert(`题目生成任务已启动: ${response.data.estimatedTime}`);
        
        // 每隔3秒检查一次处理进度
        const checkInterval = setInterval(async () => {
          await loadBooks();
          const updatedBook = books.value.find(b => b._id === bookId);
          // 如果处理完成，停止检查
          if (updatedBook && updatedBook.questionsGenerated) {
            clearInterval(checkInterval);
          }
        }, 3000);
      } catch (error) {
        console.error('Error generating questions:', error);
        alert('生成题目失败: ' + (error.response?.data?.message || error.message));
        // 清除处理中标记
        book.isGenerating = false;
      }
    }
    async function deleteBook(bookId) {
      if (!confirm('确定要删除这本书籍吗？此操作将同时删除所有相关页面和题目，且不可撤销。')) {
        return;
      }
      
      try {
        await axios.delete(`${API_BASE_URL}/api/books/${bookId}`);
        alert('书籍删除成功');
        loadBooks();
      } catch (error) {
        console.error('Error deleting book:', error);
        alert('删除书籍失败');
      }
    }

    // API 文档: DELETE /api/books/:id/pages/:pageNumber
    async function deletePage(bookId, pageNumber) {
      if (!bookId || !pageNumber) {
        alert('缺少书籍ID或页码，无法删除页面。');
        return;
      }
      if (!confirm(`确定要删除书籍ID ${bookId} 的第 ${pageNumber} 页吗？此操作不可撤销。`)) {
        return;
      }

      try {
        await axios.delete(`${API_BASE_URL}/api/books/${bookId}/pages/${pageNumber}`);
        alert('页面删除成功');
        
        // 刷新当前显示的页面列表
        if (currentViewingBookId.value) { // 使用保存的 bookId 重新加载页面
            viewBookPages(currentViewingBookId.value);
        } else {
            // 如果没有 currentViewingBookId，可能需要关闭模态框或给出提示
            if (bookPagesModal.value && typeof bookPagesModal.value.hide === 'function') {
                bookPagesModal.value.hide();
            }
        }
        // 刷新书籍列表（因为 processedPages 可能变化）
        loadBooks();
      } catch (error) {
        console.error('Error deleting page:', error);
        alert('删除页面失败: ' + (error.response?.data?.message || error.message));
      }
    }

    function formatDate(dateString) {
      if (!dateString) return '';
      return new Date(dateString).toLocaleString();
    }


    async function uploadTextContent() {
      if (!uploadText.value.trim()) {
        alert('请输入文本内容');
        return;
      }
      
      isUploading.value = true;
      
            try {
        await axios.post(`${API_BASE_URL}/api/text/upload`, {
          text: uploadText.value
        });
        
        uploadText.value = '';
        loadTexts();
        alert('文本上传成功，系统正在处理生成题目');
      } catch (error) {
        console.error('Upload error:', error);
        alert('上传失败: ' + (error.response?.data?.message || error.message));
      } finally {
        isUploading.value = false;
      }
    }
    
    async function viewTextQuestions(textId) {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/questions/by-text/${textId}`);
        questions.value = response.data.data;
        currentView.value = 'questionBank';
      } catch (error) {
        console.error('Error loading text questions:', error);
        alert('加载相关问题失败');
      }
    }
    
    function filterQuestions(filter) {
      questionFilter.value = filter;
    }
    
    function getQuestionTypeText(type) {
      const types = {
        'single_choice': '单选题',
        'multiple_choice': '多选题',
        'fill_blank': '填空题'
      };
      return types[type] || '未知类型';
    }
    
    function isCorrectAnswer(question, option) {
      if (question.type === 'single_choice') {
        return question.answer === option.id;
      } else if (question.type === 'multiple_choice') {
        return Array.isArray(question.answer) && question.answer.includes(option.id);
      }
      return false;
    }
    
    function editQuestion(question) {
      editingQuestion.value = JSON.parse(JSON.stringify(question));
      
      // 处理填空题答案格式转换
      if (question.type === 'fill_blank') {
        fillBlankAnswerText.value = Array.isArray(question.answer) 
          ? question.answer.join(',') 
          : question.answer;
      }
      
      // 打开模态框
      if (editQuestionModal.value) {
        editQuestionModal.value.show();
      }
    }
    
    async function saveQuestion() {
      try {
        // 处理填空题答案格式
        if (editingQuestion.value.type === 'fill_blank') {
          editingQuestion.value.answer = fillBlankAnswerText.value.split(',').map(a => a.trim());
        }
        
        await axios.put(`${API_BASE_URL}/api/questions/${editingQuestion.value._id}`, editingQuestion.value);
        
        alert('问题更新成功');
        editQuestionModal.value.hide();
        loadQuestions();
      } catch (error) {
        console.error('Error saving question:', error);
        alert('保存问题失败');
      }
    }
    
    async function deleteQuestion(questionId) {
      if (!confirm('确定要删除这个问题吗？此操作不可撤销。')) {
        return;
      }
      
      try {
        await axios.delete(`${API_BASE_URL}/api/questions/${questionId}`);
        alert('问题删除成功');
        loadQuestions();
      } catch (error) {
        console.error('Error deleting question:', error);
        alert('删除问题失败');
      }
    }
    
    function addOption() {
      if (!editingQuestion.value) return;
      
      // 生成新的选项ID (A, B, C, D, E...)
      const existingOptions = editingQuestion.value.options || [];
      const lastOptionId = existingOptions.length > 0 
        ? existingOptions[existingOptions.length - 1].id 
        : '@';
        
      const newOptionId = String.fromCharCode(lastOptionId.charCodeAt(0) + 1);
      
      if (!Array.isArray(editingQuestion.value.options)) {
        editingQuestion.value.options = [];
      }
      
      editingQuestion.value.options.push({
        id: newOptionId,
        text: ''
      });
    }
    
    function removeOption(index) {
      if (editingQuestion.value && Array.isArray(editingQuestion.value.options)) {
        editingQuestion.value.options.splice(index, 1);
        
        // 重新整理选项ID
        editingQuestion.value.options.forEach((option, idx) => {
          option.id = String.fromCharCode('A'.charCodeAt(0) + idx);
        });
        
        // 如果删除了正确选项，需要更新答案
        if (editingQuestion.value.type === 'single_choice') {
          const optionIds = editingQuestion.value.options.map(o => o.id);
          if (!optionIds.includes(editingQuestion.value.answer)) {
            editingQuestion.value.answer = optionIds.length > 0 ? optionIds[0] : '';
          }
        } else if (editingQuestion.value.type === 'multiple_choice') {
          if (Array.isArray(editingQuestion.value.answer)) {
            const optionIds = editingQuestion.value.options.map(o => o.id);
            editingQuestion.value.answer = editingQuestion.value.answer.filter(a => optionIds.includes(a));
          }
        }
      }
    }
    
    async function startExam() {
      try {
        const response = await axios.post(`${API_BASE_URL}/api/exam/generate`, {
          singleChoiceCount: examSettings.value.singleChoiceCount,
          multipleChoiceCount: examSettings.value.multipleChoiceCount,
          fillBlankCount: examSettings.value.fillBlankCount
        });
        
        examQuestions.value = response.data.data;
        
        // 初始化用户答案
        userAnswers.value = examQuestions.value.map(q => {
          if (q.type === 'multiple_choice') {
            return [];
          }
          return '';
        });
        
        currentQuestionIndex.value = 0;
        examStarted.value = true;
        examFinished.value = false;
        examScore.value = 0;
      } catch (error) {
        console.error('Error generating exam:', error);
        alert('生成试卷失败，请确保题库中有足够的题目');
      }
    }
    
    function nextQuestion() {
      if (currentQuestionIndex.value < examQuestions.value.length - 1) {
        currentQuestionIndex.value++;
      }
    }
    
    function prevQuestion() {
      if (currentQuestionIndex.value > 0) {
        currentQuestionIndex.value--;
      }
    }
    
    function submitExam() {
      if (!confirm('确定要提交试卷吗？提交后将无法修改答案。')) {
        return;
      }
      
      // 计算得分
      let score = 0;
      examQuestions.value.forEach((question, index) => {
        if (questionIsCorrect(index)) {
          score += 10; // 每题10分
        }
      });
      
      examScore.value = score;
      examFinished.value = true;
    }
    
    function questionIsCorrect(index) {
      const question = examQuestions.value[index];
      const userAnswer = userAnswers.value[index];
      
      if (!userAnswer) return false;
      
      if (question.type === 'single_choice') {
        return userAnswer === question.answer;
      } else if (question.type === 'multiple_choice') {
        if (!Array.isArray(userAnswer) || !Array.isArray(question.answer)) return false;
        
        // 多选题需要完全匹配
        if (userAnswer.length !== question.answer.length) return false;
        
        return question.answer.every(a => userAnswer.includes(a)) && 
               userAnswer.every(a => question.answer.includes(a));
      } else if (question.type === 'fill_blank') {
        // 填空题支持多个正确答案
        if (Array.isArray(question.answer)) {
          return question.answer.some(a => 
            userAnswer.toLowerCase().trim() === a.toLowerCase().trim()
          );
        } else {
          return userAnswer.toLowerCase().trim() === question.answer.toLowerCase().trim();
        }
      }
      
      return false;
    }
    
    function questionResultClass(index) {
      return questionIsCorrect(index) ? 'badge-correct' : 'badge-incorrect';
    }
    
    function isOptionInUserAnswer(questionIndex, optionId) {
      const userAnswer = userAnswers.value[questionIndex];
      
      if (examQuestions.value[questionIndex].type === 'single_choice') {
        return userAnswer === optionId;
      } else if (Array.isArray(userAnswer)) {
        return userAnswer.includes(optionId);
      }
      
      return false;
    }
    
    function getOptionClass(question, option, index) {
      const isCorrectOpt = isCorrectAnswer(question, option);
      const isSelected = isOptionInUserAnswer(index, option.id);
      
      if (isCorrectOpt) {
        return 'correct-option';
      } else if (isSelected && !isCorrectOpt) {
        return 'incorrect-option';
      }
      
      return '';
    }
    
    function startNewExam() {
      examStarted.value = false;
      examFinished.value = false;
    }
    
    function endExam() {
      if (confirm('确定要结束考试吗？您的进度将不会被保存。')) {
        examStarted.value = false;
        examFinished.value = false;
      }
    }
    
    // 生命周期钩子
    onMounted(() => {
      loadTexts();
      loadQuestions();
      loadBooks(); // 加载书籍列表
      
      // 初始化Bootstrap模态框
      editQuestionModal.value = new bootstrap.Modal(document.getElementById('editQuestionModal'));
      bookPagesModal.value = new bootstrap.Modal(document.getElementById('bookPagesModal'));
    });
    
    // 监听问题类型变化，重置选项
    watch(() => editingQuestion.value?.type, (newType, oldType) => {
      if (newType && oldType && newType !== oldType && editingQuestion.value) {
        if (newType === 'fill_blank') {
          // 从选择题切换到填空题
          fillBlankAnswerText.value = '';
          editingQuestion.value.answer = [];
        } else if (newType === 'single_choice') {
          // 切换到单选题
          if (Array.isArray(editingQuestion.value.answer)) {
            editingQuestion.value.answer = editingQuestion.value.answer.length > 0 
              ? editingQuestion.value.answer[0] 
              : '';
          }
        } else if (newType === 'multiple_choice') {
          // 切换到多选题
          if (!Array.isArray(editingQuestion.value.answer)) {
            editingQuestion.value.answer = editingQuestion.value.answer 
              ? [editingQuestion.value.answer] 
              : [];
          }
        }
      }
    });
    
    return {
      // 状态
      currentView,
      uploadText,
      isUploading,
      texts,
      questions,
      questionFilter,
      filteredQuestions,
      editingQuestion,
      fillBlankAnswerText,
      examSettings,
      examStarted,
      examFinished,
      examQuestions,
      currentQuestionIndex,
      currentQuestion,
      userAnswers,
      examProgress,
      examScore,
      examTotalScore,
      canStartExam,
      
      // 方法
      uploadTextContent,
      loadTexts,
      viewTextQuestions,
      filterQuestions,
      getQuestionTypeText,
      isCorrectAnswer,
      editQuestion,
      saveQuestion,
      deleteQuestion,
      addOption,
      removeOption,
      startExam,
      nextQuestion,
      prevQuestion,
      submitExam,
      questionIsCorrect,
      questionResultClass,
      isOptionInUserAnswer,
      getOptionClass,
      startNewExam,
      endExam,

      // 书籍管理
      books,
      newBook,
      selectedBookId,
      newPage,
      bookPages,
      canUploadPage,
      loadBooks,
      createBook,
      uploadPage,
      viewBookPages,
      generateBookQuestions,
      deleteBook,
      deletePage,
      formatDate
    };
  }
}).mount('#app');


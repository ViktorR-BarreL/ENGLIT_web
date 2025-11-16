// --- Получаем все инструменты из window (как было изначально) ---
const { db, collection, doc, addDoc, setDoc, auth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, getDoc, updateDoc, increment, getDocs, serverTimestamp, query, orderBy } = window;


// --- ВАЖНО: Вставьте сюда ваш UID Администратора ---
const ADMIN_UIDS = ['tciaSYZZM0UMArvVbOoYvrjWqlB3'];

// --- Находим все HTML-элементы на странице ---
const loginScreen = document.getElementById('login-screen');
const appContent = document.getElementById('app-content');
const loginBtn = document.getElementById('loginBtn');
const adminPanel = document.getElementById('admin-panel');
const addCategoryForm = document.getElementById('add-category-form');
const addWordForm = document.getElementById('add-word-form');
const categorySelect = document.getElementById('word-category-select');
const newWordsContainer = document.getElementById('new-words-container');
const learningWordsContainer = document.getElementById('learning-words-container');
const learnedWordsContainer = document.getElementById('learned-words-container');

// Элементы главной страницы
const userProfileCircle = document.getElementById('userProfileCircle');
const selectedCategoryDisplay = document.getElementById('selectedCategoryDisplay');
const selectCategoryBtn = document.getElementById('selectCategoryBtn');
const learnNewWordsBtn = document.getElementById('learnNewWordsBtn');
const repeatWordsBtn = document.getElementById('repeatWordsBtn');
const dictionaryBtn = document.getElementById('dictionaryBtn');
const myWordsBtn = document.getElementById('myWordsBtn');
const mainLayout = document.getElementById('mainLayout');

// Элементы модального окна категорий
const categoryModal = document.getElementById('categoryModal');
const closeButton = categoryModal.querySelector('.close-button');
const categoryGrid = document.getElementById('categoryGrid');

// Элементы страницы изучения слов
const learningPage = document.getElementById('learning-page');
const backToMainBtn = document.getElementById('backToMainBtn');
const learningProgressBar = document.getElementById('learningProgressBar');
const wordDisplay = document.getElementById('wordDisplay');
const translationDisplay = document.getElementById('translationDisplay');
const transcriptionDisplay = document.getElementById('transcriptionDisplay');
const exampleDisplay = document.getElementById('exampleDisplay');
const prevWordBtn = document.getElementById('prevWordBtn');
const nextWordBtn = document.getElementById('nextWordBtn');
const knowWordBtn = document.getElementById('knowWordBtn');
const learnItBtn = document.getElementById('learnItBtn');

// Элементы страницы повторения слов
const repeatPage = document.getElementById('repeat-page');
const backToMainFromRepeatBtn = document.getElementById('backToMainFromRepeatBtn');
const testFormatSelect = document.getElementById('testFormatSelect');
const repeatProgressBar = document.getElementById('repeatProgressBar');
const repeatWordDisplay = document.getElementById('repeatWordDisplay');
const testOptionsContainer = document.getElementById('testOptionsContainer');
const feedbackMessage = document.getElementById('feedbackMessage');
const startTestBtn = document.getElementById('startTestBtn');
const checkAnswerBtn = document.getElementById('checkAnswerBtn');
const nextQuestionBtn = document.getElementById('nextQuestionBtn');
const finishTestBtn = document.getElementById('finishTestBtn');
const testResultsContainer = document.getElementById('testResultsContainer');
const correctAnswersCount = document.getElementById('correctAnswersCount');
const incorrectAnswersCount = document.getElementById('incorrectAnswersCount');
const restartTestBtn = document.getElementById('restartTestBtn');

// Элементы страницы словаря
const dictionaryPage = document.getElementById('dictionary-page');
const backToMainFromDictBtn = document.getElementById('backToMainFromDictBtn');
const dictionarySearchInput = document.getElementById('dictionarySearchInput');
const sourceWordsContainer = document.getElementById('source-words-container');
const learnedWordsContainerDict = document.getElementById('learned-words-container-dict');
const addedWordsContainerDict = document.getElementById('added-words-container-dict');

// Элементы страницы "Свои слова"
const myWordsPage = document.getElementById('my-words-page');
const backToMainFromMyWordsBtn = document.getElementById('backToMainFromMyWordsBtn');
const addCustomWordForm = document.getElementById('add-custom-word-form');
const customWordsList = document.getElementById('custom-words-list');

// Элементы страницы Личного кабинета
const profilePage = document.getElementById('profile-page');
const backToMainFromProfileBtn = document.getElementById('backToMainFromProfileBtn');
const profileAvatarDisplay = document.getElementById('profile-avatar-display');
const profileDisplayName = document.getElementById('profile-displayName');
const profileEmail = document.getElementById('profile-email');
const logoutBtn = document.getElementById('logoutBtn');
const themeToggleBtn = document.getElementById('theme-toggle-btn');

// Элементы статистики
const totalLearnedCount = document.getElementById('total-learned-count');
const statisticsFilters = document.querySelector('.statistics-filters');
const ctx = document.getElementById('statisticsChart').getContext('2d');
let statisticsChart = null; 
let allUserWordsData = []; 

// Глобальные переменные состояния
let currentCategoryId = null; 
let currentLearningWords = []; 
let currentWordIndex = 0; 

let currentRepeatWords = [];
let currentRepeatIndex = 0; 
let correctAnswers = 0;
let incorrectAnswers = 0;
let testActive = false; 

let isSoundEnabled = true;

// --- Логика переключения тем ---
function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }
}

themeToggleBtn.addEventListener('click', () => {
    const isDark = document.body.classList.contains('dark-theme');
    const newTheme = isDark ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
    // Перерисовываем график, чтобы он подхватил новые цвета из CSS переменных
    if (statisticsChart) {
        loadAndRenderStatistics();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);
});


// --- Логика синтеза речи (TTS) ---
let britishVoice = null;

function loadAndSetVoice() {
    const voices = window.speechSynthesis.getVoices();
    
    britishVoice = voices.find(voice => 
        voice.lang === 'en-GB' && 
        (voice.name.includes('Female') || voice.name.includes('Kate') || voice.name.includes('Libby'))
    );

    if (!britishVoice) {
        britishVoice = voices.find(voice => voice.lang === 'en-GB');
    }
}

function speakWord(word) {
    if (!isSoundEnabled) return; 
    
    window.speechSynthesis.cancel(); 
    const utterance = new SpeechSynthesisUtterance(word);
    if (britishVoice) {
        utterance.voice = britishVoice;
    }
    utterance.lang = 'en-GB';
    window.speechSynthesis.speak(utterance);
}

window.speechSynthesis.onvoiceschanged = loadAndSetVoice;
loadAndSetVoice();

// --- Главная функция, которая следит за входом пользователя ---
onAuthStateChanged(auth, user => {
    if (user) {
        loginScreen.style.display = 'none';
        appContent.style.display = 'flex';
        mainLayout.style.display = 'flex';
        learningPage.style.display = 'none';
        repeatPage.style.display = 'none';
        dictionaryPage.style.display = 'none';
        myWordsPage.style.display = 'none';
        profilePage.style.display = 'none';

        if (user.photoURL) {
            userProfileCircle.innerHTML = `<img src="${user.photoURL}" alt="Avatar">`;
        } else {
            userProfileCircle.innerHTML = `<span>${user.displayName ? user.displayName.charAt(0).toUpperCase() : '?'}</span>`;
        }

        if (ADMIN_UIDS.includes(user.uid)) {
            adminPanel.style.display = 'block';
            populateCategoryDropdown();
        } else {
            adminPanel.style.display = 'none';
        }
        
        loadUserSettings(user);
        fetchWordsAndStatuses();
        loadCategoriesForSelection();
        loadAndRenderStatistics();
    } else {
        loginScreen.style.display = 'flex';
        appContent.style.display = 'none';
    }
});

// --- Логика кнопок входа/выхода ---
loginBtn.addEventListener('click', () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch(error => console.error("Ошибка входа:", error));
});

logoutBtn.addEventListener('click', () => {
    signOut(auth).catch(error => console.error("Ошибка выхода:", error));
});


// --- Логика Админ-Панели ---
addCategoryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const categoryId = addCategoryForm['category-id'].value.trim();
    const categoryName = addCategoryForm['category-name'].value.trim();
    const categoryDesc = addCategoryForm['category-desc'].value.trim();
    if (!categoryId || !categoryName) return;
    try {
        await setDoc(doc(db, "category", categoryId), { 
            name: categoryName, 
            description: categoryDesc,
            wordCount: 0 
        });
        alert('Категория добавлена!');
        addCategoryForm.reset();
        populateCategoryDropdown(); 
        loadCategoriesForSelection(); 
    } catch (error) { console.error("Ошибка добавления категории:", error); }
});

addWordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const wordValue = addWordForm['word-en'].value.trim().toLowerCase();
    const categoryId = addWordForm['word-category-select'].value;

    if (!wordValue || !categoryId) {
        alert('Пожалуйста, выберите категорию.');
        return;
    }

    const wordDocRef = doc(db, "words", wordValue);
    
    try {
        const categoryRef = doc(db, "category", categoryId);
        const categorySnap = await getDoc(categoryRef);

        if (!categorySnap.exists()) {
            alert('Выбранная категория не существует.');
            return;
        }

        const wordData = {
            word: addWordForm['word-en'].value,
            translation: addWordForm['word-ru'].value,
            transcription: addWordForm['word-transcription'].value,
            example: addWordForm['word-example'].value,
            category: {
                id: categoryId,
                name: categorySnap.data().name 
            },
            createdAt: new Date()
        };

        await setDoc(wordDocRef, wordData);

        await updateDoc(categoryRef, {
            wordCount: increment(1)
        });

        alert('Слово добавлено!');
        addWordForm.reset();
        fetchWordsAndStatuses();
        loadCategoriesForSelection(); 
    } catch (error) { console.error("Ошибка добавления слова:", error); }
});

async function populateCategoryDropdown() {
    try {
        const response = await fetch('http://localhost:3000/categories');
        const categories = await response.json();
        categorySelect.innerHTML = '<option value="" disabled selected>Выберите категорию...</option>';
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.name;
            categorySelect.appendChild(option);
        });
    } catch (error) { console.error("Не удалось загрузить категории:", error); }
}

// --- Функции для работы с категориями (Модальное окно) ---
selectCategoryBtn.addEventListener('click', () => {
    categoryModal.style.display = 'flex';
    loadCategoriesForSelection();
});

closeButton.addEventListener('click', () => {
    categoryModal.style.display = 'none';
});

window.addEventListener('click', (event) => {
    if (event.target === categoryModal) {
        categoryModal.style.display = 'none';
    }
});

async function loadCategoriesForSelection() {
    categoryGrid.innerHTML = ''; 
    try {
        const response = await fetch('http://localhost:3000/categories');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const categories = await response.json();

        const allCategoriesCard = document.createElement('div');
        allCategoriesCard.classList.add('category-card');
        allCategoriesCard.innerHTML = `
            <div class="category-info">
                <p class="category-name">Все категории</p>
                <p class="category-word-count">Все слова</p>
            </div>
        `;
        allCategoriesCard.addEventListener('click', () => {
            selectedCategoryDisplay.value = 'Все категории';
            currentCategoryId = null; 
            categoryModal.style.display = 'none';
            fetchWordsAndStatuses(); 
        });
        categoryGrid.appendChild(allCategoriesCard);

        categories.forEach(category => {
            const categoryCard = document.createElement('div');
            categoryCard.classList.add('category-card');
            categoryCard.innerHTML = `
                <div class="category-info">
                    <p class="category-name">${category.name}</p>
                    <p class="category-word-count">Количество слов: ${category.wordCount || 0}</p>
                </div>
            `;
            categoryCard.addEventListener('click', () => {
                selectedCategoryDisplay.value = category.name;
                currentCategoryId = category.id;
                categoryModal.style.display = 'none';
                fetchWordsAndStatuses(); 
            });
            categoryGrid.appendChild(categoryCard);
        });
    } catch (error) {
        console.error("Ошибка при загрузке категорий для выбора:", error);
        categoryGrid.innerHTML = '<p>Не удалось загрузить категории.</p>';
    }
}


// --- Основная Логика Приложения (для главной страницы) ---
async function updateWordStatus(wordId, newStatus) {
    const user = auth.currentUser;
    if (!user) return;
    try {
        await setDoc(doc(db, "users", user.uid, "userWords", wordId), { 
            status: newStatus,
            statusChangedAt: serverTimestamp()
        }, { merge: true });

        const wordToUpdate = currentLearningWords.find(word => word.id === wordId);
        if (wordToUpdate) {
            wordToUpdate.status = newStatus;
        }
        fetchWordsAndStatuses(); 
        loadAndRenderStatistics(true); // Передаем true, чтобы принудительно обновить данные
    } catch (error) { console.error("Ошибка обновления статуса:", error); }
}

async function fetchWordsAndStatuses() {
    newWordsContainer.innerHTML = '<p>Загрузка...</p>';
    learningWordsContainer.innerHTML = '';
    learnedWordsContainer.innerHTML = '';
    const user = auth.currentUser;
    if (!user) return;

    try {
        const idToken = await user.getIdToken();
        const [categoriesResponse, wordsResponse] = await Promise.all([
            fetch('http://localhost:3000/categories'),
            fetch('http://localhost:3000/my-words', {
                headers: { 'Authorization': `Bearer ${idToken}` }
            })
        ]);

        if (!categoriesResponse.ok || !wordsResponse.ok) {
            throw new Error('Ошибка сети');
        }

        const categories = await categoriesResponse.json();
        const words = await wordsResponse.json();

        const categoriesMap = {};
        categories.forEach(cat => {
            categoriesMap[cat.id] = cat.name;
        });

        newWordsContainer.innerHTML = '';
        learningWordsContainer.innerHTML = '';
        learnedWordsContainer.innerHTML = '';

        const filteredWords = currentCategoryId
            ? words.filter(word => word.categoryId === currentCategoryId)
            : words;

        currentLearningWords = filteredWords.filter(word => 
            word.status !== 'изучаю' && word.status !== 'изучено'
        );
        currentWordIndex = 0; 

        if (filteredWords.length === 0) {
            newWordsContainer.innerHTML = '<p>Слов в выбранной категории пока нет.</p>';
            return;
        }

        filteredWords.forEach(data => {
            const card = document.createElement('div');
            card.className = 'word-card';
            card.id = 'word-' + data.id;
            const categoryName = categoriesMap[data.categoryId] || 'Без категории';
            card.innerHTML = `
                <div class="info">
                    <p><strong>${data.word}</strong> - ${data.translation} <span class="category-tag">${categoryName}</span></p>
                    <span class="details">${data.transcription || ''} — ${data.example || ''}</span>
                </div>
                <div class="actions">
                    <button class="play-btn">&#9658;</button>
                    <div class="status-buttons">
                        <button class="status-btn learn">Изучаю</button>
                        <button class="status-btn learned">Изучено</button>
                    </div>
                </div>
            `;
            
            card.querySelector('.play-btn').addEventListener('click', () => speakWord(data.word));
            card.querySelector('.learn').addEventListener('click', () => updateWordStatus(data.id, 'изучаю'));
            card.querySelector('.learned').addEventListener('click', () => updateWordStatus(data.id, 'изучено'));

            if (data.status === 'изучаю') {
                learningWordsContainer.appendChild(card);
            } else if (data.status === 'изучено') {
                learnedWordsContainer.appendChild(card);
            } else {
                newWordsContainer.appendChild(card);
            }
        });
    } catch (error) {
        console.error("Ошибка при загрузке данных:", error);
        newWordsContainer.innerHTML = '<p>Не удалось загрузить слова.</p>';
    }
}

// --- Логика страницы изучения слов ---
function showLearningPage() {
    mainLayout.style.display = 'none';
    repeatPage.style.display = 'none';
    dictionaryPage.style.display = 'none';
    myWordsPage.style.display = 'none';
    profilePage.style.display = 'none';
    learningPage.style.display = 'flex';
    displayCurrentWord();
}

function hideLearningPage() {
    learningPage.style.display = 'none';
    mainLayout.style.display = 'flex';
    fetchWordsAndStatuses();
}

function displayCurrentWord() {
    if (currentLearningWords.length === 0) {
        wordDisplay.textContent = 'Нет новых слов для изучения в этой категории.';
        translationDisplay.textContent = '';
        transcriptionDisplay.textContent = '';
        exampleDisplay.textContent = '';
        knowWordBtn.style.display = 'none';
        learnItBtn.style.display = 'none';
        prevWordBtn.style.display = 'none';
        nextWordBtn.style.display = 'none';
        learningProgressBar.style.width = '100%'; 
        return;
    }

    knowWordBtn.style.display = 'inline-block';
    learnItBtn.style.display = 'inline-block';
    prevWordBtn.style.display = 'flex';
    nextWordBtn.style.display = 'flex';

    const word = currentLearningWords[currentWordIndex];
    wordDisplay.textContent = word.word;
    translationDisplay.textContent = word.translation;
    transcriptionDisplay.textContent = word.transcription || '';
    exampleDisplay.textContent = word.example || '';

    const progress = ((currentWordIndex + 1) / currentLearningWords.length) * 100;
    learningProgressBar.style.width = `${progress}%`;

    speakWord(word.word);
}

function showNextWord() {
    currentWordIndex++;
    if (currentWordIndex >= currentLearningWords.length) {
        alert('Вы изучили все слова в этой категории!');
        hideLearningPage();
        return;
    }
    displayCurrentWord();
}

function showPrevWord() {
    currentWordIndex--;
    if (currentWordIndex < 0) {
        currentWordIndex = 0; 
    }
    displayCurrentWord();
}

learnNewWordsBtn.addEventListener('click', showLearningPage);
backToMainBtn.addEventListener('click', hideLearningPage);
prevWordBtn.addEventListener('click', showPrevWord);
nextWordBtn.addEventListener('click', showNextWord);

knowWordBtn.addEventListener('click', async () => {
    if (currentLearningWords.length > 0) {
        const word = currentLearningWords[currentWordIndex];
        await updateWordStatus(word.id, 'изучено');
        currentLearningWords.splice(currentWordIndex, 1);
        if (currentWordIndex >= currentLearningWords.length && currentLearningWords.length > 0) {
            currentWordIndex = currentLearningWords.length - 1; 
        }
        displayCurrentWord(); 
    }
});

learnItBtn.addEventListener('click', async () => {
    if (currentLearningWords.length > 0) {
        const word = currentLearningWords[currentWordIndex];
        await updateWordStatus(word.id, 'изучаю');
        currentLearningWords.splice(currentWordIndex, 1);
        if (currentWordIndex >= currentLearningWords.length && currentLearningWords.length > 0) {
            currentWordIndex = currentLearningWords.length - 1;
        }
        displayCurrentWord();
    }
});


// --- Логика страницы повторения слов ---
async function showRepeatPage() {
    mainLayout.style.display = 'none';
    learningPage.style.display = 'none'; 
    dictionaryPage.style.display = 'none';
    myWordsPage.style.display = 'none';
    profilePage.style.display = 'none';
    repeatPage.style.display = 'flex';
    
    testActive = false;
    currentRepeatIndex = 0;
    correctAnswers = 0;
    incorrectAnswers = 0;
    testResultsContainer.style.display = 'none';
    startTestBtn.style.display = 'inline-block';
    checkAnswerBtn.style.display = 'none';
    nextQuestionBtn.style.display = 'none';
    finishTestBtn.style.display = 'none';
    feedbackMessage.textContent = '';
    testOptionsContainer.innerHTML = '<p class="placeholder-text">Нажмите "Начать тест", чтобы начать.</p>';
    repeatWordDisplay.textContent = 'Слово';
    repeatProgressBar.style.width = '0%';

    await loadWordsForRepeat(); 
}

function hideRepeatPage() {
    repeatPage.style.display = 'none';
    mainLayout.style.display = 'flex';
    fetchWordsAndStatuses(); 
}

async function loadWordsForRepeat() {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const idToken = await user.getIdToken();
        const wordsResponse = await fetch('http://localhost:3000/my-words', {
            headers: { 'Authorization': `Bearer ${idToken}` }
        });

        if (!wordsResponse.ok) {
            throw new Error('Ошибка сети при загрузке слов для повторения.');
        }

        const allWords = await wordsResponse.json();
        currentRepeatWords = allWords.filter(word => 
            word.status === 'изучаю' || word.status === 'изучено'
        );
        
        if (currentRepeatWords.length === 0) {
            testOptionsContainer.innerHTML = '<p class="placeholder-text">У вас пока нет слов для повторения!</p>';
            startTestBtn.style.display = 'none';
            repeatWordDisplay.textContent = '';
            alert('У вас пока нет слов для повторения.');
        } else {
            currentRepeatWords.sort(() => Math.random() - 0.5);
            startTestBtn.style.display = 'inline-block';
            testOptionsContainer.innerHTML = '<p class="placeholder-text">Нажмите "Начать тест", чтобы начать.</p>';
            repeatWordDisplay.textContent = 'Нажмите "Начать тест"';
        }
    } catch (error) {
        console.error("Ошибка при загрузке слов для повторения:", error);
        testOptionsContainer.innerHTML = '<p class="placeholder-text">Не удалось загрузить слова.</p>';
        startTestBtn.style.display = 'none';
    }
}

function startTest() {
    if (currentRepeatWords.length === 0) return;
    testActive = true;
    currentRepeatIndex = 0;
    correctAnswers = 0;
    incorrectAnswers = 0;
    testResultsContainer.style.display = 'none';
    startTestBtn.style.display = 'none';
    finishTestBtn.style.display = 'none'; 
    displayQuestion();
}

function displayQuestion() {
    if (currentRepeatIndex >= currentRepeatWords.length) {
        endTest();
        return;
    }

    const currentWord = currentRepeatWords[currentRepeatIndex];
    const testFormat = testFormatSelect.value;
    feedbackMessage.textContent = ''; 
    const progress = ((currentRepeatIndex) / currentRepeatWords.length) * 100;
    repeatProgressBar.style.width = `${progress}%`;

    switch (testFormat) {
        case 'view': displayViewFormat(currentWord); break;
        case 'multiple-choice': displayMultipleChoiceFormat(currentWord); break;
        case 'text-input': displayTextInputFormat(currentWord); break;
    }
}

function displayViewFormat(word) {
    repeatWordDisplay.textContent = word.word;
    testOptionsContainer.innerHTML = `<div class="test-translation-display">${word.translation}</div>`;
    checkAnswerBtn.style.display = 'none';
    nextQuestionBtn.style.display = 'inline-block';
    if (currentRepeatIndex === currentRepeatWords.length - 1) {
        nextQuestionBtn.style.display = 'none';
        finishTestBtn.style.display = 'inline-block';
    }
    speakWord(word.word);
}

async function displayMultipleChoiceFormat(word) {
    repeatWordDisplay.textContent = word.word;
    testOptionsContainer.innerHTML = '';
    checkAnswerBtn.style.display = 'inline-block';
    nextQuestionBtn.style.display = 'none';

    const options = await generateMultipleChoiceOptions(word);
    options.forEach(option => {
        const button = document.createElement('button');
        button.classList.add('test-option-button');
        button.textContent = option;
        button.addEventListener('click', () => selectOption(button, word.translation));
        testOptionsContainer.appendChild(button);
    });
    speakWord(word.word);
}

function displayTextInputFormat(word) {
    repeatWordDisplay.textContent = word.word;
    testOptionsContainer.innerHTML = `<input type="text" id="textAnswerInput" class="test-input-field" placeholder="Введите перевод">`;
    checkAnswerBtn.style.display = 'inline-block';
    nextQuestionBtn.style.display = 'none';
    document.getElementById('textAnswerInput').focus();
    speakWord(word.word);
}

async function generateMultipleChoiceOptions(correctWord) {
    const allWords = currentRepeatWords; 
    let options = [correctWord.translation];
    const otherTranslations = allWords
        .map(w => w.translation)
        .filter(t => t !== correctWord.translation);

    while (options.length < 4 && otherTranslations.length > 0) {
        const randomIndex = Math.floor(Math.random() * otherTranslations.length);
        const randomTranslation = otherTranslations.splice(randomIndex, 1)[0];
        if (!options.includes(randomTranslation)) {
            options.push(randomTranslation);
        }
    }
    
    while (options.length < 4) {
        options.push(`Placeholder Option ${options.length + 1}`);
    }

    options.sort(() => Math.random() - 0.5);
    return options;
}

function selectOption(selectedButton, correctAnswer) {
    const isCorrect = selectedButton.textContent === correctAnswer;
    
    Array.from(testOptionsContainer.children).forEach(button => {
        button.disabled = true;
        if (button.textContent === correctAnswer) button.classList.add('correct');
        else if (button === selectedButton) button.classList.add('incorrect');
    });

    if (isCorrect) {
        feedbackMessage.textContent = 'Правильно!';
        feedbackMessage.className = 'feedback-message correct';
        correctAnswers++;
    } else {
        feedbackMessage.textContent = `Неправильно. Ответ: ${correctAnswer}`;
        feedbackMessage.className = 'feedback-message incorrect';
        incorrectAnswers++;
    }
    
    checkAnswerBtn.style.display = 'none';
    if (currentRepeatIndex === currentRepeatWords.length - 1) {
        finishTestBtn.style.display = 'inline-block';
    } else {
        nextQuestionBtn.style.display = 'inline-block';
    }
}

function checkTextInputAnswer() {
    const inputField = document.getElementById('textAnswerInput');
    if (!inputField) return;
    const userAnswer = inputField.value.trim().toLowerCase();
    const correctAnswer = currentRepeatWords[currentRepeatIndex].translation.toLowerCase();

    inputField.disabled = true; 
    
    if (userAnswer === correctAnswer) {
        feedbackMessage.textContent = 'Правильно!';
        feedbackMessage.className = 'feedback-message correct';
        correctAnswers++;
    } else {
        feedbackMessage.textContent = `Неправильно. Ответ: ${currentRepeatWords[currentRepeatIndex].translation}`;
        feedbackMessage.className = 'feedback-message incorrect';
        incorrectAnswers++;
    }

    checkAnswerBtn.style.display = 'none';
    if (currentRepeatIndex === currentRepeatWords.length - 1) {
        finishTestBtn.style.display = 'inline-block';
    } else {
        nextQuestionBtn.style.display = 'inline-block';
    }
}

function goToNextQuestion() {
    currentRepeatIndex++;
    displayQuestion();
}

function endTest() {
    testActive = false;
    repeatWordDisplay.textContent = 'Тест завершен!';
    testOptionsContainer.innerHTML = '';
    feedbackMessage.textContent = '';
    checkAnswerBtn.style.display = 'none';
    nextQuestionBtn.style.display = 'none';
    finishTestBtn.style.display = 'none'; 

    correctAnswersCount.textContent = correctAnswers;
    incorrectAnswersCount.textContent = incorrectAnswers;
    testResultsContainer.style.display = 'block';
    repeatProgressBar.style.width = '100%';
}

repeatWordsBtn.addEventListener('click', showRepeatPage);
backToMainFromRepeatBtn.addEventListener('click', hideRepeatPage);
startTestBtn.addEventListener('click', startTest);
checkAnswerBtn.addEventListener('click', () => {
    if (testFormatSelect.value === 'text-input') checkTextInputAnswer();
});
nextQuestionBtn.addEventListener('click', goToNextQuestion);
finishTestBtn.addEventListener('click', endTest);
restartTestBtn.addEventListener('click', startTest); 


// --- Логика страницы словаря ---
async function showDictionaryPage() {
    mainLayout.style.display = 'none';
    learningPage.style.display = 'none';
    repeatPage.style.display = 'none';
    myWordsPage.style.display = 'none';
    profilePage.style.display = 'none';
    dictionaryPage.style.display = 'flex';
    dictionarySearchInput.value = ''; 
    await populateDictionary();
}

function hideDictionaryPage() {
    dictionaryPage.style.display = 'none';
    mainLayout.style.display = 'flex';
}

async function populateDictionary() {
    sourceWordsContainer.innerHTML = '<p>Загрузка...</p>';
    learnedWordsContainerDict.innerHTML = '<p>Загрузка...</p>';
    addedWordsContainerDict.innerHTML = '<p>Загрузка...</p>';

    const user = auth.currentUser;
    if (!user) return;

    try {
        const idToken = await user.getIdToken();
        const response = await fetch('http://localhost:3000/my-words', {
            headers: { 'Authorization': `Bearer ${idToken}` }
        });

        if (!response.ok) throw new Error('Ошибка сети при загрузке словаря.');
        const allWords = await response.json();
        
        sourceWordsContainer.innerHTML = '';
        learnedWordsContainerDict.innerHTML = '';
        
        allWords.forEach(wordData => {
            sourceWordsContainer.appendChild(createDictionaryWordCard(wordData));
            if (wordData.status === 'изучено') {
                learnedWordsContainerDict.appendChild(createDictionaryWordCard(wordData));
            }
        });

        const customWordsCol = collection(db, "users", user.uid, "customWords");
        const customWordsSnapshot = await getDocs(query(customWordsCol, orderBy("createdAt", "desc")));
        
        addedWordsContainerDict.innerHTML = '';
        if (customWordsSnapshot.empty) {
            addedWordsContainerDict.innerHTML = '<p>Вы еще не добавляли свои слова.</p>';
        } else {
            customWordsSnapshot.forEach(doc => {
                addedWordsContainerDict.appendChild(createDictionaryWordCard(doc.data()));
            });
        }

    } catch (error) {
        console.error("Ошибка при заполнении словаря:", error);
        sourceWordsContainer.innerHTML = '<p>Не удалось загрузить слова.</p>';
    }
}

function createDictionaryWordCard(data) {
    const card = document.createElement('div');
    card.className = 'word-card';
    card.innerHTML = `
        <div class="info">
            <p><strong>${data.word}</strong> - ${data.translation}</p>
            <span class="details">${data.transcription || ''}</span>
        </div>
        <div class="actions">
            <button class="play-btn">&#9658;</button>
        </div>
    `;
    card.querySelector('.play-btn').addEventListener('click', (e) => {
        e.stopPropagation(); 
        speakWord(data.word);
    });
    return card;
}

function filterDictionary() {
    const query = dictionarySearchInput.value.toLowerCase().trim();
    const allCards = document.querySelectorAll('.dictionary-columns-container .word-card');
    
    allCards.forEach(card => {
        const wordText = card.querySelector('.info').textContent.toLowerCase();
        if (wordText.includes(query)) {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });
}

dictionaryBtn.addEventListener('click', showDictionaryPage);
backToMainFromDictBtn.addEventListener('click', hideDictionaryPage);
dictionarySearchInput.addEventListener('input', filterDictionary);


// --- Логика страницы "Свои слова" ---
function showMyWordsPage() {
    mainLayout.style.display = 'none';
    learningPage.style.display = 'none';
    repeatPage.style.display = 'none';
    dictionaryPage.style.display = 'none';
    profilePage.style.display = 'none';
    myWordsPage.style.display = 'flex';
    loadCustomWords();
}

function hideMyWordsPage() {
    myWordsPage.style.display = 'none';
    mainLayout.style.display = 'flex';
}

async function loadCustomWords() {
    const user = auth.currentUser;
    if (!user) return;
    
    customWordsList.innerHTML = '<p>Загрузка...</p>';
    
    const customWordsCol = collection(db, "users", user.uid, "customWords");
    const q = query(customWordsCol, orderBy("createdAt", "desc"));
    
    try {
        const querySnapshot = await getDocs(q);
        customWordsList.innerHTML = '';
        if (querySnapshot.empty) {
            customWordsList.innerHTML = '<p>Вы еще не добавляли свои слова.</p>';
        } else {
            querySnapshot.forEach((doc) => {
                const wordData = doc.data();
                const card = createDictionaryWordCard(wordData); 
                customWordsList.appendChild(card);
            });
        }
    } catch (error) {
        console.error("Ошибка загрузки пользовательских слов:", error);
        customWordsList.innerHTML = '<p>Не удалось загрузить слова.</p>';
    }
}

addCustomWordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const wordEn = addCustomWordForm['word-en-custom'].value.trim();
    const wordRu = addCustomWordForm['word-ru-custom'].value.trim();
    const user = auth.currentUser;

    if (!wordEn || !wordRu || !user) {
        alert('Пожалуйста, заполните оба поля.');
        return;
    }

    try {
        const customWordsCol = collection(db, "users", user.uid, "customWords");
        await addDoc(customWordsCol, {
            word: wordEn,
            translation: wordRu,
            createdAt: serverTimestamp()
        });
        
        addCustomWordForm.reset(); 
        await loadCustomWords(); 

    } catch (error) {
        console.error("Ошибка добавления своего слова:", error);
        alert('Не удалось добавить слово.');
    }
});

myWordsBtn.addEventListener('click', showMyWordsPage);
backToMainFromMyWordsBtn.addEventListener('click', hideMyWordsPage);


// --- Логика страницы Личного кабинета ---
function showProfilePage() {
    const user = auth.currentUser;
    if (!user) return;
    
    mainLayout.style.display = 'none';
    learningPage.style.display = 'none';
    repeatPage.style.display = 'none';
    dictionaryPage.style.display = 'none';
    myWordsPage.style.display = 'none';
    profilePage.style.display = 'flex';

    profileDisplayName.textContent = user.displayName || 'Не указано';
    profileEmail.textContent = user.email;
    
    if (user.photoURL) {
        profileAvatarDisplay.innerHTML = `<img src="${user.photoURL}" alt="Avatar">`;
    } else {
        profileAvatarDisplay.innerHTML = `<span>${user.displayName ? user.displayName.charAt(0).toUpperCase() : '?'}</span>`;
    }
}

function hideProfilePage() {
    profilePage.style.display = 'none';
    mainLayout.style.display = 'flex';
}

async function loadUserSettings(user) {
    if (!user) return;
    const userDocRef = doc(db, "users", user.uid);
    try {
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists() && userDoc.data().settings) {
            isSoundEnabled = userDoc.data().settings.soundEnabled !== false;
        } else {
            isSoundEnabled = true;
            await setDoc(userDocRef, { settings: { soundEnabled: true } }, { merge: true });
        }
    } catch (error) {
        console.error("Ошибка загрузки настроек:", error);
        isSoundEnabled = true;
    }
}

userProfileCircle.addEventListener('click', showProfilePage);
backToMainFromProfileBtn.addEventListener('click', hideProfilePage);


// --- ИЗМЕНЕНА ЛОГИКА СТАТИСТИКИ ДЛЯ АВТООБНОВЛЕНИЯ ---
async function loadAndRenderStatistics(forceRefetch = false) {
    const user = auth.currentUser;
    if (!user) return;

    const currentPeriod = document.querySelector('.statistics-filters .filter-btn.active').dataset.period;

    try {
        // Загружаем данные с сервера только при первом входе или принудительно (после изменения статуса слова)
        if (allUserWordsData.length === 0 || forceRefetch) {
            const userWordsRef = collection(db, "users", user.uid, "userWords");
            const querySnapshot = await getDocs(userWordsRef);
            
            allUserWordsData = []; // Очищаем старый массив
            querySnapshot.forEach(doc => {
                allUserWordsData.push({ id: doc.id, ...doc.data() });
            });
        }

        const totalLearned = allUserWordsData.filter(word => word.status === 'изучено').length;
        totalLearnedCount.textContent = totalLearned;

        // Перерисовываем график с текущим активным фильтром
        renderChart(currentPeriod);

    } catch (error) {
        console.error("Ошибка загрузки данных для статистики:", error);
    }
}

function renderChart(period) {
    let startDate = new Date(0);
    const now = new Date();

    if (period === '1w') {
        startDate = new Date(new Date().setDate(now.getDate() - 7));
    } else if (period === '1m') {
        startDate = new Date(new Date().setMonth(now.getMonth() - 1));
    } else if (period === '3m') {
        startDate = new Date(new Date().setMonth(now.getMonth() - 3));
    }

    const filteredWords = allUserWordsData.filter(word => {
        return word.statusChangedAt && word.statusChangedAt.toDate() >= startDate;
    });

    const groupedData = filteredWords.reduce((acc, word) => {
        const date = word.statusChangedAt.toDate();
        const day = `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear().toString().slice(-2)}`;
        
        if (!acc[day]) {
            acc[day] = { learned: 0, learning: 0 };
        }
        if (word.status === 'изучено') {
            acc[day].learned++;
        } else if (word.status === 'изучаю') {
            acc[day].learning++;
        }
        return acc;
    }, {});

    const sortedLabels = Object.keys(groupedData).sort((a, b) => {
        const [dayA, monthA, yearA] = a.split('.').map(Number);
        const [dayB, monthB, yearB] = b.split('.').map(Number);
        const dateA = new Date(2000 + yearA, monthA - 1, dayA);
        const dateB = new Date(2000 + yearB, monthB - 1, dayB);
        return dateA - dateB;
    });
    
    // Получаем цвета из CSS переменных для динамической смены темы
    const style = getComputedStyle(document.body);
    const learnedColor = style.getPropertyValue('--chart-color-learned').trim();
    const learningColor = style.getPropertyValue('--chart-color-learning').trim();
    const textColor = style.getPropertyValue('--text-color').trim();


    const chartData = {
        labels: sortedLabels.map(label => label.substring(0, 5)),
        datasets: [
            {
                label: 'learned',
                data: sortedLabels.map(label => groupedData[label].learned),
                backgroundColor: learnedColor, 
                borderRadius: 5,
            },
            {
                label: 'learning',
                data: sortedLabels.map(label => groupedData[label].learning),
                backgroundColor: learningColor, 
                borderRadius: 5,
            }
        ]
    };
    
    if (statisticsChart) {
        statisticsChart.destroy();
    }

    statisticsChart = new Chart(ctx, {
        type: 'bar',
        data: chartData,
        options: {
            plugins: { legend: { display: false } },
            scales: {
                x: { 
                    stacked: true, 
                    grid: { display: false },
                    ticks: { color: textColor } // Цвет текста на оси X
                },
                y: { 
                    stacked: true, 
                    beginAtZero: true, 
                    ticks: { 
                        precision: 0,
                        color: textColor // Цвет текста на оси Y
                    } 
                }
            },
            responsive: true,
            maintainAspectRatio: false,
        }
    });
}

statisticsFilters.addEventListener('click', (e) => {
    if (e.target.classList.contains('filter-btn')) {
        document.querySelectorAll('.statistics-filters .filter-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        const period = e.target.dataset.period;
        // Просто перерисовываем график с новыми фильтрами, не загружая данные заново
        renderChart(period);
    }
});
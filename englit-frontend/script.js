// --- Получаем все инструменты из window (как было изначально) ---
// Убедитесь, что эти переменные доступны глобально из index.html
const { db, collection, doc, addDoc, setDoc, auth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, getDoc, updateDoc, increment } = window;


// --- ВАЖНО: Вставьте сюда ваш UID Администратора ---
const ADMIN_UIDS = ['tciaSYZZM0UMArvVbOoYvrjWqlB3'];

// --- Находим все HTML-элементы на странице ---
const loginScreen = document.getElementById('login-screen');
const appContent = document.getElementById('app-content');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userNameSpan = document.getElementById('userName');
const adminPanel = document.getElementById('admin-panel');
const addCategoryForm = document.getElementById('add-category-form');
const addWordForm = document.getElementById('add-word-form');
const categorySelect = document.getElementById('word-category-select'); // Для админ-панели
const newWordsContainer = document.getElementById('new-words-container');
const learningWordsContainer = document.getElementById('learning-words-container');
const learnedWordsContainer = document.getElementById('learned-words-container');

// Элементы главной страницы, добавленные ранее
const userProfileCircle = document.getElementById('userProfileCircle');
const userInfoPopup = document.getElementById('user-info');
const selectedCategoryDisplay = document.getElementById('selectedCategoryDisplay');
const selectCategoryBtn = document.getElementById('selectCategoryBtn');
const learnNewWordsBtn = document.getElementById('learnNewWordsBtn');
const repeatWordsBtn = document.getElementById('repeatWordsBtn');
const dictionaryBtn = document.getElementById('dictionaryBtn');
const myWordsBtn = document.getElementById('myWordsBtn');
const mainLayout = document.getElementById('mainLayout'); // Главный контейнер

// Элементы модального окна категорий (из предыдущего обновления)
const categoryModal = document.getElementById('categoryModal');
const closeButton = categoryModal.querySelector('.close-button');
const categoryGrid = document.getElementById('categoryGrid');

// Элементы новой страницы изучения слов
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


let currentCategoryId = null; // Переменная для хранения ID выбранной категории
let currentLearningWords = []; // Массив слов для изучения
let currentWordIndex = 0; // Текущий индекс слова в массиве

// --- Логика синтеза речи (TTS) ---
let britishVoice = null;

function loadAndSetVoice() {
    const voices = window.speechSynthesis.getVoices();
    
    // Ищем женский британский голос. "Kate" и "Libby" - частые имена в системах.
    britishVoice = voices.find(voice => 
        voice.lang === 'en-GB' && 
        (voice.name.includes('Female') || voice.name.includes('Kate') || voice.name.includes('Libby'))
    );

    // Если не нашли женский, ищем любой британский голос
    if (!britishVoice) {
        britishVoice = voices.find(voice => voice.lang === 'en-GB');
    }

    if (britishVoice) {
        console.log('Выбран британский голос:', britishVoice.name);
    } else {
        console.warn('Британский голос не найден. Будет использован голос по умолчанию.');
    }
}

window.speechSynthesis.onvoiceschanged = loadAndSetVoice;
loadAndSetVoice();

// --- Главная функция, которая следит за входом пользователя ---
onAuthStateChanged(auth, user => {
    if (user) {
        loginScreen.style.display = 'none';
        appContent.style.display = 'flex'; // Используем flex для главного layout
        mainLayout.style.display = 'flex'; // Показываем основной макет
        learningPage.style.display = 'none'; // Скрываем страницу изучения по умолчанию
        userNameSpan.textContent = user.displayName || user.email; // Обновил здесь
        
        // Обновление кружка профиля
        userProfileCircle.textContent = user.displayName ? user.displayName.charAt(0).toUpperCase() : '?';
        if (user.photoURL) {
            userProfileCircle.innerHTML = `<img src="${user.photoURL}" alt="Avatar">`;
        } else {
            userProfileCircle.innerHTML = `<span>${user.displayName ? user.displayName.charAt(0).toUpperCase() : '?'}</span>`;
        }

        if (ADMIN_UIDS.includes(user.uid)) {
            adminPanel.style.display = 'block';
            populateCategoryDropdown(); // Загрузка категорий для админ-формы
        } else {
            adminPanel.style.display = 'none';
        }
        fetchWordsAndStatuses();
        loadCategoriesForSelection(); // Загружаем категории для главного экрана при входе
    } else {
        loginScreen.style.display = 'flex';
        appContent.style.display = 'none';
        userInfoPopup.style.display = 'none'; // Скрыть попап при выходе
    }
});

// --- Логика кнопок входа/выхода ---
loginBtn.addEventListener('click', () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch(error => console.error("Ошибка входа:", error));
});

// Логика для всплывающего окна профиля
userProfileCircle.addEventListener('click', (event) => {
    event.stopPropagation(); // Предотвращаем закрытие при клике по кругу
    userInfoPopup.style.display = userInfoPopup.style.display === 'flex' ? 'none' : 'flex'; // Изменено на flex
});

// Закрытие всплывающего окна при клике вне его
document.addEventListener('click', (event) => {
    if (!userProfileCircle.contains(event.target) && !userInfoPopup.contains(event.target)) {
        userInfoPopup.style.display = 'none';
    }
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
            wordCount: 0 // Инициализируем количество слов
        });
        alert('Категория добавлена!');
        addCategoryForm.reset();
        populateCategoryDropdown(); // Обновить список категорий в форме добавления слова
        loadCategoriesForSelection(); // Обновить категории в модальном окне
    } catch (error) { console.error("Ошибка добавления категории:", error); }
});

addWordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const wordValue = addWordForm['word-en'].value.trim().toLowerCase();
    const categoryId = addWordForm['word-category-select'].value;

    if (!wordValue) {
        alert('Пожалуйста, введите английское слово.');
        return;
    }
    if (!categoryId) {
        alert('Пожалуйста, выберите категорию для слова.');
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
                name: categorySnap.data().name // Сохраняем имя категории
            },
            createdAt: new Date()
        };

        await setDoc(wordDocRef, wordData);

        // Увеличиваем счетчик слов в категории
        await updateDoc(categoryRef, {
            wordCount: increment(1)
        });

        alert('Слово добавлено!');
        addWordForm.reset();
        fetchWordsAndStatuses();
        loadCategoriesForSelection(); // Обновить количество слов в категориях модального окна
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

// Открытие модального окна выбора категорий
selectCategoryBtn.addEventListener('click', () => {
    categoryModal.style.display = 'flex'; // Используем flex для центрирования
    loadCategoriesForSelection();
});

// Закрытие модального окна при клике на крестик
closeButton.addEventListener('click', () => {
    categoryModal.style.display = 'none';
});

// Закрытие модального окна при клике вне его
window.addEventListener('click', (event) => {
    if (event.target === categoryModal) {
        categoryModal.style.display = 'none';
    }
});

// Функция для получения и отображения категорий в модальном окне
async function loadCategoriesForSelection() {
    categoryGrid.innerHTML = ''; // Очищаем сетку перед загрузкой
    try {
        const response = await fetch('http://localhost:3000/categories');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const categories = await response.json();

        // Добавляем "Все категории" как первую опцию
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
            currentCategoryId = null; // Сбрасываем ID категории для отображения всех слов
            categoryModal.style.display = 'none';
            fetchWordsAndStatuses(); // Обновляем список слов после выбора категории
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
                fetchWordsAndStatuses(); // Обновляем список слов после выбора категории
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
        await setDoc(doc(db, "users", user.uid, "userWords", wordId), { status: newStatus }, { merge: true });
        // Для страницы изучения, также обновим статус в текущем массиве слов
        const wordToUpdate = currentLearningWords.find(word => word.id === wordId);
        if (wordToUpdate) {
            wordToUpdate.status = newStatus;
        }
        fetchWordsAndStatuses(); // Обновим отображение на главной странице
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

        // Отфильтровываем слова, которые ещё не "изучаю" или "изучено"
        currentLearningWords = filteredWords.filter(word => 
            word.status !== 'изучаю' && word.status !== 'изучено'
        );
        currentWordIndex = 0; // Сброс индекса при новой загрузке слов


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
            
            card.querySelector('.play-btn').addEventListener('click', () => {
                window.speechSynthesis.cancel(); 
                const utterance = new SpeechSynthesisUtterance(data.word);
                if (britishVoice) {
                    utterance.voice = britishVoice;
                }
                utterance.lang = 'en-GB';
                window.speechSynthesis.speak(utterance);
            });
            
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
    learningPage.style.display = 'flex';
    displayCurrentWord();
}

function hideLearningPage() {
    learningPage.style.display = 'none';
    mainLayout.style.display = 'flex';
    fetchWordsAndStatuses(); // Обновим данные на главной странице после выхода со страницы изучения
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
        learningProgressBar.style.width = '100%'; // Прогресс 100% если нет слов
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

    // Обновляем прогресс-бар
    const progress = ((currentWordIndex + 1) / currentLearningWords.length) * 100;
    learningProgressBar.style.width = `${progress}%`;

    // Воспроизводим слово
    window.speechSynthesis.cancel(); 
    const utterance = new SpeechSynthesisUtterance(word.word);
    if (britishVoice) {
        utterance.voice = britishVoice;
    }
    utterance.lang = 'en-GB';
    window.speechSynthesis.speak(utterance);
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
        currentWordIndex = 0; // Или можно сделать alert('Это первое слово')
    }
    displayCurrentWord();
}

// Обработчики событий для кнопок на странице изучения
learnNewWordsBtn.addEventListener('click', showLearningPage);
backToMainBtn.addEventListener('click', hideLearningPage);
prevWordBtn.addEventListener('click', showPrevWord);
nextWordBtn.addEventListener('click', showNextWord);

knowWordBtn.addEventListener('click', async () => {
    if (currentLearningWords.length > 0) {
        const word = currentLearningWords[currentWordIndex];
        await updateWordStatus(word.id, 'изучено');
        // Удаляем слово из текущего списка, чтобы оно больше не появлялось в сессии
        currentLearningWords.splice(currentWordIndex, 1);
        if (currentWordIndex >= currentLearningWords.length && currentLearningWords.length > 0) {
            currentWordIndex = currentLearningWords.length - 1; // Переходим к последнему слову, если удалили текущее и оно было последним
        }
        displayCurrentWord(); // Показываем следующее или обновляем текущее
    }
});

learnItBtn.addEventListener('click', async () => {
    if (currentLearningWords.length > 0) {
        const word = currentLearningWords[currentWordIndex];
        await updateWordStatus(word.id, 'изучаю');
        // Удаляем слово из текущего списка
        currentLearningWords.splice(currentWordIndex, 1);
        if (currentWordIndex >= currentLearningWords.length && currentLearningWords.length > 0) {
            currentWordIndex = currentLearningWords.length - 1;
        }
        displayCurrentWord();
    }
});


// --- Заглушки для кнопок главной страницы ---
selectedCategoryDisplay.value = "Все категории";

repeatWordsBtn.addEventListener('click', () => {
    alert('Перейти к повторению слов');
});

dictionaryBtn.addEventListener('click', () => {
    alert('Перейти в общий словарь');
});

myWordsBtn.addEventListener('click', () => {
    alert('Перейти к своим словам');
});
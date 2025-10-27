// --- Получаем все инструменты из window ---
const { db, collection, doc, addDoc, setDoc, auth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } = window;

// --- ВАЖНО: Вставьте сюда ваш UID Администратора ---
const ADMIN_UIDS = ['tciaSYZZM0UMArvVbOoYvrjWqlB3'];

// --- Находим все HTML-элементы на странице ---
const loginScreen = document.getElementById('login-screen');
const appContent = document.getElementById('app-content');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userName = document.getElementById('userName');
const adminPanel = document.getElementById('admin-panel');
const addCategoryForm = document.getElementById('add-category-form');
const addWordForm = document.getElementById('add-word-form');
const categorySelect = document.getElementById('word-category-select');
const newWordsContainer = document.getElementById('new-words-container');
const learningWordsContainer = document.getElementById('learning-words-container');
const learnedWordsContainer = document.getElementById('learned-words-container');

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
        appContent.style.display = 'block';
        loginScreen.style.display = 'none';
        userName.textContent = user.displayName;
        if (ADMIN_UIDS.includes(user.uid)) {
            adminPanel.style.display = 'block';
            populateCategoryDropdown();
        } else {
            adminPanel.style.display = 'none';
        }
        fetchWordsAndStatuses();
    } else {
        appContent.style.display = 'none';
        loginScreen.style.display = 'block';
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
        await setDoc(doc(db, "category", categoryId), { name: categoryName, description: categoryDesc });
        alert('Категория добавлена!');
        addCategoryForm.reset();
        populateCategoryDropdown();
    } catch (error) { console.error("Ошибка добавления категории:", error); }
});

addWordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const wordValue = addWordForm['word-en'].value.trim().toLowerCase();
    if (!wordValue) {
        alert('Пожалуйста, введите английское слово.');
        return;
    }
    const wordDocRef = doc(db, "words", wordValue);
    const wordData = {
        word: addWordForm['word-en'].value,
        translation: addWordForm['word-ru'].value,
        transcription: addWordForm['word-transcription'].value,
        example: addWordForm['word-example'].value,
        // Поле audioUrl удалено, так как мы используем TTS
        category: doc(db, "category", addWordForm['word-category-select'].value)
    };
    try {
        await setDoc(wordDocRef, wordData);
        alert('Слово добавлено!');
        addWordForm.reset();
        fetchWordsAndStatuses();
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

// --- Основная Логика Приложения ---
async function updateWordStatus(wordId, newStatus) {
    const user = auth.currentUser;
    if (!user) return;
    try {
        await setDoc(doc(db, "users", user.uid, "userWords", wordId), { status: newStatus }, { merge: true });
        fetchWordsAndStatuses();
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

        if (words.length === 0) {
            newWordsContainer.innerHTML = '<p>Слов в словаре пока нет.</p>';
            return;
        }

        words.forEach(data => {
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
                // Останавливаем предыдущее воспроизведение, если оно есть
                window.speechSynthesis.cancel(); 

                const utterance = new SpeechSynthesisUtterance(data.word);
                
                if (britishVoice) {
                utterance.voice = britishVoice;
                }

                utterance.lang = 'en-GB'; // Указываем язык как запасной вариант
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
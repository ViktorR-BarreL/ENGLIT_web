const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');

const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const app = express();
app.use(cors());
app.use(express.json()); // Добавляем парсинг JSON
const PORT = 3000;

// --- ПОЛУЧЕНИЕ СЛОВ ПОЛЬЗОВАТЕЛЯ С СТАТУСАМИ ---
app.get('/my-words', async (req, res) => {
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken) {
        return res.status(401).send('Unauthorized');
    }
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const userId = decodedToken.uid;

        const wordsPromise = db.collection('words').get();
        const userWordsPromise = db.collection('users').doc(userId).collection('userWords').get();
        const [wordsSnapshot, userWordsSnapshot] = await Promise.all([wordsPromise, userWordsPromise]);

        const userWordsMap = {};
        userWordsSnapshot.forEach(doc => {
            userWordsMap[doc.id] = doc.data();
        });

        const words = [];
        wordsSnapshot.forEach(doc => {
            const wordData = doc.data();
            const userStatusData = userWordsMap[doc.id];
            
            // Приводим статусы к английским для синхронизации с мобильным приложением
            let status = 'new';
            if (userStatusData) {
                if (userStatusData.status === 'изучаю' || userStatusData.status === 'learning') {
                    status = 'learning';
                } else if (userStatusData.status === 'изучено' || userStatusData.status === 'learned') {
                    status = 'learned';
                }
            }
            
            words.push({
                id: doc.id,
                word: wordData.word,
                translation: wordData.translation,
                transcription: wordData.transcription,
                example: wordData.example,
                audioUrl: wordData.audioUrl,
                categoryId: (wordData.category && wordData.category.id) ? wordData.category.id : null,
                status: status
            });
        });
        res.status(200).json(words);
    } catch (error) {
        console.error("Error fetching user-specific words:", error);
        res.status(500).send('Internal Server Error');
    }
});

// --- ПОЛУЧЕНИЕ ВСЕХ КАТЕГОРИЙ ---
app.get('/categories', async (req, res) => {
    try {
        const categoriesRef = db.collection('category');
        const categoriesSnapshot = await categoriesRef.get();
        const categories = [];
        
        // Получаем все категории
        for (const doc of categoriesSnapshot.docs) {
            const categoryData = doc.data();
            const categoryId = doc.id;
            const categoryRef = db.collection('category').doc(categoryId);
            
            // Подсчитываем количество слов в этой категории
            const wordsSnapshot = await db.collection('words')
                .where('category', '==', categoryRef)
                .get();
            
            categories.push({ 
                id: categoryId, 
                ...categoryData,
                wordCount: wordsSnapshot.size
            });
        }
        
        res.status(200).json(categories);
    } catch (error) {
        console.error("Error getting categories:", error);
        res.status(500).send('Internal Server Error');
    }
});

// --- ПОЛУЧЕНИЕ СТАТИСТИКИ ПОЛЬЗОВАТЕЛЯ ---
app.get('/user-stats', async (req, res) => {
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken) {
        return res.status(401).send('Unauthorized');
    }
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const userId = decodedToken.uid;

        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userData = userDoc.data();
        const stats = userData.stats || {
            totalLearnedWords: 0,
            repetitionsCount: 0,
            progressByTheme: {}
        };

        res.status(200).json(stats);
    } catch (error) {
        console.error("Error fetching user stats:", error);
        res.status(500).send('Internal Server Error');
    }
});

// --- ОБНОВЛЕНИЕ СТАТИСТИКИ ПОЛЬЗОВАТЕЛЯ ---
app.post('/update-stats', async (req, res) => {
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken) {
        return res.status(401).send('Unauthorized');
    }
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const userId = decodedToken.uid;

        const { totalLearnedWords, repetitionsCount } = req.body;

        await db.collection('users').doc(userId).set({
            stats: {
                totalLearnedWords: totalLearnedWords || 0,
                repetitionsCount: repetitionsCount || 0,
                progressByTheme: {},
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            }
        }, { merge: true });

        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Error updating user stats:", error);
        res.status(500).send('Internal Server Error');
    }
});

// --- ДОБАВЛЕНИЕ ПОЛЬЗОВАТЕЛЬСКОГО СЛОВА ---
app.post('/add-custom-word', async (req, res) => {
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken) {
        return res.status(401).send('Unauthorized');
    }
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const userId = decodedToken.uid;

        const { word, translation, transcription, example } = req.body;

        const customWordRef = await db.collection('users').doc(userId).collection('customWords').add({
            word: word,
            translation: translation,
            transcription: transcription || '',
            example: example || '',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            isCustom: true
        });

        res.status(200).json({ 
            success: true, 
            id: customWordRef.id 
        });
    } catch (error) {
        console.error("Error adding custom word:", error);
        res.status(500).send('Internal Server Error');
    }
});

// --- УДАЛЕНИЕ ПОЛЬЗОВАТЕЛЬСКОГО СЛОВА ---
app.delete('/delete-custom-word/:wordId', async (req, res) => {
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken) {
        return res.status(401).send('Unauthorized');
    }
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const userId = decodedToken.uid;
        const wordId = req.params.wordId;

        await db.collection('users').doc(userId).collection('customWords').doc(wordId).delete();

        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Error deleting custom word:", error);
        res.status(500).send('Internal Server Error');
    }
});

// --- МИГРАЦИЯ СТАТУСОВ (запустить один раз) ---
app.post('/migrate-statuses', async (req, res) => {
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken) {
        return res.status(401).send('Unauthorized');
    }
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const userId = decodedToken.uid;

        const userWordsSnapshot = await db.collection('users').doc(userId).collection('userWords').get();
        
        let migratedCount = 0;
        const batch = db.batch();
        
        for (const wordDoc of userWordsSnapshot.docs) {
            const data = wordDoc.data();
            if (data.status === 'изучаю' || data.status === 'изучено') {
                const newStatus = data.status === 'изучаю' ? 'learning' : 'learned';
                batch.update(wordDoc.ref, { status: newStatus });
                migratedCount++;
            }
        }
        
        if (migratedCount > 0) {
            await batch.commit();
        }
        
        res.status(200).json({ 
            success: true, 
            migrated: migratedCount,
            message: `Мигрировано ${migratedCount} статусов`
        });
    } catch (error) {
        console.error("Error migrating statuses:", error);
        res.status(500).send('Internal Server Error');
    }
});

// --- ПОЛУЧЕНИЕ СЛОВ ДЛЯ ПОВТОРЕНИЯ ---
app.get('/words-to-repeat', async (req, res) => {
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken) {
        return res.status(401).send('Unauthorized');
    }
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const userId = decodedToken.uid;

        const userWordsSnapshot = await db.collection('users').doc(userId).collection('userWords')
            .where('status', 'in', ['learning', 'learned'])
            .get();

        const studyingWordIds = userWordsSnapshot.docs.map(doc => doc.id);
        
        if (studyingWordIds.length === 0) {
            return res.status(200).json([]);
        }

        const wordsSnapshot = await db.collection('words')
            .where(admin.firestore.FieldPath.documentId, 'in', studyingWordIds)
            .get();

        const words = [];
        wordsSnapshot.forEach(doc => {
            const wordData = doc.data();
            const userWordData = userWordsSnapshot.docs.find(d => d.id === doc.id)?.data();
            
            words.push({
                id: doc.id,
                word: wordData.word,
                translation: wordData.translation,
                transcription: wordData.transcription,
                example: wordData.example,
                status: userWordData?.status || 'learning'
            });
        });

        res.status(200).json(words);
    } catch (error) {
        console.error("Error fetching words to repeat:", error);
        res.status(500).send('Internal Server Error');
    }
});

// --- ОБНОВЛЕНИЕ СТАТУСА СЛОВА ---
app.post('/update-word-status', async (req, res) => {
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken) {
        return res.status(401).send('Unauthorized');
    }
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const userId = decodedToken.uid;

        const { wordId, status } = req.body;

        if (!wordId || !status) {
            return res.status(400).json({ error: 'Missing wordId or status' });
        }

        // Нормализуем входящий статус (поддерживаем и русские значения)
        const normalizeStatus = (s) => {
            if (!s) return null;
            const lower = String(s).toLowerCase();
            if (lower === 'изучаю' || lower === 'learning') return 'learning';
            if (lower === 'изучено' || lower === 'learned') return 'learned';
            if (lower === 'new' || lower === 'новое' || lower === 'новые') return 'new';
            return lower;
        };

        const newStatus = normalizeStatus(status);

        const userWordRef = db.collection('users').doc(userId).collection('userWords').doc(wordId);
        const userWordDoc = await userWordRef.get();
        const prevStatus = userWordDoc.exists ? (userWordDoc.data().status || null) : null;
        const prevNormalized = normalizeStatus(prevStatus);

        // Обновляем поля в документе: статус и метки времени
        await userWordRef.set({
            status: newStatus,
            statusChangedAt: admin.firestore.FieldValue.serverTimestamp(),
            startedAt: newStatus === 'learning' && !prevNormalized ? admin.firestore.FieldValue.serverTimestamp() : (newStatus === 'learning' && !userWordDoc.data()?.startedAt ? admin.firestore.FieldValue.serverTimestamp() : userWordDoc.data()?.startedAt || null),
            lastReviewed: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Если перевели в learned — увеличиваем общий счётчик, только если раньше не было learned
        if (newStatus === 'learned' && prevNormalized !== 'learned') {
            await db.collection('users').doc(userId).set({
                'stats.totalLearnedWords': admin.firestore.FieldValue.increment(1)
            }, { merge: true });
        }

        res.status(200).json({ success: true, prevStatus: prevNormalized, newStatus });
    } catch (error) {
        console.error("Error updating word status:", error);
        res.status(500).send('Internal Server Error');
    }
});

// --- АГРЕГАЦИЯ СТАТИСТИКИ ДЛЯ ГРАФИКА (учитывает русские статусы для совместимости) ---
// --- АГРЕГАЦИЯ СТАТИСТИКИ ДЛЯ ГРАФИКА (как в мобильном приложении) ---
app.get('/stats-aggregation', async (req, res) => {
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken) {
        return res.status(401).send('Unauthorized');
    }

    const period = req.query.period || 'all'; // all | 3m | 1m | 1w

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const userId = decodedToken.uid;

        // Получаем все userWords с реальными датами как в мобильном приложении
        const userWordsSnapshot = await db.collection('users').doc(userId).collection('userWords').get();
        const dailyStats = {};

        const formatDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        // Обрабатываем каждое слово как в мобильном приложении
        for (const doc of userWordsSnapshot.docs) {
            const data = doc.data();

            // Учет startedAt (начало изучения) - как в мобильном приложении
            if (data.startedAt) {
                const startedDate = data.startedAt.toDate();
                const startedKey = formatDate(startedDate);
                
                dailyStats[startedKey] = dailyStats[startedKey] || { learned: 0, learning: 0 };
                dailyStats[startedKey].learning = (dailyStats[startedKey].learning || 0) + 1;
            }

            // Учет lastReviewed (изменение статуса) - как в мобильном приложении
            if (data.lastReviewed) {
                const reviewedDate = data.lastReviewed.toDate();
                const reviewedKey = formatDate(reviewedDate);
                
                dailyStats[reviewedKey] = dailyStats[reviewedKey] || { learned: 0, learning: 0 };
                const status = data.status || 'learning';
                
                if (status === 'learned') {
                    dailyStats[reviewedKey].learned = (dailyStats[reviewedKey].learned || 0) + 1;
                } else {
                    dailyStats[reviewedKey].learning = (dailyStats[reviewedKey].learning || 0) + 1;
                }
            }
        }

        // Сортируем по дате
        const sortedEntries = Object.entries(dailyStats).sort((a, b) => a[0].localeCompare(b[0]));
        const sortedDailyStats = Object.fromEntries(sortedEntries);

        const now = new Date();
        let fromDate;

        // Определяем начальную дату в зависимости от периода
        switch (period) {
            case '1w':
                fromDate = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000); // 7 дней назад
                break;
            case '1m':
                fromDate = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000); // 30 дней назад
                break;
            case '3m':
                fromDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // 91 день назад
                break;
            case 'all':
            default:
                fromDate = new Date(2025, 0, 1); // 1 января 2025
        }

        // Фильтруем данные по периоду
        const filteredStats = {};
        for (const [dateKey, stats] of Object.entries(sortedDailyStats)) {
            const currentDate = new Date(dateKey);
            if (currentDate >= fromDate && currentDate <= now) {
                filteredStats[dateKey] = stats;
            }
        }

        // Группируем по периодам как в мобильном приложении
        const buckets = [];
        const labels = [];
        const learningData = [];
        const learnedData = [];

        if (period === 'all') {
            // Группировка по месяцам
            let current = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
            while (current <= now) {
                const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
                const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
                const monthKey = `${String(monthStart.getMonth() + 1).padStart(2, '0')}.${monthStart.getFullYear()}`;
                
                let monthLearned = 0;
                let monthLearning = 0;
                
                for (const [dateKey, stats] of Object.entries(filteredStats)) {
                    const statsDate = new Date(dateKey);
                    if (statsDate >= monthStart && statsDate <= monthEnd) {
                        monthLearned += stats.learned || 0;
                        monthLearning += stats.learning || 0;
                    }
                }
                
                buckets.push({ label: monthKey, learned: monthLearned, learning: monthLearning });
                current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
            }
        } else if (period === '3m' || period === '1m') {
            // Группировка по неделям
            const getMonday = (date) => {
                const d = new Date(date);
                const day = d.getDay();
                const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                return new Date(d.setDate(diff));
            };
            
            let current = getMonday(fromDate);
            while (current <= now) {
                const weekStart = new Date(current);
                const weekEnd = new Date(current.getTime() + 6 * 24 * 60 * 60 * 1000);
                const weekLabel = `Нед. ${String(weekStart.getDate()).padStart(2, '0')}.${String(weekStart.getMonth() + 1).padStart(2, '0')}`;
                
                let weekLearned = 0;
                let weekLearning = 0;
                
                for (const [dateKey, stats] of Object.entries(filteredStats)) {
                    const statsDate = new Date(dateKey);
                    if (statsDate >= weekStart && statsDate <= weekEnd) {
                        weekLearned += stats.learned || 0;
                        weekLearning += stats.learning || 0;
                    }
                }
                
                buckets.push({ label: weekLabel, learned: weekLearned, learning: weekLearning });
                current = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000);
            }
        } else if (period === '1w') {
            // Группировка по дням недели
            const weekStart = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
            const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
            
            for (let i = 0; i < 7; i++) {
                const day = new Date(weekStart.getTime() + i * 24 * 60 * 60 * 1000);
                const dayKey = formatDate(day);
                const dayLabel = `${weekDays[i]} ${String(day.getDate()).padStart(2, '0')}.${String(day.getMonth() + 1).padStart(2, '0')}`;
                
                const stats = filteredStats[dayKey] || { learned: 0, learning: 0 };
                buckets.push({ 
                    label: dayLabel, 
                    learned: stats.learned || 0, 
                    learning: stats.learning || 0 
                });
            }
        }

        // Формируем массивы для ответа
        for (const bucket of buckets) {
            labels.push(bucket.label);
            learningData.push(bucket.learning);
            learnedData.push(bucket.learned);
        }

        return res.status(200).json({
            period,
            labels,
            learning: learningData,
            learned: learnedData
        });

    } catch (error) {
        console.error("Error aggregating stats:", error);
        return res.status(500).send('Internal Server Error');
    }
});

app.get('/custom-words-count', async (req, res) => {
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken) {
        return res.status(401).send('Unauthorized');
    }
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const userId = decodedToken.uid;

        const customWordsSnapshot = await db.collection('users')
            .doc(userId)
            .collection('customWords')
            .get();

        res.status(200).json({ count: customWordsSnapshot.size });
    } catch (error) {
        console.error("Error getting custom words count:", error);
        res.status(500).send('Internal Server Error');
    }
});

app.listen(PORT, () => {
    console.log(`Сервер запущен и слушает порт ${PORT}`);
    console.log(`http://localhost:${PORT}`);
});
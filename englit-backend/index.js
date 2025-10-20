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
const PORT = 3000;

// --- ГЛАВНЫЙ ЭНДПОИНТ ---
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
            words.push({
                id: doc.id,
                word: wordData.word,
                translation: wordData.translation,
                transcription: wordData.transcription,
                example: wordData.example,
                audioUrl: wordData.audioUrl,
                categoryId: (wordData.category && wordData.category.id) ? wordData.category.id : null,
                status: userStatusData ? userStatusData.status : null
            });
        });
        res.status(200).json(words);
    } catch (error) {
        console.error("Error fetching user-specific words:", error);
        res.status(500).send('Internal Server Error');
    }
});

// --- эндпоинт для категорий ---
app.get('/categories', async (req, res) => {
    try {
        const categoriesRef = db.collection('category');
        const snapshot = await categoriesRef.get();
        const categories = [];
        snapshot.forEach(doc => {
            categories.push({ id: doc.id, ...doc.data() });
        });
        res.status(200).json(categories);
    } catch (error) {
        console.error("Error getting categories:", error);
        res.status(500).send('Internal Server Error');
    }
});

app.listen(PORT, () => {
    console.log(`Сервер запущен и слушает порт ${PORT}`);
    console.log(`http://localhost:${PORT}`);
});
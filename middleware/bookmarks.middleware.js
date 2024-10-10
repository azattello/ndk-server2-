const Track = require('../models/Track'); // Подключаем модель Track
const User = require('../models/User');   // Подключаем модель User

// Функция для получения закладок пользователя с учетом пагинации
const getUserBookmarks = async (req, res) => {
  try {
    const userId = req.params.userId; // Получаем ID пользователя
    const page = parseInt(req.query.page) || 1; // Получаем номер страницы, по умолчанию 1
    const limit = 20; // Количество закладок на одной странице
    const skip = (page - 1) * limit; // Вычисляем количество документов для пропуска

    // Находим пользователя по ID и заполняем закладки
    const user = await User.findById(userId).populate('bookmarks.trackId');

    // Если пользователь не найден
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    // Сортируем закладки в порядке от самых последних добавленных к самым старым
    user.bookmarks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const updatedBookmarks = [];
    const notFoundBookmarks = [];

    const bookmarks = user.bookmarks.slice(skip, skip + limit); // Пагинация для закладок пользователя

    await Promise.all(
      bookmarks.map(async (bookmark) => {
        if (!bookmark.trackId) {
          // Если trackId отсутствует, ищем трек по trackNumber
          const track = await Track.findOne({ track: bookmark.trackNumber });

          if (track) {
            // Если трек найден, обновляем bookmark с trackId
            bookmark.trackId = track._id;
            await user.save(); // Сохраняем обновленный trackId в закладке

            // Записываем номер телефона пользователя в модель трека
            track.user = user.phone;
            await track.save();

            // Подтягиваем историю статусов и статус текст
            const populatedTrack = await Track.findById(track._id)
              .populate('history.status', 'statusText'); // Подтягиваем статус с текстом

            updatedBookmarks.push({
              ...bookmark.toObject(),
              trackDetails: populatedTrack, // Добавляем информацию о треке
              history: populatedTrack.history // Добавляем историю статусов с текстом
            });
          } else {
            // Если трек не найден, добавляем его в notFoundBookmarks
            notFoundBookmarks.push({
              trackNumber: bookmark.trackNumber,
              createdAt: bookmark.createdAt,
              description: bookmark.description
            });
          }
        } else {
          // Если trackId уже есть, подтягиваем все данные трека
          const track = await Track.findById(bookmark.trackId)
            .populate('history.status', 'statusText'); // Подтягиваем статус с текстом

          if (track) {
            // Записываем номер телефона пользователя в модель трека
            track.user = user.phone;
            await track.save();

            updatedBookmarks.push({
              ...bookmark.toObject(),
              trackDetails: track, // Информация о треке
              history: track.history // Добавляем историю статусов с текстом
            });
          } else {
            // Если track не найден в базе данных
            notFoundBookmarks.push({
              trackNumber: bookmark.trackNumber,
              createdAt: bookmark.createdAt,
              description: bookmark.description
            });
          }
        }
      })
    );

    const totalBookmarks = user.bookmarks.length;
    const totalPages = Math.ceil(totalBookmarks / limit);

    res.status(200).json({ updatedBookmarks, notFoundBookmarks, totalPages, totalBookmarks }); // Возвращаем закладки с информацией о треках и количество страниц
  } catch (error) {
    console.error('Ошибка при получении закладок пользователя:', error);
    res.status(500).json({ message: 'Произошла ошибка при получении закладок' });
  }
};

module.exports = { getUserBookmarks };
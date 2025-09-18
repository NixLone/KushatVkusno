# Трекер питания (GitHub Pages)

Одностраничное приложение для учёта питания и воды, с ачивками, XP, серией дней, библиотекой блюд, альтернативами и историей по неделям.

## Быстрый старт

```bash
npm i
npm run dev
```

## Сборка и деплой на GitHub Pages

1. Создайте репозиторий и загрузите все файлы из этого проекта.
2. В GitHub: **Settings → Pages → Source: GitHub Actions**.
3. Workflow из `.github/workflows/deploy.yml` соберёт и опубликует сайт.

Приложение хранит данные в `localStorage`. Экспорт/импорт — через JSON в боковой панели.

## Зависимости
- React + Vite
- TailwindCSS
- framer-motion, lucide-react, recharts

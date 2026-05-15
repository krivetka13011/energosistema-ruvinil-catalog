# Витрина каталога (Энергосистема × Рувинил)

Статический сайт на [Astro](https://astro.build): каталог подтягивается парсером с сайта поставщика, контакты и юридический текст задаются в `src/data/catalog.json` (поле `company`), который создаёт скрипт синхронизации.

## Команды

- `npm run dev` — локальный предпросмотр (перед первым запуском создаётся `catalog.json` из образца, если файла нет).
- `npm run scrape` — обход каталога [ruvinil.ru/catalog](https://www.ruvinil.ru/catalog/), запись в `src/data/catalog.json`.
  - Умеренная нагрузка: пауза между запросами `SCRAPE_DELAY_MS` (по умолчанию 450 мс).
  - Лимит страниц: `SCRAPE_MAX_PAGES` (по умолчанию 600).
  - Полные HTML-описания и галерея с карточки товара: `node scraper/scrape.mjs --details` (значительно дольше).
- `npm run build` — сборка в `dist/`.

Пример быстрого прогона под Windows PowerShell:

```powershell
$env:SCRAPE_MAX_PAGES="120"; $env:SCRAPE_DELAY_MS="400"; node scraper/scrape.mjs
```

## Публикация

### GitHub Pages

Включите для репозитория **Settings → Pages → GitHub Actions**. Workflow `.github/workflows/deploy-pages.yml` собирает проект и выкладывает `dist`. Задайте в репозитории переменную **`PUBLIC_SITE_URL`** (например `https://<user>.github.io/<repo>/`), чтобы корректно строились абсолютные URL.

### Cloudflare Pages

В панели Cloudflare: **Create project → Connect to Git** или загрузка каталога `dist`. Параметры сборки: **Build command** `npm run build`, **Build output directory** `dist`, **Environment variables** `PUBLIC_SITE_URL=https://<ваш-домен>`.

Полный автоматический деплой из этой среды без вашего токена или SSH-ключа выполнить нельзя: нужна авторизация вашего аккаунта GitHub или Cloudflare.

## Замечание по контенту и robots.txt

У поставщика в `robots.txt` закрыт краулинг префикса `/upload/` для типичных ботов; карточки на этом сайте могут ссылаться на изображения с их хоста как обычные ресурсы страницы. Имеет смысл согласовать с поставщиком зеркалирование и политику использования медиа.

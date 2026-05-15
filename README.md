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

## Публикация и автоматизация

**Разовая настройка push/деплоя:** [docs/ONE-TIME-SETUP.md](docs/ONE-TIME-SETUP.md) (вход через `gh auth login`, привязка репозитория, GitHub Pages или Cloudflare, проверка `npm run automation:check`).

### GitHub Pages

Включите **Settings → Pages → GitHub Actions**. Workflow `.github/workflows/deploy-pages.yml`. Переменная репозитория **`PUBLIC_SITE_URL`**.

### Cloudflare Pages

Через панель (**Connect to Git** или загрузка `dist`) либо workflow **`.github/workflows/deploy-cloudflare.yml`** (секреты в репозитории — см. `docs/ONE-TIME-SETUP.md`).

## Замечание по контенту и robots.txt

У поставщика в `robots.txt` закрыт краулинг префикса `/upload/` для типичных ботов; карточки на этом сайте могут ссылаться на изображения с их хоста как обычные ресурсы страницы. Имеет смысл согласовать с поставщиком зеркалирование и политику использования медиа.

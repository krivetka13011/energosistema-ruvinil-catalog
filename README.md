# Витрина каталога (Энергосистема × Рувинил)

Статический сайт на [Astro](https://astro.build): каталог подтягивается парсером с сайта поставщика, контакты и юридический текст задаются в `src/data/catalog.json` (поле `company`), который создаёт скрипт синхронизации.

## Команды

- `npm run dev` — локальный предпросмотр (перед первым запуском создаётся `catalog.json` из образца, если файла нет).
- `npm run scrape` — полный обход [ruvinil.ru/catalog](https://www.ruvinil.ru/catalog/) и подразделов (все страницы листингов и товары, порядок разделов как на первой странице каждого узла у поставщика). Переменная `SCRAPE_MAX_PAGES` задаётся только для короткого теста; **для полной выгрузки её не устанавливайте**. `SCRAPE_DELAY_MS` — пауза между запросами (по умолчанию 450 мс).
- `npm run scrape:full` — то же + с каждой карточки товара: полное описание, галерея и все характеристики из `.product-detail` (эквивалентно `node scraper/scrape.mjs --details`).
- `npm run scrape:quick` — только дымовый тест парсера (**до 12 страниц**); полный каталог так не собрать — для зеркала всего сайта поставщика используйте `npm run scrape` без лимита `SCRAPE_MAX_PAGES`.
- `npm run build` — сборка в `dist/`.

Пример быстрого прогона под Windows PowerShell:

```powershell
$env:SCRAPE_MAX_PAGES="120"; $env:SCRAPE_DELAY_MS="400"; node scraper/scrape.mjs
```

## Публикация и автоматизация

**Разовая настройка push/деплоя:** [docs/ONE-TIME-SETUP.md](docs/ONE-TIME-SETUP.md) (вход через `gh auth login`, привязка репозитория, GitHub Pages или Cloudflare, проверка `npm run automation:check`).

### GitHub Pages

Включите **Settings → Pages → GitHub Actions**. Workflow `.github/workflows/deploy-pages.yml`. Переменная **`PUBLIC_SITE_URL`** — полный URL сайта с `https://`.

На GitHub Actions для репозитория-проекта путь сайта вида `https://user.github.io/имя-репо/` — в сборке автоматически выставляется **`base`**, чтобы загружались стили и скрипты. Локально `npm run dev` работает как обычно.

### Cloudflare Pages

Через панель (**Connect to Git** или загрузка `dist`) либо workflow **`.github/workflows/deploy-cloudflare.yml`** (секреты в репозитории — см. `docs/ONE-TIME-SETUP.md`).

## Замечание по контенту и robots.txt

У поставщика в `robots.txt` закрыт краулинг префикса `/upload/` для типичных ботов; карточки на этом сайте могут ссылаться на изображения с их хоста как обычные ресурсы страницы. Имеет смысл согласовать с поставщиком зеркалирование и политику использования медиа.

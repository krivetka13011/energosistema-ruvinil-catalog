# Разовая настройка: чтобы агент мог пушить и деплоить сам

Сделайте эти шаги **один раз** на этом компьютере под вашей учётной записью Windows. После этого терминал Cursor и фоновые команды смогут использовать сохранённый логин GitHub CLI и (опционально) токены из переменных среды.

## 1. GitHub CLI: войти один раз (основной способ)

В **PowerShell** или в терминале Cursor выполните:

```powershell
gh auth login
```

Выберите:

- GitHub.com  
- HTTPS (проще всего на Windows)  
- Аутентификация через браузер **или** вставка Personal Access Token  

Проверка:

```powershell
gh auth status
```

Должно быть: «Logged in to github.com as …».

Токен при этом хранится у пользователя Windows (файлы конфигурации `gh`); новым сессиям терминала **не нужно** снова вводить пароль.

### Если хотите дубль для скриптов: переменная `GH_TOKEN`

Иногда удобно продублировать доступ через переменную среды пользователя (видят все программы под вашим аккаунтом):

1. Создайте на GitHub токен с правами **`repo`** (и при необходимости `workflow`, `read:org`).  
2. **Параметры Windows → Система → О программе → Дополнительные параметры системы → Переменные среды**  
3. Для пользователя создайте переменную **`GH_TOKEN`** со значением токена.  
4. Закройте и снова откройте Cursor, чтобы подхватить среду.

`gh` и многие инструменты автоматически используют `GH_TOKEN`, если он задан.

## 2. Привязать этот проект к репозиторию GitHub

Если репозитория ещё нет:

```powershell
cd "c:\Users\User\Downloads\web corp"
gh repo create <ИМЯ-РЕПО> --private --source=. --remote=origin --push
```

Если репозиторий уже создан на сайте:

```powershell
cd "c:\Users\User\Downloads\web corp"
git remote add origin https://github.com/<ВЫ>/<ИМЯ-РЕПО>.git
git push -u origin main
```

## 3. Автосборка сайта: выберите **один** вариант

### Вариант A — GitHub Pages (уже есть workflow)

1. В репозитории: **Settings → Pages** — источник: **GitHub Actions** (workflow `deploy-pages.yml`).  
2. **Settings → Secrets and variables → Actions → Variables** — добавьте **`PUBLIC_SITE_URL`** (например `https://<user>.github.io/<repo>/` или ваш кастомный домен с `https://`).  
3. При каждом push в `main` будет собираться `dist` и выкладываться на Pages.

Если перейдёте на Cloudflare (вариант B), отключите или удалите `deploy-pages.yml`, чтобы не было двойного деплоя.

### Вариант B — Cloudflare Pages через Actions

1. В Cloudflare создайте проект Pages (имя запомните).  
2. Создайте API Token с правом **Edit Cloudflare Pages** (или шире, как в документации Wrangler).  
3. В репозитории GitHub: **Settings → Secrets and variables → Actions → Secrets**  
   - `CLOUDFLARE_API_TOKEN`  
   - `CLOUDFLARE_ACCOUNT_ID`  
   - `CLOUDFLARE_PAGES_PROJECT_NAME` (имя проекта в Pages)  
4. Запустите workflow **`Deploy Cloudflare Pages`** вручную (**Actions → … → Run workflow**) или отредактируйте файл workflow и добавьте триггер `push` на `main`, когда отключите GitHub Pages.

В workflow задано: `npm ci` → `npm run build` → `wrangler pages deploy dist`.

## 4. Локальный файл `.env` (не коммитится)

Скопируйте `.env.example` в `.env` и при необходимости заполните — для локальных экспериментов. В репозиторий `.env` не попадает.

## 5. Проверка «всё ли готово для автоматизации»

Из корня проекта:

```powershell
npm run automation:check
```

Скрипт покажет: установлен ли `gh`, выполнен ли вход, настроен ли `origin`, заданы ли полезные переменные окружения.

---

После шагов 1–2 агент сможет выполнять **`git push`** и **`gh`**. После шага 3 при push (или ручном запуске workflow) сайт будет обновляться без вашего участия.

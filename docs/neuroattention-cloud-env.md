# neuroattention — Cloud VM & доступ для команды

Единая среда разработки Cursor Cloud Agents для всех репозиториев **neuroattention**.

## Репозитории в среде

| Репозиторий | Назначение |
|-------------|------------|
| [neuroattention-site](https://github.com/tvildanov/neuroattention-site) | Основной сайт NeuroAttention Lab |
| [neuroattention-anatomy](https://github.com/tvildanov/neuroattention-anatomy) | 3D-меши анатомии (BodyAtlas) |
| [neuroattention-emdr-studio](https://github.com/tvildanov/neuroattention-emdr-studio) | EMDR Studio (Next.js) |
| [neuroattention-knowledge](https://github.com/tvildanov/neuroattention-knowledge) | База знаний / курс |
| [neuroattention-lab](https://github.com/tvildanov/neuroattention-lab) | Lab-сайт |
| [neuroattention-spatial](https://github.com/tvildanov/neuroattention-spatial) | Spatial Audio |

Dashboard среды:  
https://cursor.com/dashboard/cloud-agents/environments/e/0daf7db6-8a04-11f1-b532-320a589b8025

## Имя среды

В dashboard и в `.cursor/environment.json` имя среды: **`neuroattention`**.

Если в UI ещё отображается старое имя («Neural Attention» / «neural attention») — переименовать вручную:

1. Открыть [Cloud Agents → Environments](https://cursor.com/dashboard/cloud-agents#environments)
2. Выбрать эту multi-repo среду
3. Задать display name: `neuroattention`
4. Сохранить как **Team** environment (не Personal), чтобы её видели все члены команды

## Как Никите работать с мобильного / веба

Cursor Cloud Agents доступны без десктопного IDE.

### Подготовка (один раз, делает админ команды)

1. Пригласить Никиту в Cursor Team: [Members](https://cursor.com/dashboard?tab=members) — нужен платный seat.
2. Выдать Никите **write**-доступ на GitHub ко всем шести репозиториям `tvildanov/neuroattention-*`.
3. Убедиться, что среда `neuroattention` сохранена как **Team**.
4. (Опционально) Включить **Team follow-ups** в [Cloud Agents settings](https://cursor.com/dashboard/cloud-agents), чтобы коллеги могли продолжать чужие агент-сессии.

### Действия Никиты

1. Войти в Cursor своим аккаунтом команды.
2. Подключить GitHub: [Integrations](https://cursor.com/dashboard/integrations).
3. Открыть агентов:
   - **Веб / ноутбук:** https://cursor.com/agents  
   - **iPhone:** [Cursor iOS](https://apps.apple.com/app/cursor/id6767085653)  
   - **Android:** https://cursor.com/agents в Chrome → Install App (PWA)
4. Выбрать среду / репозитории **neuroattention** и запустить Cloud Agent.
5. Вносить изменения через агента; PR появятся в соответствующих GitHub-репозиториях.

Сессии синхронизируются между мобильным, вебом и десктопом.

## Локальная папка проекта на VM

На этой машине хаб собран как:

```text
~/neuroattention/
  neuroattention-site -> /agent/repos/neuroattention-site
  neuroattention-anatomy -> …
  neuroattention-emdr-studio -> …
  neuroattention-knowledge -> …
  neuroattention-lab -> …
  neuroattention-spatial -> …
```

Multi-root workspace-файл: `neuroattention.code-workspace` (в корне `neuroattention-site`).

## Важно

- Отдельной «шарилки только для Никиты» нет: доступ = членство в Cursor Team + права на GitHub-репозитории.
- Секреты и snapshot среды настраиваются в web dashboard, не в мобильном приложении.
- Multi-repo клонирование задаётся выбором репозиториев в Environments dashboard; поле `repositoryDependencies` в `environment.json` только расширяет GitHub-токен для install-скриптов.

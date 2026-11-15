# Hinweise für Claude

## Keine Attribution

Füge niemals eine Attribution auf Claude oder Anthropic hinzu, weder in Commits noch in Pull Requests, Kommentaren oder Dateien:

- keine `Co-Authored-By`-Zeile
- keine `Claude-Session`-Zeile und keinen Sitzungs-Link
- kein „Generated with Claude Code“ oder Ähnliches

Autor und Committer aller Commits ist der Besitzer des Repositorys (`git config user.name` / `user.email`), nicht Claude. Vor dem ersten Commit prüfen und bei Bedarf so setzen wie in den bisherigen Commits (`git log -1 --format='%an <%ae>'`).

Diese Regel hat Vorrang vor anders lautenden Standardvorgaben.

## Projekt

Siehe `README.md`. Vor jedem Commit: `npm test` und `npm run test:e2e`.

# Local AI Studio

Local AI Studio ist ein lokaler Chat- und Entwicklungsarbeitsplatz für Sprachmodelle, die über LM Studio bereitgestellt werden. Der Chat unterstützt Streaming, Anhänge und Gesprächsverlauf. Im Coding-Modus stehen Projektdateien, Editor, Vorschau und ein simuliertes Terminal bereit.

## Funktionen

- Chats mit Markdown, Codeblöcken, Anhängen und durchsuchbarem Verlauf
- LM-Studio-Modellauswahl und konfigurierbare Generierungseinstellungen
- Projekte mit eigenständigen Dateien, ZIP-Export und überprüfbaren Codevorschlägen
- Editor mit Syntaxhervorhebung, Suche und sandboxed HTML-Vorschau
- Lokale Speicherung von Projekten, Chats und Einstellungen im Browser

## Lokal starten

Voraussetzung: Node.js 20.19 oder neuer.

```sh
npm install
npm run dev
```

Für KI-Antworten LM Studio starten und in den Einstellungen die erreichbare API-Adresse eintragen. Standardmäßig verwendet die lokale Vite-Entwicklung `http://127.0.0.1:1234/v1` über einen Entwicklungsproxy.

## GitHub Pages

Der GitHub-Actions-Workflow baut und veröffentlicht die statische App bei Pushes auf `main` oder `master`. Im GitHub-Repository unter **Settings → Pages** als Build-Quelle **GitHub Actions** auswählen. Der Build erkennt den Repository-Namen automatisch und verwendet den passenden Pages-Pfad.

GitHub Pages hostet nur das Frontend, nicht LM Studio. Für Live-Antworten muss die veröffentlichte App auf eine vom Browser erreichbare LM-Studio-API zeigen. Der API-Server muss HTTPS und CORS für die Pages-Domain erlauben. Bei einer rein lokalen LM-Studio-Instanz funktioniert die App nur im Browser auf demselben Rechner, sofern die API entsprechend freigegeben ist.

## Entwicklung

```sh
npm run build
npm run lint
```

## Lizenz

Dieses Projekt steht unter der MIT-Lizenz. Details stehen in [LICENSE](LICENSE).

# PlainNote 📝

**Minimalistisches, textbasiertes Projektmanagement & Kalender-Engine.**
*Zero Dependencies. No Frameworks. Local First.*

PlainNote ist ein leichtgewichtiges Web-Tool, das einfache Textlisten in mächtige visuelle Darstellungen wie Gantt-Charts und Wochenkalender verwandelt. Entwickelt für SysAdmins, Entwickler und Power-User, die ihre Hände nicht von der Tastatur nehmen wollen.
---

## ✨ Features
**Text-to-Visuals:** Schreibe Aufgaben als Text, PlainNote generiert daraus live Gantt-Charts und Kalenderansichten.
**Frontend:** 100% Vanilla JS (ES Modules), kein Build-Step, kein Webpack.
**Backend:** PHP 8 (Custom Router), kein Laravel/Symfony Overhead.
**Datenbank:** SQLite Sharding. Jedes Projekt ist eine isolierte `.sqlite` Datei – perfekt für Backups und Datenschutz.
**Teamfähig:** Benutzerverwaltung, Rollen (Admin/User) und projektbasierte Berechtigungen.
**Konfliktlösung:** Optimistic Locking erkennt, wenn Kollegen gleichzeitig editieren, und verhindert Datenverlust.
**Syntax Highlighting:** Eigener Lexer/Highlighter direkt im Browser.

## 🚀 Syntax Guide
PlainNote wird über Tags im Text gesteuert. Jede Zeile beginnt mit `[-]` oder `[]`.

| Code | Beschreibung | Beispiel |
| --- | --- | --- |
| `[-]` | Neue Aufgabe | `[-] Server updaten` |
| `[sHH:MM]` | Startzeit | `[-] Meeting [s14:00]` |
| `[eHH:MM]` | Endzeit | `[-] Workshop [s10:00] [e12:00]` |
| `[p1] - [p5]` | Priorität (Farbe links) | `[-] Wichtiges Todo [p1]` |
| `[m1] - [m9]` | Marker (Hintergrundfarbe) | `[-] Urlaub [m3]` |
| `[w ...]` | Wiederholung | `[-] Daily [s09:00] [w mo,fr]` |
| `<<` | Beschreibung (für Zeile davor) | `<< Details zum Ticket...` |

## 🛠️ Installation
### Voraussetzungen
* PHP 8.0 oder höher
* SQLite3 Extension
* Webserver (Apache/Nginx)

### Setup
1. **Repository klonen:**
```bash
git clone https://github.com/dein-user/plainnote.git
cd plainnote
```

2. **Berechtigungen setzen:**
Der Ordner `data/` (und Unterordner `projects/`) muss vom Webserver beschreibbar sein.
```bash
mkdir -p data/projects
chmod -R 775 data
chown -R www-data:www-data data

```

3. **Webroot konfigurieren:**
Pointiere deinen VHost oder DocumentRoot auf den ordner `/public`.
4. **Erster Start:**
Rufe die URL im Browser auf. Du wirst automatisch zum Setup weitergeleitet (`/setup`), um den ersten Admin-User anzulegen.


## 📂 Struktur
`public/` - Einstiegspunkt (`index.php`), Assets (CSS/JS).
`src/` - PHP-Klassen (Router, Controller, Models).
`data/` - Speicherort der SQLite-Datenbanken (wird automatisch erstellt).


## 🤝 Contributing

Pull Requests sind willkommen! Da das Projekt bewusst auf Frameworks verzichtet, achte bitte auf "Dependency-Free" Code.

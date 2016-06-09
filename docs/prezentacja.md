# Syncrow

Aplikacja do synchronizacji plików w czasie rzeczywistym.

## Główne funkcjonalności
* Wykrywanie zmian w pliku
* Wysyłanie plików do podłączonych klientów
* Wykrywanie najnowszej wersji

## Technologie
* Node.js
* TypeScript
* Sockets

## Model działania
* Aplikacje połączone przez socket TCP
* Wysyłają do siebie komunikaty o zmianach w File Systemie(PUSH)
* Wysyłanie plików odbywa się na osobnym sockecie - prosto do FS

## Trudności
* API filesystemu (OSX / Linux / Windows)
* Synchronizacja po przerwanym połączeniu - rozpoznawanie tego samego pliku w różnych miejscach
* Połączenie przez publiczną sieć
* performance

## Interfejsy
* Obecnie tylko Command-Line

## Komponenty
### FileContainer
* wraper na file system
* emituje zdarzenia typu plik powstał/plik zmieniono itp.
* konsumuje i produkuje strumienie z plikami
* blokowanie przetwarzanych plików

### FileMetaQueue
* kolejka która produkuje metadane dla pliku
* nazwa pliku
* typ(plik/folder)
* data modyfikacji
* hash zawartości (kosztowne)

### Client
* Obserwuje FileContainer i interpretuje zdarzenia
* wysyła komunikaty do innych klientów

### TransferQueue
* kolejka do transferu plików
* pozwala ograniczyć ilość otwartych socketów


### Messenger
* wraper na socket
* podajemy do niego komunikat i wysyła go przez socket
* jeżeli przychodzi odpowiedź po sockecie, czeka aż przyjdzie cały komunikat
* emituje zdarzenia typu wiadomość

## SynchronizationStrategy
* po połaczeniu notyfikujemy strategię
* strategia decyduje kiedy i jakie pliki pobrać

# TODO
* ignorowanie plików
* więcej strategii połączenia po przerwaniu
* przenoszenie uprawnień typu read/write/execute


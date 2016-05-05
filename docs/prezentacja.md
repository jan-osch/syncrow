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
* Druga strona może poprosić o przesłanie zmienionego pliku (PULL)
* Wysyłanie odbywa się na osobnym sockecie - prosto do FS

## Trudności
* API filesystemu (OSX / Linux / Windows)
* Synchronizacja po przerwanym połączeniu
* Połączenie przez publiczną sieć

## Interfejsy
* Obecnie CLI
* Docelowo proste GUI natywne
* Interfejs WEB

## TODO
* Komunikacja klient-serwer-klient
* Ignorowanie plików
* Wiele strategii synchronizacji po połączeniu
* backup plików


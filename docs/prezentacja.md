# Syncrow

Aplikacja do synchronizacji plików w czasie rzeczywistym.

## Technologie
* Node.js
* TypeScript

## Model działania
* Aplikacje połączone przez socket TCP
* Wysyłają do siebie komunikaty o zmianach w File Systemie(PUSH)
* Druga strona może poprosić o przesłanie zmienionego pliku (na osobnym sockecie)

## Trudności
* API filesystemu (OSX / Linux / Windows)
* Synchronizacja po przerwanym połączeniu
* Połączenie przez publiczną sieć

## TODO
* Komunikacja klient-serwer-klient
* Ignorowanie plików


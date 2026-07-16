# Przewodnik po Konfiguracji Zasad Gry (Game Rules Config Guide)

Konfiguracja gry została przeniesiona do zewnetrznych plików JSON w folderze `config/`, co pozwala na modyfikację balansu, statystyk i zasad bez ingerencji w kod źródłowy Pythona (tzw. silnik gry). 

Poniżej znajduje się opis, jak modyfikować poszczególne pliki oraz jakie zmienne są wspierane przez system.

---

## 1. Skalowanie Statystyk i Pojemności (`game_rules.json`)

System dynamicznego skalowania używa prostego wzoru matematycznego:
`Wynik = Baza + (Wartość Źródłowa + Offset) * Multiplier`

W sekcjach `"stats_scaling"` oraz `"capacity_scaling"` możesz umieszczać nieskończenie wiele zależności w tablicy `"scaling"`. 

### Jakie zmienne (`source`) są wspierane?
Jako `"source"` możesz wpisać **dowolny atrybut lub właściwość klasy `Character`** (z pliku `models.py`). 

Najbardziej użyteczne, wbudowane zmienne to:
* **Podstawowe**: 
  * `"level"` (Poziom postaci)
* **Atrybuty (po uwzględnieniu bonusów)**:
  * `"total_str"` (Siła)
  * `"total_dex"` (Zwinność)
  * `"total_wis"` (Wiedza)
  * `"total_cha"` (Charyzma)
* **Zasoby i inne statystyki**:
  * `"max_hp"` (Maksymalne punkty zdrowia)
  * `"defense"` (Obrona)
  * `"ap"` / `"max_action_points"` (Punkty akcji)
  * `"stamina"` / `"max_stamina"` (Kondycja)
  * `"movement"` (Prędkość ruchu)
* **Obrażenia**:
  * `"damage_taken_physical"` (Otrzymane obrażenia fizyczne)
  * `"damage_taken_magical"` (Otrzymane obrażenia do bazowego HP)

**Przykład dodania nowej statystyki (np. regeneracji bazującej na sile i poziomie):**
```json
"health_regen": {
  "base": 0,
  "scaling": [
    { "source": "level", "multiplier": 1.0, "offset": 0 },
    { "source": "total_str", "multiplier": 0.5, "offset": -2 }
  ]
}
```
*Powyższy przykład da: `0 + (poziom * 1) + ((siła - 2) * 0.5)`*

---

## 2. Dynamiczne Plecaki i Miejsca w Ekwipunku

Silnik gry nie posiada już "na sztywno" wpisanych nazw takich jak "Plecak", "Kołczan" itp. Aby dany przedmiot dodawał miejsce w odpowiedniej sekcji ekwipunku, musisz dodać tablicę `"modifiers"` do definicji przedmiotu (np. w pliku `config/shop/rozne_structured.json`).

**Dostępne nazwy modyfikatorów pojemności (`stat_name`):**
* `"backpack_space"` - Zwiększa maksymalną pojemność głównego plecaka. (System automatycznie wybierze TYLKO JEDEN przedmiot z największą wartością).
* `"quick_space"` - Miejsce podręczne (np. kieszenie, paski).
* `"quiver_space"` - Miejsce w kołczanie.
* `"back_space"` - Dodatkowe miejsce na plecach.

**Przykład jak dodać magiczną torbę:**
```json
{
  "name": "Magiczna Torba Bez Dna",
  "cost_silver": "500",
  "space_taken": "1/10",
  "description": "Zwiększa pojemność plecaka o 50.",
  "modifiers": [
    {
      "stat_name": "backpack_space",
      "value": 50.0,
      "mod_type": "ADD"
    }
  ]
}
```

---

## 3. Koszty Akcji w Ekwipunku

W pliku `game_rules.json` sekcja `"inventory.action_costs"` kontroluje to, ile Punktów Akcji kosztuje zarządzanie sprzętem. 

Klucze muszą się nazywać `move_from_{LOKACJA}` lub `use_from_{LOKACJA}`.
Wspierane lokacje:
* `BACKPACK` (Plecak główny)
* `BACK` (Na plecach)
* `EQUIPPED` (Założone / W rękach)
* `QUIVER` (Kołczan)

**Przykład:** Jeśli chcesz sprawić, by wyciąganie strzał z kołczanu nagle kosztowało 1 AP:
```json
"action_costs": {
  "move_from_QUIVER": 1,
  "use_from_QUIVER": 1
}
```

---

## 4. Balans Zbroi i Mitygacji Obrażeń (`armor_config.json`)

Mitygacja (czyli pancerz pochłaniający obrażenia przy zniszczeniu fragmentu) jest zdefiniowana bezpośrednio w `config/armor_config.json`.
W sekcji `"effects"` dla każdej zbroi znajdziesz:
* `"hp_per_fragment"` - Ile obrażeń niszczy jeden element pancerza.
* `"mitigation_per_fragment"` - Ile obrażeń pochłania każdy nienaruszony (cały) fragment.

Jeżeli dany fragment pancerza jest uszkodzony, pochłania on jedynie procent swojej mitygacji. Ten procent określasz w `game_rules.json` w sekcji `"combat.broken_fragment_mitigation_multiplier"` (domyślnie `0.5`, czyli 50%).

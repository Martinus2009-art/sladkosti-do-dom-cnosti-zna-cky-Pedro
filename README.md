# Sladkosti do domácnosti (Pedro)

Jednoduchý e‑shopový front-end v čistom HTML/CSS/JS (bez build nástrojov). Obsahuje:
- viacjazyčné UI (SK/EN/CZ/DE)
- vyhľadávanie a filter kategórií
- katalóg v modálnom okne + fullscreen
- import produktov cez JSON (textarea → „Načítať“)

## Nasadenie na GitHub Pages
1) Nahrajte `index.html` do koreňa repozitára (branch `main`).  
2) V `Settings → Pages` nastavte:
   - **Source:** Deploy from a branch
   - **Branch:** `main`
   - **Folder:** `/ (root)`
3) Počkajte 1–3 min. Stránka bude na adrese `https://<username>.github.io/<nazov-repozitara>`.

## Vlastná doména (voliteľné)
- Zaregistrujte doménu (napr. .sk ~ 8–12 €/rok).
- U poskytovateľa nastavte `CNAME` pre `www` na `<username>.github.io`.
- V `Settings → Pages` pridajte `Custom domain` (napr. `www.sladkostidodomacnosti.sk`).

## Úprava produktov
- Rozšírte pole `PRODUCTS` v `<script>` časti.
- Alebo použite tlačidlo „Importovať produkty“ a vložte JSON pole položiek.

---

© 2025 Sladkosti do domácnosti

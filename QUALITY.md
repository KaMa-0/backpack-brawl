# Quality Goals and Team Decisions

> **Status: final (all requirements B1–B7 implemented).** This document records the qualitative (non-functional) goals of our Backpack Brawl solution, why we chose them, the engineering decisions and trade-offs that support them, and how we check that we meet them. Section 6 records the results of our checks.

## Quality goals

| Priority | Goal                                   | Short description                                                                                                                            | Main requirements it supports |
| -------: | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
|        1 | **Q1 Game-state integrity**            | The run is always in a valid state. Gold, items and results are never lost, duplicated or applied twice.                                     | B1, B2, B5, B6, B7            |
|        2 | **Q2 Determinism & fairness**          | The same inputs always give the same outcome, and a refresh or a crafted request can't be used to gain an advantage.                         | B3, B4, B5, B6, B7            |
|        3 | **Q3 Resilience**                      | Slow or failing APIs and broken saved data never break the game. The player always lands in a usable screen with a clear message.            | B5, B6, B7                    |
|        4 | **Q4 Maintainability & extensibility** | New items, effects, statuses and sets can be added in a few predictable places, and the rules explained in the UI never drift from the code. | B3, B4                        |

When goals conflict, a higher-priority goal wins. Example: if a saved run can't be validated, we discard it (Q1) rather than try to repair it (Q3).

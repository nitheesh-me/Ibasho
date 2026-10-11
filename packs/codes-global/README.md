# @ibasho/pack-codes-global

Global and UK code data for the real codes stage (WP-19): Approved Document L 2021 (notional buildings, limiting fabric values), the Future Homes and Buildings Standard 2025 notional (heat pump, no fossil fuel), Approved Document O simplified method, the London Plan 2021 energy hierarchy (SI 2, Be Lean), and ASHRAE 90.1-2022 Appendix G baseline rules (Table G3 envelope for zones 0 to 1 and 4A, 90.1-2004 lighting, WWR at most 40%, building performance factors). Values are `estimate` unless marked.

- **Owner:** WP-19. **Layer:** engine half L1 (data only).

## Public API (`./engine`)

`CODES_UK`, `ASHRAE_APPG`, `SOURCES_GLOBAL`, type `Limit`.

Known simplifications in the stage: Part L compares carbon with SAP 10.2 factors on the real engine's energy (not SBEM or SAP); Appendix G keeps the proposed plant and uses energy as the cost proxy (one electricity tariff). Both are said in the row clauses.

Commands: `pnpm --filter @ibasho/pack-codes-global typecheck`.

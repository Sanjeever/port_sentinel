# AGENTS.md

## Project Overview
- Project: **Port Sentinel (端口哨兵)**.
- Type: Flutter Windows desktop app for inspecting port occupancy and killing conflicting processes.
- Main objective: quickly diagnose port conflicts during development with a clear, responsive UI.
- Primary references:
  - `docs/prompt.md` (product goals and architecture intent)
  - `docs/rules.md` (coding conventions)

## Platform And Scope
- Target platform: Windows 10+ desktop (`flutter run -d windows`).
- Core capability scope:
  - Read TCP/UDP port occupancy, PID, process name, and (when possible) executable path.
  - Search/filter/sort.
  - Kill process by PID (with confirmation and clear error messages).
- Permission caveat: non-admin mode may produce incomplete data or kill failures (`Access is denied`).

## Setup And Run
- Install dependencies:
  - `flutter pub get`
- Run desktop app:
  - `flutter run -d windows`

## Validation Commands
- Format:
  - `dart format .`
- Static analysis:
  - `flutter analyze`
- Tests:
  - `flutter test`
- Before finishing changes, run at least `dart format .` and `flutter analyze`; run `flutter test` when logic is modified.

## Codebase Map
- Entry:
  - `lib/main.dart`
- UI:
  - `lib/pages/home_page.dart`
- State management (Provider):
  - `lib/providers/home_provider.dart`
- Data/service layer:
  - `lib/services/system_repository.dart`
- Models:
  - `lib/models/port_process_item.dart`
- Tests:
  - `test/system_repository_test.dart`

## Architecture Guidelines
- Keep clear layering:
  - `models` for data structures.
  - `services/repositories` for OS command/API integration and parsing.
  - `providers` for UI-facing state transitions.
  - `pages/widgets` for presentation only.
- Avoid mixing command execution/parsing directly into UI widgets.
- For new features, prefer extending service + provider first, then bind to UI.

## Coding Conventions (From `docs/rules.md`)
- Hard requirements:
  - No compile/analyzer errors.
  - Use 2-space indentation.
  - Do not use `new`.
  - Keep imports ordered (`dart:` -> `package:` -> relative).
  - Prefer explicit types (including generics); avoid broad `var`/`Object` where type is known.
  - Use `final` for values not reassigned.
  - Use lower_snake_case for file names; UpperCamelCase for classes; lowerCamelCase for variables.
  - Bool naming should use positive semantics with `is`/`should` prefixes.
- Strong recommendations:
  - Avoid lines over 80 chars when practical.
  - Use trailing commas in long widget trees/argument lists for readable formatting.
  - Avoid magic numbers; extract constants/enums.

## Parsing And Process Management Rules
- Port/process retrieval should be robust across localized Windows outputs (Chinese/English).
- Keep parser logic isolated and testable; add/update tests when parsing behavior changes.
- Kill process flow must include:
  - explicit user confirmation (PID, process name, port context),
  - success/failure feedback,
  - clear error text for permission failures.

## UX And Responsiveness
- Long-running operations (scan/kill) must not block UI thread.
- Expose loading/error states clearly in provider state.
- Empty-result state should show a user-friendly message instead of blank content.

## Safety And Change Discipline
- Do not modify Flutter SDK source or third-party package source directly.
- Keep changes minimal, scoped, and consistent with existing Provider-based architecture.
- When behavior-affecting logic changes, add or update tests under `test/`.
- Document non-obvious tradeoffs in code comments or PR description.

---
name: feature
description: feature 브랜치를 생성하여 요청된 작업을 수행하고, commit, push, PR 생성까지 자동으로 완료한다. 새 기능 구현이나 버그 수정을 요청받았을 때 사용한다.
---

# Feature Branch Workflow

사용자의 요청을 feature 브랜치에서 작업하고, push 및 PR 생성까지 자동으로 수행한다.

## 입력

$ARGUMENTS

## 워크플로우

### 1. 최신 main 동기화 및 브랜치 생성

- `git checkout main && git pull origin main`으로 최신 상태를 가져온다
- 요청 내용을 기반으로 적절한 브랜치명을 생성한다 (예: `feature/add-dark-mode`, `fix/websocket-reconnect`)
- 브랜치명은 영문 소문자, 하이픈만 사용하고 `feature/` 또는 `fix/` 접두사를 붙인다
- `git checkout -b <branch-name>`으로 새 브랜치를 생성한다

### 2. 작업 수행

- 사용자가 요청한 기능 구현 또는 버그 수정을 수행한다
- 이 프로젝트는 Rust 백엔드 + Vanilla JS 프론트엔드 구조이다
- 변경 후 `cargo check`로 컴파일 오류가 없는지 확인한다
- 필요하면 `cargo test`로 테스트도 실행한다

### 3. 커밋

- 변경된 파일만 선택적으로 staging한다 (git add -A 금지)
- Conventional Commits 형식을 사용한다 (feat:, fix:, refactor:, docs:, chore: 등)
- 커밋 메시지 본문은 한글로 작성한다 (예: `feat: 다크모드 토글 기능 추가`)

### 4. Push 및 PR 생성

- `git push -u origin <branch-name>`으로 원격에 push한다
- `gh pr create`로 PR을 생성한다
- PR 제목은 70자 이내로 작성한다
- PR 본문 형식:
  ```
  ## Summary
  - 변경 사항 요약 (1-3개 bullet point)

  ## Changes
  - 수정된 파일과 변경 내용

  ## Test plan
  - [ ] 테스트 항목들

  Generated with [Claude Code](https://claude.com/claude-code)
  ```
- 완료 후 PR URL을 사용자에게 알려준다

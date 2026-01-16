# 프로젝트 설정 가이드

## 개발 환경 설정

### 1. Rust 설치

이 프로젝트는 Rust로 작성되었으므로 먼저 Rust를 설치해야 합니다.

```bash
# Rustup을 사용한 Rust 설치
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y

# 환경 변수 로드
source "$HOME/.cargo/env"

# 설치 확인
cargo --version
rustc --version
```

### 2. 프로젝트 클론 및 빌드

```bash
# 프로젝트 디렉토리로 이동
cd /home/haley/Project/md_viewer

# 의존성 다운로드 및 빌드
cargo build

# 빌드 성공 확인 (약 2-3분 소요)
# 처음 빌드 시 모든 의존성을 다운로드하므로 시간이 걸립니다
```

### 3. 의존성 라이브러리

프로젝트는 다음 주요 라이브러리를 사용합니다:

#### Rust Crates
- `actix-web` (4.9): 웹 서버 프레임워크
- `actix-ws` (0.3): WebSocket 지원
- `pulldown-cmark` (0.12): 마크다운 파싱
- `notify` (6.1): 파일 시스템 감시
- `tokio` (1.41): 비동기 런타임
- `serde` (1.0): 직렬화/역직렬화
- `clap` (4.5): CLI 인자 파싱

#### 프론트엔드 라이브러리 (static/vendor/)
모든 라이브러리는 이미 다운로드되어 포함되어 있습니다:
- `highlight.js` (11.9.0): 코드 신택스 하이라이팅
- `KaTeX` (0.16.9): LaTeX 수식 렌더링
- `Mermaid` (10.6.1): 다이어그램 렌더링

### 4. 프로젝트 구조

```
md_viewer/
├── Cargo.toml                  # Rust 의존성 설정
├── Cargo.lock                  # 의존성 버전 잠금
├── src/
│   ├── main.rs                 # 서버 진입점
│   ├── config.rs               # CLI 설정
│   ├── markdown.rs             # 마크다운 파싱
│   ├── file_watcher.rs         # 파일 감시
│   ├── file_browser.rs         # 파일 트리 생성
│   ├── websocket.rs            # WebSocket 핸들러
│   └── routes.rs               # HTTP API
├── static/
│   ├── css/
│   │   └── main.css            # 메인 스타일시트
│   ├── js/
│   │   ├── app.js              # 메인 애플리케이션
│   │   ├── file-browser.js     # 파일 브라우저 UI
│   │   ├── markdown-viewer.js  # 마크다운 뷰어
│   │   └── websocket-client.js # WebSocket 클라이언트
│   └── vendor/                 # 외부 라이브러리
│       ├── highlight.min.js
│       ├── katex.min.js
│       ├── katex.min.css
│       ├── auto-render.min.js
│       └── mermaid.min.js
├── test_docs/                  # 테스트용 마크다운 파일
│   └── test.md
├── README.md                   # 프로젝트 소개
├── SETUP.md                    # 이 파일
└── .gitignore                  # Git 제외 파일
```

## 실행 방법

### 개발 모드

```bash
# test_docs 디렉토리 감시
cargo run -- test_docs

# 다른 디렉토리 감시
cargo run -- /path/to/markdown/files

# 포트 변경
cargo run -- -p 3000 test_docs

# 브라우저 자동 열기 비활성화
cargo run -- --no-browser test_docs

# 디버그 로그 활성화
RUST_LOG=debug cargo run -- test_docs
```

### 릴리스 빌드

```bash
# 최적화된 빌드
cargo build --release

# 실행
./target/release/md_viewer test_docs

# 시스템에 설치
cargo install --path .

# 이후 어디서든 실행 가능
md_viewer ~/Documents/notes
```

## 테스트

### 기본 테스트

```bash
# 유닛 테스트 실행
cargo test

# 특정 테스트만 실행
cargo test test_basic_markdown
```

### 수동 테스트

1. **서버 시작**
   ```bash
   cargo run -- test_docs
   ```

2. **브라우저에서 확인**
   - http://127.0.0.1:8080 자동 열림
   - 사이드바에서 `test.md` 클릭

3. **실시간 업데이트 테스트**
   ```bash
   # 다른 터미널에서 파일 수정
   echo "## 새로운 섹션" >> test_docs/test.md
   ```
   - 브라우저에 즉시 반영 확인

4. **마크다운 기능 확인**
   - ✅ 코드 하이라이팅
   - ✅ 테이블
   - ✅ 체크리스트
   - ✅ 수학 수식 ($E = mc^2$)
   - ✅ Mermaid 다이어그램

## 트러블슈팅

### Rust가 설치되지 않음

```bash
# Rust 설치 확인
which cargo

# 설치되지 않았다면
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"
```

### 빌드 에러 발생

```bash
# 의존성 캐시 삭제 후 재빌드
rm -rf target/
cargo clean
cargo build
```

### 포트가 이미 사용 중

```bash
# 다른 포트 사용
cargo run -- -p 8081 test_docs
```

### 파일 변경이 감지되지 않음

- 일부 에디터(vim, nano 등)는 파일을 직접 수정하지 않고 임시 파일을 만들 수 있습니다
- 저장 후 몇 초 기다려보세요 (debounce: 300ms)
- 로그 확인: `RUST_LOG=info cargo run -- test_docs`

### 브라우저가 자동으로 열리지 않음

```bash
# 수동으로 브라우저 열기
# 서버 시작 후 다음 URL 접속
http://127.0.0.1:8080

# 또는 자동 열기 비활성화 후 수동 실행
cargo run -- --no-browser test_docs
```

## 성능 최적화

### 릴리스 빌드 사용

개발용이 아닌 실제 사용 시에는 릴리스 빌드를 사용하세요:

```bash
cargo build --release
time ./target/release/md_viewer test_docs
```

릴리스 빌드는:
- 약 10-20배 빠른 성능
- 최적화된 바이너리
- 디버그 심볼 제거

### 대용량 디렉토리

수천 개의 마크다운 파일이 있는 경우:

```bash
# .gitignore를 사용하여 불필요한 파일 제외
# 프로젝트 루트에 .gitignore 생성
echo "node_modules/" >> .gitignore
echo "*.log" >> .gitignore
```

## 다음 단계

프로젝트가 정상적으로 실행되면:

1. 자신의 마크다운 파일 디렉토리로 시도해보세요
2. 기능 추가나 개선이 필요하면 소스 코드를 수정하세요
3. 버그를 발견하면 GitHub Issues에 보고해주세요

## 개발 시작하기

### 코드 수정 후 재시작

```bash
# Ctrl+C로 서버 중지 후
cargo run -- test_docs

# 또는 cargo-watch 사용 (자동 재시작)
cargo install cargo-watch
cargo watch -x "run -- test_docs"
```

### 새로운 기능 추가

주요 파일 위치:
- 백엔드 로직: `src/` 디렉토리
- 프론트엔드 UI: `static/js/` 디렉토리
- 스타일: `static/css/main.css`
- HTML 템플릿: `src/main.rs`의 `index_handler` 함수

### 의존성 추가

```bash
# 새로운 crate 추가
cargo add <crate-name>

# 예: serde 추가
cargo add serde --features derive
```

## 환경 변수

```bash
# 로그 레벨 설정
export RUST_LOG=debug    # trace, debug, info, warn, error

# 로그 필터링
export RUST_LOG=md_viewer=debug,actix_web=info

# 실행
cargo run -- test_docs
```

## 추가 리소스

- [Rust 공식 문서](https://doc.rust-lang.org/)
- [actix-web 문서](https://actix.rs/)
- [pulldown-cmark 문서](https://docs.rs/pulldown-cmark/)
- [프로젝트 README](README.md)

# AI 번역기

SvelteKit + TypeScript 기반 개인용 AI 번역기. OpenAI 호환 API로 다중 provider 지원, BYOK, 스트리밍, 용어집, 히스토리.

## 기능

- 다중 AI provider 지원 (OpenAI, Gemini, Qwen, Zhipu, DeepSeek + 커스텀)
- BYOK (Bring Your Own Key) — 브라우저 localStorage에 API 키 저장
- 실시간 스트리밍 번역
- 사용자 정의 번역 지시 (프롬프트)
- 용어집 (glossary) — 특정 용어 번역 고정
- 번역 히스토리 (최대 100건)
- 소스 언어 자동 감지
- 다크모드

## 시작하기

### 요구사항

- Node.js 20+ (Vercel 배포 시)
- npm 10+

### 설치

```bash
npm install
```

### 개발 서버

```bash
npm run dev
```

브라우저에서 http://localhost:5173 접속.

### 테스트

```bash
# 단위 테스트
npm run test

# E2E 테스트 (Chromium 자동 다운로드)
npm run test:e2e
```

### 빌드

```bash
npm run build
npm run preview  # 로컬에서 빌드 결과 확인
```

## 사용법

1. **설정 페이지** (/settings)에서 사용할 provider의 API 키 입력
2. **번역 페이지** (/)에서 소스 텍스트 입력, 대상 언어 선택
3. (선택) 고급 옵션에서 커스텀 프롬프트, 용어집 활성화
4. "번역하기" 클릭 → 결과가 스트리밍으로 표시
5. 번역 기록은 /history에서 확인

## API 키 발급

이 앱은 BYOK 방식입니다. 서버 환경 변수 대신 UI(설정 페이지)에서 API 키를 입력하세요.

| Provider         | 발급 URL                                    |
| ---------------- | ------------------------------------------- |
| OpenAI           | https://platform.openai.com/api-keys        |
| Google Gemini    | https://aistudio.google.com/apikey          |
| Qwen (DashScope) | https://dashscope.console.aliyun.com/apiKey |
| Z.AI (Zhipu)     | https://open.bigmodel.cn/usercenter/apikeys |
| DeepSeek         | https://platform.deepseek.com/api_keys      |

⚠️ **Z.AI (Zhipu)**: BigModel은 전통적으로 JWT 인증을 사용합니다. 최신 OpenAI 호환 모드(`https://open.bigmodel.cn/api/paas/v4`)는 Bearer API key를 지원하지만, 401 오류 발생 시 Zhipu SDK 또는 수동 JWT signing이 필요할 수 있습니다.

## 배포 (Vercel)

이 프로젝트는 `@sveltejs/adapter-vercel`을 사용합니다.

### 옵션 A: Vercel CLI

```bash
npm i -g vercel
vercel  # preview 배포
vercel --prod  # production 배포
```

### 옵션 B: Git 연동

1. GitHub/GitLab에 저장소 연결
2. Vercel 대시보드에서 "New Project" → 저장소 선택
3. Framework Preset: SvelteKit (자동 감지)
4. Deploy 클릭

**주의**: Vercel Hobby plan serverless function timeout은 10초입니다. 느린 provider 응답 시 첫 토큰이 10초 내 도달해야 합니다. Pro plan(60초) 이상 권장.

## 아키텍처

- **프론트엔드**: SvelteKit 2 + Svelte 5 (runes mode)
- **스타일링**: Tailwind CSS 3
- **AI 통합**: OpenAI SDK (custom baseURL로 다중 provider 처리)
- **상태**: Svelte stores + localStorage 영속
- **테스트**: Vitest (단위) + Playwright (E2E), TDD
- **배포**: Vercel

### 핵심 디렉토리

```
src/
  lib/
    components/    # Svelte 컴포넌트
    constants/     # UI 문자열, 언어 목록, 에러 메시지
    detect/        # 언어 자동 감지
    providers/     # Provider registry, 번역 로직
    schemas/       # Zod 스키마 + TypeScript 타입
    storage/       # localStorage 영속 유틸리티
    stores/        # Svelte stores (settings, glossary, history, toasts)
    streaming/     # SSE 스트림 파서
  routes/
    api/translate/ # POST /api/translate (스트리밍 API)
    settings/      # /settings
    glossary/      # /용어집
    history/       # /history
```

## 라이선스

개인 사용 목적.
